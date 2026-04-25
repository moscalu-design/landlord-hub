import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_EXT = /\.(jpg|jpeg|png|webp|heic|heif)$/i;
const MAX_FILE_SIZE = 4 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await context.params) as { id: string };
  const inspection = await prisma.inventoryInspection.findUnique({
    where: { id },
    include: { items: { select: { id: true } } },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const rawItemId = formData.get("inspectionItemId");
  let inspectionItemId: string | null = null;
  if (typeof rawItemId === "string" && rawItemId.length > 0) {
    const allowed = new Set(inspection.items.map((i) => i.id));
    if (!allowed.has(rawItemId)) {
      return NextResponse.json(
        { error: "Inspection item does not belong to this inspection." },
        { status: 400 }
      );
    }
    inspectionItemId = rawItemId;
  }

  if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.test(file.name)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, WEBP, and HEIC images are allowed." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 4 MB." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const photoId = crypto.randomUUID();
  const storagePath = `inspection-photos/${id}/${photoId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedFile: Awaited<ReturnType<typeof storeDocument>>;
  try {
    storedFile = await storeDocument(storagePath, buffer, file.type);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const detail = process.env.NODE_ENV !== "production" ? ` (${errMsg})` : "";
    return NextResponse.json(
      { error: `Image storage unavailable. Please try again later.${detail}` },
      { status: 502 }
    );
  }

  const photo = await prisma.inventoryInspectionPhoto.create({
    data: {
      id: photoId,
      inspectionId: id,
      inspectionItemId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storageUrl: storedFile.url,
    },
  });

  return NextResponse.json({
    id: photo.id,
    inspectionItemId: photo.inspectionItemId,
    fileName: photo.fileName,
    fileSize: photo.fileSize,
    fileType: photo.fileType,
    uploadedAt: photo.uploadedAt,
  });
}
