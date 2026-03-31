import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { RoomStatusBadge, PaymentStatusBadge, DepositStatusBadge } from "@/components/shared/StatusBadge";
import { RecordPaymentForm } from "@/components/payments/RecordPaymentForm";
import { AssignTenantForm } from "@/components/rooms/AssignTenantForm";
import { endOccupancy } from "@/actions/occupancies";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";

// We show the last 12 months of payments
function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      property: true,
      occupancies: {
        include: {
          tenant: true,
          deposit: { include: { transactions: { orderBy: { date: "desc" } } } },
          payments: {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 24,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!room) notFound();

  const activeOccupancy = room.occupancies.find((o) => o.status === "ACTIVE");
  const pastOccupancies = room.occupancies.filter((o) => o.status !== "ACTIVE");

  // Tenants available to assign (no active occupancy)
  const availableTenants = await prisma.tenant.findMany({
    where: {
      status: "ACTIVE",
      occupancies: { none: { status: "ACTIVE" } },
    },
    orderBy: { firstName: "asc" },
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={room.name}
        description={`${room.property.name} · ${room.property.address}`}
        actions={
          <div className="flex items-center gap-2">
            <RoomStatusBadge status={room.status} />
            <Link
              href={`/rooms/${id}/edit`}
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Edit Room
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Room info strip */}
        <div className="flex items-center gap-6 bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">Monthly Rent</p>
            <p className="text-base font-bold text-slate-800">{formatCurrency(room.monthlyRent)}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-500">Deposit</p>
            <p className="text-base font-bold text-slate-800">{formatCurrency(room.depositAmount)}</p>
          </div>
          {room.sizeM2 && (
            <>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-xs text-slate-500">Size</p>
                <p className="text-base font-bold text-slate-800">{room.sizeM2} m²</p>
              </div>
            </>
          )}
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-500">Furnished</p>
            <p className="text-base font-bold text-slate-800">{room.furnished ? "Yes" : "No"}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-500">Private Bathroom</p>
            <p className="text-base font-bold text-slate-800">{room.privateBathroom ? "Yes" : "No"}</p>
          </div>
        </div>

        {/* Current Tenant or Assign */}
        {activeOccupancy ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tenant + Lease */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Current Tenant</h2>
                <form
                  action={endOccupancy.bind(null, activeOccupancy.id)}
                  onSubmit={(e) => {
                    if (!confirm("End this tenancy? This will mark the room as vacant.")) {
                      e.preventDefault();
                    }
                  }}
                >
                  <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium">
                    End Tenancy
                  </button>
                </form>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                  {activeOccupancy.tenant.firstName[0]}{activeOccupancy.tenant.lastName[0]}
                </div>
                <div>
                  <Link
                    href={`/tenants/${activeOccupancy.tenantId}`}
                    className="font-medium text-slate-800 hover:text-blue-600 transition-colors text-sm"
                  >
                    {activeOccupancy.tenant.firstName} {activeOccupancy.tenant.lastName}
                  </Link>
                  {activeOccupancy.tenant.email && (
                    <p className="text-xs text-slate-500">{activeOccupancy.tenant.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Lease Start</span>
                  <span className="font-medium text-slate-700">{formatDate(activeOccupancy.leaseStart)}</span>
                </div>
                {activeOccupancy.leaseEnd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Lease End</span>
                    <span className="font-medium text-slate-700">{formatDate(activeOccupancy.leaseEnd)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Monthly Rent</span>
                  <span className="font-medium text-slate-700">{formatCurrency(activeOccupancy.monthlyRent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Rent Due Day</span>
                  <span className="font-medium text-slate-700">{activeOccupancy.rentDueDay}th of month</span>
                </div>
              </div>
            </div>

            {/* Deposit */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Deposit</h2>
                {activeOccupancy.deposit && (
                  <DepositStatusBadge status={activeOccupancy.deposit.status} size="sm" />
                )}
              </div>

              {activeOccupancy.deposit ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Required</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(activeOccupancy.deposit.required)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Received</span>
                      <span className="font-semibold text-green-700">{formatCurrency(activeOccupancy.deposit.received)}</span>
                    </div>
                    {activeOccupancy.deposit.receivedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Date Received</span>
                        <span className="text-slate-700">{formatDate(activeOccupancy.deposit.receivedAt)}</span>
                      </div>
                    )}
                  </div>

                  {activeOccupancy.deposit.transactions.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-600 mb-2">Transactions</p>
                      <div className="space-y-1.5">
                        {activeOccupancy.deposit.transactions.map((tx) => (
                          <div key={tx.id} className="flex justify-between text-xs">
                            <span className="text-slate-500">{tx.type} · {formatDate(tx.date)}</span>
                            <span className={`font-medium ${tx.type === "DEDUCTION" ? "text-red-600" : tx.type === "REFUND" ? "text-orange-600" : "text-green-600"}`}>
                              {tx.type === "DEDUCTION" || tx.type === "REFUND" ? "−" : "+"}
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No deposit record</p>
              )}
            </div>

            {/* Record Payment (current month) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Record Payment</h2>
              <RecordPaymentForm
                occupancyId={activeOccupancy.id}
                currentYear={currentYear}
                currentMonth={currentMonth}
                payments={activeOccupancy.payments}
              />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Assign Tenant</h2>
            {availableTenants.length > 0 ? (
              <AssignTenantForm roomId={id} tenants={availableTenants} defaultRent={room.monthlyRent} defaultDeposit={room.depositAmount} />
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">No available tenants.</p>
                <Link href="/tenants/new" className="text-sm text-blue-600 font-medium hover:text-blue-700">
                  Create a tenant first →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Payment Ledger */}
        {activeOccupancy && activeOccupancy.payments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Period</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Due</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Paid</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date Paid</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Method</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeOccupancy.payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {formatMonthYear(payment.periodYear, payment.periodMonth)}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{formatCurrency(payment.amountDue)}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {payment.amountPaid > 0 ? formatCurrency(payment.amountPaid) : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(payment.paidAt)}</td>
                      <td className="px-5 py-3 text-slate-500">{payment.paymentMethod?.replace("_", " ") ?? "—"}</td>
                      <td className="px-5 py-3">
                        <PaymentStatusBadge status={payment.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {room.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">Room Notes</p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{room.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
