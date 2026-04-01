import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteStoredDocument,
  readStoredDocument,
  storeDocument,
} from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

const ALLOWED_MIME = new Set(["application/pdf"]);
const ALLOWED_EXT = /\.(pdf)$/i;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB to stay within Vercel request limits

// GET /api/occupancies/[id]/contract — serve the contract file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const occupancy = await prisma.occupancy.findUnique({ where: { id } });
  if (!occupancy?.contractStorageUrl || !occupancy.contractFileName) {
    return NextResponse.json({ error: "Contract not found." }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readStoredDocument(occupancy.contractStorageUrl);
  } catch (error) {
    console.error("[occupancies/contract] Failed to read stored file:", error);
    return NextResponse.json({ error: "Failed to retrieve contract." }, { status: 502 });
  }

  const ext = occupancy.contractFileName.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
      ? "image/png"
      : "image/jpeg";

  const disposition =
    req.nextUrl.searchParams.get("dl") === "1"
      ? `attachment; filename="${encodeURIComponent(occupancy.contractFileName)}"`
      : `inline; filename="${encodeURIComponent(occupancy.contractFileName)}"`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// POST /api/occupancies/[id]/contract — attach or replace the rental contract
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const occupancy = await prisma.occupancy.findUnique({ where: { id } });
  if (!occupancy) {
    return NextResponse.json({ error: "Occupancy not found." }, { status: 404 });
  }
  if (occupancy.status !== "ACTIVE") {
    return NextResponse.json({ error: "Contracts can only be attached to an active tenancy." }, { status: 400 });
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
      { error: "Only PDF files are allowed." },
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

  const storagePath = `occupancy-contracts/${id}/contract.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedFile: Awaited<ReturnType<typeof storeDocument>>;
  try {
    storedFile = await storeDocument(storagePath, buffer, file.type);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[occupancies/contract] Storage error:", errMsg, err);
    const detail = process.env.NODE_ENV !== "production" ? ` (${errMsg})` : "";
    return NextResponse.json(
      { error: `File storage unavailable. Please try again later.${detail}` },
      { status: 502 }
    );
  }

  // Delete old contract if stored at a different URL
  if (occupancy.contractStorageUrl && occupancy.contractStorageUrl !== storedFile.url) {
    try {
      await deleteStoredDocument(occupancy.contractStorageUrl);
    } catch {
      // Best-effort
    }
  }

  const now = new Date();
  await prisma.occupancy.update({
    where: { id },
    data: {
      contractStorageUrl: storedFile.url,
      contractFileName: file.name,
      contractFileSize: file.size,
      contractUploadedAt: now,
    },
  });

  return NextResponse.json({
    contractFileName: file.name,
    contractFileSize: file.size,
    contractUploadedAt: now,
  });
}

// DELETE /api/occupancies/[id]/contract — remove attached contract
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const occupancy = await prisma.occupancy.findUnique({ where: { id } });
  if (!occupancy) {
    return NextResponse.json({ error: "Occupancy not found." }, { status: 404 });
  }
  if (occupancy.status !== "ACTIVE") {
    return NextResponse.json({ error: "Contracts can only be removed from an active tenancy." }, { status: 400 });
  }

  if (!occupancy.contractStorageUrl) {
    return NextResponse.json({ error: "No contract attached." }, { status: 404 });
  }

  try {
    await deleteStoredDocument(occupancy.contractStorageUrl);
  } catch {
    // Best-effort
  }

  await prisma.occupancy.update({
    where: { id },
    data: {
      contractStorageUrl: null,
      contractFileName: null,
      contractFileSize: null,
      contractUploadedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
