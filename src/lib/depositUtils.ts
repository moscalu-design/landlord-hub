import prisma from "@/lib/prisma";

export type DepositTransactionLike = {
  type: string;
  amount: number;
};

export function summarizeDepositTransactions(
  required: number,
  transactions: DepositTransactionLike[]
) {
  const received = transactions
    .filter((tx) => tx.type === "RECEIVED" || tx.type === "ADJUSTMENT")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const deducted = transactions
    .filter((tx) => tx.type === "DEDUCTION")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const refunded = transactions
    .filter((tx) => tx.type === "REFUND")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const outstandingDeposit = Math.max(required - received, 0);
  const refundableTotal = Math.max(received - deducted, 0);
  const outstandingRefund = Math.max(refundableTotal - refunded, 0);
  const isFullyRefunded = refunded > 0 && outstandingRefund === 0;

  let status = "PENDING";
  if (received >= required) status = "RECEIVED";
  else if (received > 0) status = "PARTIAL";

  if (deducted > 0 && refunded === 0) status = "DEDUCTED";
  if (refunded > 0 && isFullyRefunded) status = "REFUNDED";
  else if (refunded > 0) status = "PARTIAL_REFUND";

  return {
    required,
    received,
    deducted,
    refunded,
    outstandingDeposit,
    refundableTotal,
    outstandingRefund,
    isFullyRefunded,
    status,
  };
}

export async function applyDepositTransaction(params: {
  occupancyId: string;
  type: string;
  amount: number;
  date: Date;
  description?: string | null;
  userId: string;
}) {
  const occupancy = await prisma.occupancy.findUnique({
    where: { id: params.occupancyId },
    include: {
      room: true,
      deposit: {
        include: {
          transactions: true,
        },
      },
    },
  });

  if (!occupancy?.deposit) {
    throw new Error("Deposit not found");
  }

  const current = summarizeDepositTransactions(
    occupancy.deposit.required,
    occupancy.deposit.transactions
  );

  if (
    params.type === "DEDUCTION" &&
    params.amount > current.received - current.deducted
  ) {
    throw new Error("Deductions cannot exceed the deposit currently held.");
  }

  if (
    params.type === "REFUND" &&
    params.amount > current.outstandingRefund
  ) {
    throw new Error("Refund cannot exceed the remaining refundable balance.");
  }

  await prisma.depositTransaction.create({
    data: {
      depositId: occupancy.deposit.id,
      type: params.type,
      amount: params.amount,
      date: params.date,
      description: params.description || null,
    },
  });

  const allTransactions = await prisma.depositTransaction.findMany({
    where: { depositId: occupancy.deposit.id },
  });

  const summary = summarizeDepositTransactions(
    occupancy.deposit.required,
    allTransactions
  );

  await prisma.deposit.update({
    where: { id: occupancy.deposit.id },
    data: {
      received: summary.received,
      receivedAt:
        occupancy.deposit.receivedAt ??
        (summary.received > 0 ? params.date : null),
      status: summary.status,
      refunded: summary.isFullyRefunded,
      refundAmount: summary.refunded > 0 ? summary.refunded : null,
      deductionNotes:
        params.type === "DEDUCTION" && params.description
          ? params.description
          : occupancy.deposit.deductionNotes,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "DEPOSIT_UPDATED",
      description: `Deposit ${params.type.toLowerCase()} of €${params.amount} recorded for ${occupancy.room.name}`,
      entityType: "DEPOSIT",
      entityId: occupancy.deposit.id,
      userId: params.userId,
      roomId: occupancy.roomId,
      tenantId: occupancy.tenantId,
      occupancyId: params.occupancyId,
    },
  });

  return {
    roomId: occupancy.roomId,
    tenantId: occupancy.tenantId,
    depositId: occupancy.deposit.id,
    summary,
  };
}
