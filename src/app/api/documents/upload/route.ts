import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteStoredDocument,
  getStorageModeSummary,
  storeDocument,
} from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXTENSIONS = /\.(pdf|jpg|jpeg|png)$/i;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_DOC_TYPES = new Set(["idDocument", "workContract", "salarySlip"]);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const tenantId = formData.get("tenantId") as string | null;
    const type = formData.get("type") as string | null;

    if (!file || !tenantId || !type) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!VALID_DOC_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json(
        { error: "Only PDF, JPG, and PNG files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const existing = await prisma.tenantDocument.findUnique({
      where: { tenantId_type: { tenantId, type } },
    });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const blobPath = `tenant-documents/${tenantId}/${type}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    let storedFile: Awaited<ReturnType<typeof storeDocument>>;
    try {
      storedFile = await storeDocument(blobPath, buffer, file.type);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errType = err instanceof Error ? err.constructor.name : "Unknown";
      console.error(
        "[documents/upload] Storage error:",
        errType,
        errMsg,
        { mode: getStorageModeSummary() },
        err
      );
      // Include detail in dev so we can diagnose; strip it in production
      const detail = process.env.NODE_ENV !== "production" ? ` (${errType}: ${errMsg})` : "";
      return NextResponse.json(
        { error: `File storage unavailable. Please try again later.${detail}` },
        { status: 502 }
      );
    }

    // Delete old blob only if it was at a different URL (different extension)
    if (existing && existing.storageUrl !== storedFile.url) {
      try {
        await deleteStoredDocument(existing.storageUrl);
      } catch {
        // Best-effort — don't fail the upload
      }
    }

    const now = new Date();

    const document = await prisma.tenantDocument.upsert({
      where: { tenantId_type: { tenantId, type } },
      create: {
        tenantId,
        type,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageUrl: storedFile.url,
        uploadedAt: now,
        updatedAt: now,
      },
      update: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageUrl: storedFile.url,
        uploadedAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({
      id: document.id,
      documentId: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt,
    });
  } catch (err) {
    console.error("[documents/upload] Unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
