import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

export type InspectionReportPhoto = {
  id: string;
  fileName: string;
  fileType: string;
  inspectionItemId: string | null;
  bytes?: Uint8Array;
};

export type InspectionReportItem = {
  id: string;
  itemName: string;
  condition: string;
  quantity: number;
  notes: string | null;
};

export type InspectionReportData = {
  property: {
    name: string | null;
    address: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
  room: { name: string | null } | null;
  tenant: { firstName: string; lastName: string } | null;
  inspection: {
    id: string;
    type: string; // CHECK_IN | CHECK_OUT | other
    date: Date | string;
    notes: string | null;
  };
  items: InspectionReportItem[];
  photos: InspectionReportPhoto[];
};

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLORS = {
  text: rgb(0.12, 0.16, 0.22),
  muted: rgb(0.45, 0.5, 0.56),
  border: rgb(0.85, 0.87, 0.91),
  headerBg: rgb(0.96, 0.97, 0.99),
  accent: rgb(0.15, 0.39, 0.92),
};

const CONDITION_TEXT: Record<string, string> = {
  NEW: "New",
  GOOD: "Good",
  FAIR: "Fair",
  WORN: "Worn",
  DAMAGED: "Damaged",
  MISSING: "Missing",
};

function conditionColor(condition: string) {
  switch (condition) {
    case "NEW":
      return rgb(0.15, 0.39, 0.92);
    case "GOOD":
      return rgb(0.13, 0.55, 0.33);
    case "FAIR":
      return rgb(0.73, 0.56, 0.14);
    case "WORN":
      return rgb(0.83, 0.49, 0.14);
    case "DAMAGED":
      return rgb(0.79, 0.25, 0.25);
    case "MISSING":
    default:
      return rgb(0.4, 0.45, 0.52);
  }
}

export function formatReportDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function buildReportFilename(data: InspectionReportData): string {
  const rawName =
    data.property?.name ||
    data.property?.address ||
    data.room?.name ||
    "report";
  const slug =
    rawName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "report";
  const dt = new Date(data.inspection.date);
  const iso = Number.isNaN(dt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : dt.toISOString().slice(0, 10);
  return `inspection-report-${slug}-${iso}.pdf`;
}

// Wrap text by measured width. Returns an array of visual lines.
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(candidate, size);
      if (w <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      // Word itself longer than max width → hard-break.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let remainder = word;
        while (remainder) {
          let cut = remainder.length;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(remainder.slice(0, cut), size) > maxWidth
          ) {
            cut -= 1;
          }
          out.push(remainder.slice(0, cut));
          remainder = remainder.slice(cut);
        }
      } else {
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

class PageWriter {
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  page: PDFPage;
  y: number;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = this.addPage();
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private addPage(): PDFPage {
    return this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  ensureSpace(required: number) {
    if (this.y - required < MARGIN_BOTTOM) {
      this.page = this.addPage();
      this.y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  moveDown(v: number) {
    this.y -= v;
  }

  drawText(text: string, opts: {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    x?: number;
  } = {}) {
    const font = opts.font ?? this.font;
    const size = opts.size ?? 10;
    const color = opts.color ?? COLORS.text;
    const x = opts.x ?? MARGIN_X;
    this.page.drawText(text, { x, y: this.y, font, size, color });
  }

  drawLine(opts: { color?: ReturnType<typeof rgb>; thickness?: number } = {}) {
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y },
      thickness: opts.thickness ?? 0.5,
      color: opts.color ?? COLORS.border,
    });
  }

  drawWrapped(
    text: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      lineGap?: number;
      maxWidth?: number;
      x?: number;
    } = {}
  ): number {
    const font = opts.font ?? this.font;
    const size = opts.size ?? 10;
    const color = opts.color ?? COLORS.text;
    const lineHeight = size + (opts.lineGap ?? 3);
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const x = opts.x ?? MARGIN_X;
    const lines = wrapText(text, font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, { x, y: this.y, font, size, color });
      this.y -= lineHeight;
    }
    return lines.length * lineHeight;
  }
}

async function tryEmbedImage(
  doc: PDFDocument,
  photo: InspectionReportPhoto
): Promise<PDFImage | null> {
  if (!photo.bytes || photo.bytes.length === 0) return null;
  const type = (photo.fileType || "").toLowerCase();
  try {
    if (type === "image/jpeg" || type === "image/jpg" || /\.jpe?g$/i.test(photo.fileName)) {
      return await doc.embedJpg(photo.bytes);
    }
    if (type === "image/png" || /\.png$/i.test(photo.fileName)) {
      return await doc.embedPng(photo.bytes);
    }
  } catch {
    return null;
  }
  return null;
}

