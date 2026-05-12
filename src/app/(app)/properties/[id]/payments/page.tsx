import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PropertyPaymentsTable, type PropertyPaymentRow } from "@/components/properties/PropertyPaymentsTable";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { ensureRentPaymentsForProperty } from "@/lib/billing";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency } from "@/lib/utils";

export default async function PropertyPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const propertyExists = await prisma.property.findUnique({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!propertyExists) notFound();

  await ensureRentPaymentsForProperty({ userId: user.id, propertyId: id });

  const property = await prisma.property.findUnique({
    where: { id, userId: user.id },
    include: {
      rooms: {
        include: {
          occupancies: {
            where: { status: "ACTIVE" },
            include: {
              tenant: true,
              payments: {
                orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!property) notFound();

  const isFullProperty = property.rentalMode === "FULL_PROPERTY";
  const payments: PropertyPaymentRow[] = property.rooms.flatMap((room) =>
    room.occupancies.flatMap((occupancy) =>
      occupancy.payments.map((payment) => ({
        id: payment.id,
        tenantName: `${occupancy.tenant.firstName} ${occupancy.tenant.lastName}`,
        // For whole-property rentals, hide the synthetic "Whole property" room
        // name and just label the unit. For room-level rentals, keep room names.
        roomName: isFullProperty || room.isDefaultWholePropertyRoom ? "Whole property" : room.name,
        periodYear: payment.periodYear,
        periodMonth: payment.periodMonth,
        amountDue: payment.amountDue,
        amountPaid: payment.amountPaid,
        dueDate: payment.dueDate.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
      }))
    )
  );

  const totals = payments.reduce(
    (acc, payment) => {
      const status = computePaymentStatus(payment);
      acc.due += payment.amountDue;
      acc.paid += payment.amountPaid;
      acc.outstanding += Math.max(0, payment.amountDue - payment.amountPaid);
      if (status === "OVERDUE") acc.overdue += Math.max(0, payment.amountDue - payment.amountPaid);
      return acc;
    },
    { due: 0, paid: 0, outstanding: 0, overdue: 0 }
  );

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={`${property.name} Payments`}
        description={`${property.address}, ${property.city}`}
        actions={
          <Link
            href={`/properties/${id}`}
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Property
          </Link>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <PropertySubnav propertyId={id} active="payments" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total due</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totals.due)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(totals.paid)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totals.outstanding)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overdue</p>
              {totals.overdue > 0 && <PaymentStatusBadge status="OVERDUE" size="sm" />}
            </div>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          </div>
        </div>

        <PropertyPaymentsTable payments={payments} />
      </div>
    </div>
  );
}
