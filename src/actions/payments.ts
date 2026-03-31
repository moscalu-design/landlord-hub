"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PaymentSchema, DepositTransactionSchema } from "@/lib/validations";
import { computePaymentStatus } from "@/lib/utils";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function recordPayment(paymentId: string, formData: FormData) {
  const user = await requireAuth();
  const validated = PaymentSchema.parse({
    amountPaid: formData.get("amountPaid"),
    paidAt: formData.get("paidAt") || undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  const status = computePaymentStatus({
    amountDue: payment.amountDue,
    amountPaid: validated.amountPaid,
    status: payment.status,
    dueDate: payment.dueDate,
  });

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      amountPaid: validated.amountPaid,
      status,
      paidAt: validated.paidAt ? new Date(validated.paidAt) : (validated.amountPaid > 0 ? new Date() : null),
      paymentMethod: validated.paymentMethod || null,
      reference: validated.reference || null,
      notes: validated.notes || null,
    },
    include: { occupancy: { include: { room: true } } },
  });

  await prisma.activityLog.create({
    data: {
      action: "PAYMENT_RECORDED",
      description: `Payment of £${validated.amountPaid} recorded for ${updated.occupancy.room.name} (${updated.periodMonth}/${updated.periodYear})`,
      entityType: "PAYMENT",
      entityId: paymentId,
      userId: user.id,
      roomId: updated.occupancy.roomId,
      tenantId: updated.occupancy.tenantId,
      occupancyId: updated.occupancyId,
    },
  });

  revalidatePath(`/rooms/${updated.occupancy.roomId}`);
  revalidatePath(`/tenants/${updated.occupancy.tenantId}`);
  revalidatePath("/payments");
}

export async function waivePayment(paymentId: string) {
  await requireAuth();
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "WAIVED" },
    include: { occupancy: true },
  });
  revalidatePath("/payments");
  revalidatePath(`/rooms/${payment.occupancy.roomId}`);
  revalidatePath(`/tenants/${payment.occupancy.tenantId}`);
}

export async function recordDepositTransaction(occupancyId: string, formData: FormData) {
  const user = await requireAuth();
  const rawFormData = {
    type: formData.get("type"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description") || undefined,
  };
  const validated = DepositTransactionSchema.parse(rawFormData);

  const deposit = await prisma.deposit.findUnique({ where: { occupancyId } });
  if (!deposit) throw new Error("Deposit not found");

  await prisma.depositTransaction.create({
    data: {
      depositId: deposit.id,
      type: validated.type,
      amount: validated.amount,
      date: new Date(validated.date),
      description: validated.description || null,
    },
  });

  // Recalculate deposit totals
  const allTx = await prisma.depositTransaction.findMany({ where: { depositId: deposit.id } });
  const received = allTx
    .filter((t) => t.type === "RECEIVED" || t.type === "ADJUSTMENT")
    .reduce((sum, t) => sum + t.amount, 0);
  const refunded = allTx
    .filter((t) => t.type === "REFUND")
    .reduce((sum, t) => sum + t.amount, 0);
  const deducted = allTx
    .filter((t) => t.type === "DEDUCTION")
    .reduce((sum, t) => sum + t.amount, 0);

  let status = "PENDING";
  if (received >= deposit.required) status = "RECEIVED";
  else if (received > 0) status = "PARTIAL";
  if (refunded > 0 && refunded >= received - deducted) status = "REFUNDED";
  else if (refunded > 0) status = "PARTIAL_REFUND";
  if (deducted > 0 && refunded === 0) status = "DEDUCTED";

  await prisma.deposit.update({
    where: { id: deposit.id },
    data: {
      received,
      receivedAt: deposit.receivedAt ?? (received > 0 ? new Date() : null),
      status,
      refunded: refunded > 0,
      refundAmount: refunded > 0 ? refunded : null,
    },
  });

  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId },
    include: { room: true },
  });

  await prisma.activityLog.create({
    data: {
      action: "DEPOSIT_UPDATED",
      description: `Deposit ${validated.type.toLowerCase()} of £${validated.amount} recorded for ${occupancy?.room.name}`,
      entityType: "DEPOSIT",
      entityId: deposit.id,
      userId: user.id,
      roomId: occupancy?.roomId,
      tenantId: occupancy?.tenantId,
      occupancyId,
    },
  });

  revalidatePath(`/rooms/${occupancy?.roomId}`);
  revalidatePath(`/tenants/${occupancy?.tenantId}`);
}
