import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteStoredDocument, readStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await context.params) as { id: string };
  const photo = await prisma.inventoryInspectionPhoto.findUnique({
    where: { id },
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readStoredDocument(photo.storageUrl);
  } catch {
    return NextResponse.json({ error: "Failed to retrieve photo." }, { status: 502 });
  }

  const disposition =
    req.nextUrl.searchParams.get("dl") === "1"
      ? `attachment; filename="${encodeURIComponent(photo.fileName)}"`
      : `inline; filename="${encodeURIComponent(photo.fileName)}"`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": photo.fileType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await context.params) as { id: string };
  const photo = await prisma.inventoryInspectionPhoto.findUnique({
    where: { id },
    include: {
      inspection: {
        include: {
          occupancy: {
            select: { roomId: true },
          },
        },
      },
    },
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  try {
    await deleteStoredDocument(photo.storageUrl);
  } catch {
    // Best-effort
  }

  await prisma.inventoryInspectionPhoto.delete({ where: { id } });

  return NextResponse.json({
    ok: true,
    roomId: photo.inspection.occupancy.roomId,
  });
}
