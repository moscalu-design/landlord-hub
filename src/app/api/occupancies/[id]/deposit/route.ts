import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DepositTransactionSchema } from "@/lib/validations";
import { applyDepositTransaction } from "@/lib/depositUtils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let validated;
  try {
    validated = DepositTransactionSchema.parse({
      type: formData.get("type"),
      amount: formData.get("amount"),
      date: formData.get("date"),
      description: formData.get("description") || undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid deposit transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await applyDepositTransaction({
      occupancyId: id,
      type: validated.type,
      amount: validated.amount,
      date: new Date(validated.date),
      description: validated.description || null,
      userId: session.user.id,
    });

    return NextResponse.json({ ok: true, summary: result.summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update deposit.";
    const status = message === "Deposit not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
