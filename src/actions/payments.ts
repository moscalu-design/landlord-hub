"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { applyDepositTransaction } from "@/lib/depositUtils";
import prisma from "@/lib/prisma";
import { PaymentSchema, DepositTransactionSchema } from "@/lib/validations";
import { computePaymentStatus } from "@/lib/utils";

async function requireAuth() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return { ...session.user, id: userId };
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

  const result = await applyDepositTransaction({
    occupancyId,
    type: validated.type,
    amount: validated.amount,
    date: new Date(validated.date),
    description: validated.description || null,
    userId: user.id,
  });

  revalidatePath(`/rooms/${result.roomId}`);
  revalidatePath(`/tenants/${result.tenantId}`);
}
