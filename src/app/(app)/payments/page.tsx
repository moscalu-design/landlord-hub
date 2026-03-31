import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";

async function getPaymentsData(year: number, month: number) {
  const payments = await prisma.payment.findMany({
    where: { periodYear: year, periodMonth: month },
    include: {
      occupancy: {
        include: {
          tenant: true,
          room: { include: { property: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }],
  });

  payments.sort((a, b) => a.occupancy.tenant.firstName.localeCompare(b.occupancy.tenant.firstName));

  const totalDue = payments.reduce((sum, p) => sum + p.amountDue, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalOutstanding = payments
    .filter((p) => !["PAID", "WAIVED"].includes(p.status))
    .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);

  return { payments, totalDue, totalPaid, totalOutstanding };
}

function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    let year = now.getFullYear();
    let month = now.getMonth() + 1 - i;
    if (month <= 0) { month += 12; year -= 1; }
    options.push({ year, month });
  }
  return options;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || (now.getMonth() + 1);
  const statusFilter = sp.status ?? "";

  const { payments, totalDue, totalPaid, totalOutstanding } = await getPaymentsData(year, month);

  const filtered = statusFilter
    ? payments.filter((p) => p.status === statusFilter)
    : payments;

  const monthOptions = buildMonthOptions();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Payments"
        description={`${formatMonthYear(year, month)} rent ledger`}
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Due</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalDue)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Collected</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Outstanding</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2">
            <select
              name="year"
              defaultValue={year}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map(({ year: y, month: m }) => (
                <option key={`${y}-${m}`} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              name="month"
              defaultValue={month}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map(({ year: y, month: m }) => (
                <option key={`${y}-${m}`} value={m}>
                  {formatMonthYear(y, m)}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={statusFilter}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="OVERDUE">Overdue</option>
              <option value="WAIVED">Waived</option>
            </select>

            <button
              type="submit"
              className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Room</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Due</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Paid</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date Paid</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Method</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                    No payments for this period.
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/tenants/${payment.occupancy.tenantId}`} className="font-medium text-slate-800 hover:text-blue-600">
                        {payment.occupancy.tenant.firstName} {payment.occupancy.tenant.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <Link href={`/rooms/${payment.occupancy.roomId}`} className="hover:text-blue-600">
                        {payment.occupancy.room.property.name} · {payment.occupancy.room.name}
                      </Link>
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
                    <td className="px-5 py-3">
                      <Link href={`/rooms/${payment.occupancy.roomId}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Record →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
