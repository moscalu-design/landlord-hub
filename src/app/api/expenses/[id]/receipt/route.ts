import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteStoredDocument,
  readStoredDocument,
  storeDocument,
} from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png)$/i;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

// GET /api/expenses/[id]/receipt — serve the receipt file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await prisma.propertyExpense.findUnique({ where: { id } });
  if (!expense?.receiptStorageUrl || !expense.receiptFileName) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readStoredDocument(expense.receiptStorageUrl);
  } catch (error) {
    console.error("[expenses/receipt] Failed to read stored file:", error);
    return NextResponse.json({ error: "Failed to retrieve receipt." }, { status: 502 });
  }

  const ext = expense.receiptFileName.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
      ? "image/png"
      : "image/jpeg";

  const disposition =
    req.nextUrl.searchParams.get("dl") === "1"
      ? `attachment; filename="${encodeURIComponent(expense.receiptFileName)}"`
      : `inline; filename="${encodeURIComponent(expense.receiptFileName)}"`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// POST /api/expenses/[id]/receipt — attach or replace a receipt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await prisma.propertyExpense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.test(file.name)) {
    return NextResponse.json(
      { error: "Only PDF, JPG, and PNG files are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 4 MB." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const storagePath = `property-expenses/${id}/receipt.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedFile: Awaited<ReturnType<typeof storeDocument>>;
  try {
    storedFile = await storeDocument(storagePath, buffer, file.type);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[expenses/receipt] Storage error:", errMsg, err);
    const detail = process.env.NODE_ENV !== "production" ? ` (${errMsg})` : "";
    return NextResponse.json(
      { error: `File storage unavailable. Please try again later.${detail}` },
      { status: 502 }
    );
  }

  // Delete old receipt if it was stored at a different URL (e.g. extension changed)
  if (expense.receiptStorageUrl && expense.receiptStorageUrl !== storedFile.url) {
    try {
      await deleteStoredDocument(expense.receiptStorageUrl);
    } catch {
      // Best-effort
    }
  }

  const now = new Date();
  await prisma.propertyExpense.update({
    where: { id },
    data: {
      receiptStorageUrl: storedFile.url,
      receiptFileName: file.name,
      receiptFileSize: file.size,
      receiptUploadedAt: now,
    },
  });

  return NextResponse.json({
    receiptFileName: file.name,
    receiptFileSize: file.size,
    receiptUploadedAt: now,
  });
}

// DELETE /api/expenses/[id]/receipt — remove attached receipt
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const expense = await prisma.propertyExpense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  if (!expense.receiptStorageUrl) {
    return NextResponse.json({ error: "No receipt attached." }, { status: 404 });
  }

  try {
    await deleteStoredDocument(expense.receiptStorageUrl);
  } catch {
    // Best-effort
  }

  await prisma.propertyExpense.update({
    where: { id },
    data: {
      receiptStorageUrl: null,
      receiptFileName: null,
      receiptFileSize: null,
      receiptUploadedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
