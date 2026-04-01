import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ArchivePropertyForm } from "@/components/properties/ArchivePropertyForm";
import { PropertyExpensesSection } from "@/components/properties/PropertyExpensesSection";
import { PropertyPerformanceChart } from "@/components/properties/PropertyPerformanceChart";
import { buildChartData } from "@/components/properties/propertyPerformanceData";
import { RoomStatusBadge } from "@/components/shared/StatusBadge";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // Last 12 months for chart query
  const chartMonthFilter = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { periodYear: d.getFullYear(), periodMonth: d.getMonth() + 1 };
  });

  const [property, chartPayments] = await Promise.all([
    prisma.property.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            occupancies: {
              where: { status: "ACTIVE" },
              include: {
                tenant: true,
                payments: {
                  where: { periodYear: thisYear, periodMonth: thisMonth },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        },
        expenses: {
          orderBy: [
            { reportingYear: "desc" },
            { reportingMonth: "desc" },
            { paymentDate: "desc" },
          ],
        },
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        occupancy: { room: { propertyId: id } },
        OR: chartMonthFilter,
      },
      select: { periodYear: true, periodMonth: true, amountDue: true },
    }),
  ]);

  if (!property) notFound();

  const totalRooms = property.rooms.length;
  const vacantRooms = property.rooms.filter((r) => r.status === "VACANT").length;
  const occupancyRate =
    totalRooms > 0 ? Math.round(((totalRooms - vacantRooms) / totalRooms) * 100) : 0;

  // Monthly income = sum of rent for occupied rooms (contracted, current month)
  const monthlyIncome = property.rooms
    .filter((r) => r.status === "OCCUPIED")
    .reduce((sum, r) => sum + r.monthlyRent, 0);

  // Monthly costs = expenses bucketed to this month
  const monthlyExpenses = property.expenses
    .filter((e) => e.reportingYear === thisYear && e.reportingMonth === thisMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  // Monthly profit = income - costs
  const monthlyProfit = monthlyIncome - monthlyExpenses;

  // Chart data
  const chartData = buildChartData(property.expenses, chartPayments);

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
        actions={
          <>
            <ArchivePropertyForm propertyId={id} />
            <Link
              href={`/properties/${id}/edit`}
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Edit Property
            </Link>
          </>
        }
      />

      <div className="flex-1 p-6 space-y-6">

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div data-testid="property-summary-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div data-testid="property-summary-total-rooms" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">{totalRooms}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Rooms</p>
          </div>

          <div data-testid="property-summary-vacant" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">{vacantRooms}</p>
            <p className="text-xs text-slate-500 mt-0.5">Vacant</p>
            {totalRooms > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{occupancyRate}% occupied</p>
            )}
          </div>

          <div data-testid="property-summary-income" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(monthlyIncome)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Monthly Income</p>
            <p className="text-xs text-slate-400 mt-0.5">contracted rent</p>
          </div>

          <div data-testid="property-summary-profit" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p
              data-testid="property-summary-profit-value"
              className={`text-2xl font-bold ${
                monthlyProfit >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(monthlyProfit)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Monthly Profit</p>
            <p className="text-xs text-slate-400 mt-0.5">income − costs</p>
          </div>
        </div>

        {/* ── Financial performance chart ────────────────────────────────── */}
        <PropertyPerformanceChart data={chartData} />

        {/* ── Utilities & Costs ─────────────────────────────────────────── */}
        <PropertyExpensesSection propertyId={id} expenses={property.expenses} />

        {/* ── Rooms + Activity ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Rooms */}
          <div data-testid="property-rooms-section" className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Rooms</h2>
              <Link
                href={`/properties/${id}/rooms/new`}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Room
              </Link>
            </div>

            {property.rooms.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-500">No rooms yet.</p>
                <Link
                  href={`/properties/${id}/rooms/new`}
                  className="mt-3 inline-block text-sm text-blue-600 font-medium"
                >
                  Add first room →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {property.rooms.map((room) => {
                  const activeOccupancy = room.occupancies[0];
                  const currentPayment = activeOccupancy?.payments[0];

                  return (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.id}`}
                      data-testid="room-link"
                      className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3.5 hover:border-blue-300 hover:shadow-sm transition group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                            {room.name}
                          </h3>
                          <RoomStatusBadge status={room.status} size="sm" />
                        </div>
                        {activeOccupancy ? (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {activeOccupancy.tenant.firstName}{" "}
                            {activeOccupancy.tenant.lastName}
                            {" · "}Since {formatDate(activeOccupancy.leaseStart)}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">Vacant</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatCurrency(room.monthlyRent)}
                          </p>
                          <p className="text-xs text-slate-500">/ mo</p>
                        </div>
                        {currentPayment && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              currentPayment.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : currentPayment.status === "OVERDUE"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {currentPayment.status === "PAID"
                              ? "Paid"
                              : currentPayment.status === "OVERDUE"
                              ? "Overdue"
                              : "Unpaid"}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-700">Recent Activity</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {property.activityLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No activity yet
                  </p>
                ) : (
                  property.activityLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3">
                      <p className="text-xs text-slate-700 leading-snug">
                        {log.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
