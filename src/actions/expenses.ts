"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { deleteStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";
import { PropertyExpenseSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICITY: "Electricity", GAS: "Gas", WATER: "Water", HEATING: "Heating",
  INTERNET: "Internet", INSURANCE: "Insurance", MAINTENANCE: "Maintenance",
  REPAIRS: "Repairs", CLEANING: "Cleaning", TAXES: "Taxes", OTHER: "Other",
};

function parseExpenseFormData(formData: FormData) {
  const category = String(formData.get("category") ?? "OTHER");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const rawTitle = String(formData.get("title") ?? "").trim();
  const autoTitle = rawTitle || (() => {
    const label = CATEGORY_LABELS[category] ?? "Expense";
    if (paymentDate) {
      const d = new Date(paymentDate);
      if (!isNaN(d.getTime())) {
        return `${label} · ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
      }
    }
    return label;
  })();

  return PropertyExpenseSchema.parse({
    title: autoTitle,
    category,
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    reportingYear: formData.get("reportingYear"),
    reportingMonth: formData.get("reportingMonth"),
    coverageStart: formData.get("coverageStart") || undefined,
    coverageEnd: formData.get("coverageEnd") || undefined,
    recurrenceType: formData.get("recurrenceType") || "ONE_OFF",
    provider: formData.get("provider") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createExpense(
  propertyId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireAuth();
  const validated = parseExpenseFormData(formData);

  const expense = await prisma.propertyExpense.create({
    data: {
      propertyId,
      title: validated.title ?? "Expense",
      category: validated.category,
      amount: validated.amount,
      paymentDate: new Date(validated.paymentDate),
      reportingYear: validated.reportingYear,
      reportingMonth: validated.reportingMonth,
      coverageStart: validated.coverageStart ? new Date(validated.coverageStart) : null,
      coverageEnd: validated.coverageEnd ? new Date(validated.coverageEnd) : null,
      recurrenceType: validated.recurrenceType,
      provider: validated.provider || null,
      notes: validated.notes || null,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/costs`);
  return { id: expense.id };
}

export async function updateExpense(
  id: string,
  propertyId: string,
  formData: FormData
): Promise<void> {
  await requireAuth();
  const validated = parseExpenseFormData(formData);

  await prisma.propertyExpense.update({
    where: { id },
    data: {
      title: validated.title ?? "Expense",
      category: validated.category,
      amount: validated.amount,
      paymentDate: new Date(validated.paymentDate),
      reportingYear: validated.reportingYear,
      reportingMonth: validated.reportingMonth,
      coverageStart: validated.coverageStart ? new Date(validated.coverageStart) : null,
      coverageEnd: validated.coverageEnd ? new Date(validated.coverageEnd) : null,
      recurrenceType: validated.recurrenceType,
      provider: validated.provider || null,
      notes: validated.notes || null,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/costs`);
}

export async function deleteExpense(id: string, propertyId: string): Promise<void> {
  await requireAuth();

  const expense = await prisma.propertyExpense.findUnique({ where: { id } });
  if (!expense) return;

  // Delete receipt from storage if present
  if (expense.receiptStorageUrl) {
    try {
      await deleteStoredDocument(expense.receiptStorageUrl);
    } catch {
      // Best-effort — don't block delete on storage failure
    }
  }

  await prisma.propertyExpense.delete({ where: { id } });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/costs`);
}