async function drawPhotoRow(
  writer: PageWriter,
  photos: { photo: InspectionReportPhoto; image: PDFImage | null }[]
) {
  if (photos.length === 0) return;

  const perRow = 3;
  const gap = 10;
  const cellWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
  const maxPhotoHeight = 110;

  for (let i = 0; i < photos.length; i += perRow) {
    const row = photos.slice(i, i + perRow);
    writer.ensureSpace(maxPhotoHeight + 24);
    const rowTopY = writer.y;
    let rowMaxHeight = 0;

    row.forEach((entry, idx) => {
      const x = MARGIN_X + idx * (cellWidth + gap);
      const { image, photo } = entry;

      if (image) {
        const scale = Math.min(cellWidth / image.width, maxPhotoHeight / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;
        writer.page.drawImage(image, {
          x: x + (cellWidth - w) / 2,
          y: rowTopY - h,
          width: w,
          height: h,
        });
        rowMaxHeight = Math.max(rowMaxHeight, h);
      } else {
        // Placeholder box for unsupported image format.
        const boxH = 64;
        writer.page.drawRectangle({
          x,
          y: rowTopY - boxH,
          width: cellWidth,
          height: boxH,
          borderColor: COLORS.border,
          borderWidth: 0.5,
          color: COLORS.headerBg,
        });
        writer.page.drawText("Preview unavailable", {
          x: x + 6,
          y: rowTopY - 24,
          size: 8,
          font: writer.font,
          color: COLORS.muted,
        });
        writer.page.drawText(`(${photo.fileType || "image"})`, {
          x: x + 6,
          y: rowTopY - 38,
          size: 8,
          font: writer.font,
          color: COLORS.muted,
        });
        rowMaxHeight = Math.max(rowMaxHeight, boxH);
      }

      // Caption under each photo.
      const captionLines = wrapText(photo.fileName, writer.font, 7, cellWidth);
      const caption = captionLines[0] ?? "";
      writer.page.drawText(caption, {
        x,
        y: rowTopY - rowMaxHeight - 10,
        size: 7,
        font: writer.font,
        color: COLORS.muted,
      });
    });

    writer.y = rowTopY - rowMaxHeight - 20;
  }
}

function drawHeaderBlock(writer: PageWriter, data: InspectionReportData) {
  const { inspection, property, room, tenant } = data;

  writer.drawText("Inspection Report", {
    font: writer.bold,
    size: 20,
    color: COLORS.text,
  });
  writer.moveDown(26);

  const typeLabel =
    inspection.type === "CHECK_IN"
      ? "Check-in"
      : inspection.type === "CHECK_OUT"
      ? "Check-out"
      : inspection.type;

  writer.drawText(`${typeLabel} · ${formatReportDate(inspection.date)}`, {
    size: 11,
    color: COLORS.muted,
  });
  writer.moveDown(18);

  writer.drawLine();
  writer.moveDown(10);

  const addressParts = [
    property?.address,
    property?.city,
    property?.postcode,
  ].filter((p): p is string => Boolean(p && p.trim()));

  const rows: [string, string][] = [
    ["Property", property?.name ?? "—"],
    ["Address", addressParts.length > 0 ? addressParts.join(", ") : "—"],
    ["Room", room?.name ?? "—"],
    [
      "Tenant",
      tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : "—",
    ],
    ["Inspection type", typeLabel],
    ["Date", formatReportDate(inspection.date)],
  ];

  const labelWidth = 88;
  for (const [label, value] of rows) {
    writer.ensureSpace(14);
    writer.page.drawText(label, {
      x: MARGIN_X,
      y: writer.y,
      font: writer.bold,
      size: 10,
      color: COLORS.muted,
    });
    const valueLines = wrapText(
      value,
      writer.font,
      10,
      CONTENT_WIDTH - labelWidth
    );
    const firstLine = valueLines[0] ?? "—";
    writer.page.drawText(firstLine, {
      x: MARGIN_X + labelWidth,
      y: writer.y,
      font: writer.font,
      size: 10,
      color: COLORS.text,
    });
    writer.y -= 14;
    for (let i = 1; i < valueLines.length; i++) {
      writer.ensureSpace(14);
      writer.page.drawText(valueLines[i], {
        x: MARGIN_X + labelWidth,
        y: writer.y,
        font: writer.font,
        size: 10,
        color: COLORS.text,
      });
      writer.y -= 14;
    }
  }

  if (inspection.notes && inspection.notes.trim()) {
    writer.moveDown(6);
    writer.drawText("Notes", {
      font: writer.bold,
      size: 10,
      color: COLORS.muted,
    });
    writer.moveDown(14);
    writer.drawWrapped(inspection.notes, { size: 10, color: COLORS.text });
  }

  writer.moveDown(4);
  writer.drawLine();
  writer.moveDown(14);
}

async function drawItemsSection(
  writer: PageWriter,
  data: InspectionReportData,
  embeddedPhotosByItem: Map<string | null, { photo: InspectionReportPhoto; image: PDFImage | null }[]>
) {
  writer.drawText("Inspection Items", {
    font: writer.bold,
    size: 13,
    color: COLORS.text,
  });
  writer.moveDown(18);

  if (data.items.length === 0) {
    writer.drawText("No items recorded for this inspection.", {
      size: 10,
      color: COLORS.muted,
    });
    writer.moveDown(14);
    return;
  }

  for (const item of data.items) {
    writer.ensureSpace(60);
    // Item name + condition line.
    const conditionLabel =
      CONDITION_TEXT[item.condition] ?? item.condition ?? "—";
    const qtyLabel = item.quantity > 1 ? ` · ×${item.quantity}` : "";

    writer.page.drawText(item.itemName || "Item", {
      x: MARGIN_X,
      y: writer.y,
      font: writer.bold,
      size: 11,
      color: COLORS.text,
    });

    const conditionText = `${conditionLabel}${qtyLabel}`;
    const condWidth = writer.bold.widthOfTextAtSize(conditionText, 10);
    writer.page.drawText(conditionText, {
      x: MARGIN_X + CONTENT_WIDTH - condWidth,
      y: writer.y,
      font: writer.bold,
      size: 10,
      color: conditionColor(item.condition),
    });
    writer.y -= 14;

    if (item.notes && item.notes.trim()) {
      writer.drawWrapped(item.notes, {
        size: 9,
        color: COLORS.muted,
      });
    }

    const photos = embeddedPhotosByItem.get(item.id) ?? [];
    if (photos.length > 0) {
      writer.moveDown(4);
      await drawPhotoRow(writer, photos);
    } else {
      writer.moveDown(4);
    }

    writer.ensureSpace(12);
    writer.drawLine({ color: COLORS.border });
    writer.moveDown(12);
  }

  const general = embeddedPhotosByItem.get(null) ?? [];
  if (general.length > 0) {
    writer.ensureSpace(40);
    writer.drawText("General photos", {
      font: writer.bold,
      size: 12,
      color: COLORS.text,
    });
    writer.moveDown(16);
    await drawPhotoRow(writer, general);
  }
}

function drawSignatureSection(writer: PageWriter) {
  const blockHeight = 150;
  writer.ensureSpace(blockHeight + 40);

  writer.drawText("Signatures", {
    font: writer.bold,
    size: 13,
    color: COLORS.text,
  });
  writer.moveDown(22);

  const colWidth = (CONTENT_WIDTH - 24) / 2;
  const startY = writer.y;

  const drawColumn = (xOffset: number, role: string) => {
    const x = MARGIN_X + xOffset;
    let cy = startY;

    writer.page.drawText(role, {
      x,
      y: cy,
      font: writer.bold,
      size: 10,
      color: COLORS.text,
    });
    cy -= 32;

    // Signature line.
    writer.page.drawLine({
      start: { x, y: cy },
      end: { x: x + colWidth, y: cy },
      thickness: 0.75,
      color: COLORS.text,
    });
    writer.page.drawText("Signature", {
      x,
      y: cy - 10,
      font: writer.font,
      size: 8,
      color: COLORS.muted,
    });
    cy -= 36;

    // Printed name line.
    writer.page.drawLine({
      start: { x, y: cy },
      end: { x: x + colWidth, y: cy },
      thickness: 0.5,
      color: COLORS.border,
    });
    writer.page.drawText("Printed name", {
      x,
      y: cy - 10,
      font: writer.font,
      size: 8,
      color: COLORS.muted,
    });
    cy -= 32;

    // Date line.
    writer.page.drawLine({
      start: { x, y: cy },
      end: { x: x + colWidth, y: cy },
      thickness: 0.5,
      color: COLORS.border,
    });
    writer.page.drawText("Date", {
      x,
      y: cy - 10,
      font: writer.font,
      size: 8,
      color: COLORS.muted,
    });
  };

  drawColumn(0, "Landlord / Manager");
  drawColumn(colWidth + 24, "Tenant");

  writer.y = startY - blockHeight;
}

function drawFooter(writer: PageWriter) {
  const pages = writer.doc.getPages();
  const totalCount = pages.length;
  pages.forEach((page, idx) => {
    page.drawText(`Page ${idx + 1} of ${totalCount}`, {
      x: PAGE_WIDTH - MARGIN_X - 60,
      y: 24,
      font: writer.font,
      size: 8,
      color: COLORS.muted,
    });
    page.drawText(
      `Generated ${new Date().toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`,
      {
        x: MARGIN_X,
        y: 24,
        font: writer.font,
        size: 8,
        color: COLORS.muted,
      }
    );
  });
}

export async function buildInspectionReportPdf(
  data: InspectionReportData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Inspection Report");
  doc.setCreator("Rental Management App");
  doc.setProducer("Rental Management App");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const writer = new PageWriter(doc, font, bold);

  drawHeaderBlock(writer, data);

  // Pre-embed all photos we can.
  const embeddedByItem = new Map<
    string | null,
    { photo: InspectionReportPhoto; image: PDFImage | null }[]
  >();
  for (const photo of data.photos) {
    const image = await tryEmbedImage(doc, photo);
    const key = photo.inspectionItemId ?? null;
    const list = embeddedByItem.get(key) ?? [];
    list.push({ photo, image });
    embeddedByItem.set(key, list);
  }

  await drawItemsSection(writer, data, embeddedByItem);

  writer.moveDown(16);
  drawSignatureSection(writer);

  drawFooter(writer);

  return await doc.save();
}
