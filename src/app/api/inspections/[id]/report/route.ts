import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";
import {
  buildInspectionReportPdf,
  buildReportFilename,
  type InspectionReportData,
  type InspectionReportPhoto,
} from "@/lib/inspectionReport";

const EMBEDDABLE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await context.params) as { id: string };

  const inspection = await prisma.inventoryInspection.findUnique({
    where: { id },
    include: {
      occupancy: {
        include: {
          tenant: true,
          room: { include: { property: true } },
        },
      },
      items: {
        include: {
          inventoryItem: {
            select: { estimatedValue: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      photos: { orderBy: { uploadedAt: "asc" } },
    },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  }

  // Read bytes only for formats we can embed (skip HEIC/WEBP, they'll show a placeholder).
  const photos: InspectionReportPhoto[] = await Promise.all(
    inspection.photos.map(async (p) => {
      let bytes: Uint8Array | undefined;
      const lowerType = (p.fileType || "").toLowerCase();
      const canEmbed =
        EMBEDDABLE_PHOTO_TYPES.has(lowerType) ||
        /\.(jpe?g|png)$/i.test(p.fileName);
      if (canEmbed) {
        try {
          const buf = await readStoredDocument(p.storageUrl);
          bytes = new Uint8Array(buf);
        } catch {
          bytes = undefined;
        }
      }
      return {
        id: p.id,
        fileName: p.fileName,
        fileType: p.fileType,
        inspectionItemId: p.inspectionItemId,
        bytes,
      };
    })
  );

  const room = inspection.occupancy?.room ?? null;
  const property = room?.property ?? null;
  const tenant = inspection.occupancy?.tenant ?? null;

  const data: InspectionReportData = {
    property: property
      ? {
          name: property.name ?? null,
          address: property.address ?? null,
          city: property.city ?? null,
          postcode: property.postcode ?? null,
        }
      : null,
    room: room ? { name: room.name ?? null } : null,
    tenant: tenant
      ? { firstName: tenant.firstName, lastName: tenant.lastName }
      : null,
    inspection: {
      id: inspection.id,
      type: inspection.type,
      date: inspection.date,
      notes: inspection.notes,
    },
    items: inspection.items.map((it) => ({
      id: it.id,
      itemName: it.itemName,
      condition: it.condition,
      quantity: it.quantity,
      estimatedValue: it.inventoryItem?.estimatedValue ?? null,
      notes: it.notes,
    })),
    photos,
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInspectionReportPdf(data);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const detail = process.env.NODE_ENV !== "production" ? ` (${errMsg})` : "";
    return NextResponse.json(
      { error: `Failed to generate report.${detail}` },
      { status: 500 }
    );
  }

  const filename = buildReportFilename(data);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
