import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.tenantDocument.findUnique({
    where: { id, userId: session.user.id },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readStoredDocument(doc.storageUrl);
  } catch (error) {
    console.error("[documents/get] Failed to read stored file:", error);
    return NextResponse.json({ error: "Failed to retrieve file." }, { status: 502 });
  }

  const disposition = req.nextUrl.searchParams.get("dl") === "1"
    ? `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    : `inline; filename="${encodeURIComponent(doc.fileName)}"`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": doc.fileType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
