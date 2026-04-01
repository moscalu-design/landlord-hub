import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function escapeCsv(value: string | null | undefined) {
  const stringValue = value ?? "";
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }
  return stringValue;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const room = await prisma.room.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { occupancy: { roomId: id } },
    include: {
      occupancy: {
        include: {
          tenant: true,
        },
      },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { dueDate: "desc" }],
  });

  const rows = [
    [
      "Room",
      "Payer Name",
      "Period",
      "Amount Due",
      "Amount Paid",
      "Date Paid",
      "Payment Method",
      "Status",
      "Reference",
      "Notes",
    ],
    ...payments.map((payment) => [
      room.name,
      `${payment.occupancy.tenant.firstName} ${payment.occupancy.tenant.lastName}`,
      `${payment.periodYear}-${String(payment.periodMonth).padStart(2, "0")}`,
      String(payment.amountDue),
      String(payment.amountPaid),
      payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : "",
      payment.paymentMethod?.replaceAll("_", " ") ?? "",
      payment.status,
      payment.reference ?? "",
      payment.notes ?? "",
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => escapeCsv(value)).join(","))
    .join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        `${room.name}-payment-history.csv`
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
