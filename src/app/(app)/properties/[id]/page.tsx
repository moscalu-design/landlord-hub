import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ArchivePropertyForm } from "@/components/properties/ArchivePropertyForm";
import { PropertyCostsSummary } from "@/components/properties/PropertyCostsSummary";
import { PropertyMortgageSummary } from "@/components/properties/PropertyMortgageSummary";
import { PropertyPerformanceChart } from "@/components/properties/PropertyPerformanceChart";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import { buildChartData } from "@/components/properties/propertyPerformanceData";
import { RoomStatusBadge } from "@/components/shared/StatusBadge";
import { getMonthlyCostForMonth } from "@/lib/mortgage";
import { getExpenseTotalForMonth } from "@/lib/expenses";
import { getDisplayRoomStatus, summarizeRooms } from "@/lib/roomOccupancy";
import prisma from "@/lib/prisma";
import { computePaymentStatus, formatCurrency, formatDate, toDateInputValue } from "@/lib/utils";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const todayInputValue = toDateInputValue(now);

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
        mortgages: {
          include: {
            prepayments: {
              orderBy: { startDate: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
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

  const { totalRooms, occupiedRooms, vacantRooms, monthlyIncome } = summarizeRooms(property.rooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Monthly costs = expenses for this month (recurring + one-off) + active mortgage payments
  const monthlyExpenses = getExpenseTotalForMonth(property.expenses, thisYear, thisMonth);

  const monthlyMortgages = property.mortgages
    .reduce((sum, mortgage) => sum + getMonthlyCostForMonth(mortgage, thisYear, thisMonth), 0);

  // Monthly profit = income - costs (expenses + mortgages)
  const monthlyProfit = monthlyIncome - monthlyExpenses - monthlyMortgages;

  // Chart data (mortgages included in costs)
  const chartData = buildChartData(property.expenses, chartPayments, property.mortgages);

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
        backHref="/properties"
        backLabel="All properties"
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

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <PropertySubnav propertyId={id} active="overview" />

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div data-testid="property-summary-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div data-testid="property-summary-total-rooms" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Rooms</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalRooms}</p>
          </div>

          <div data-testid="property-summary-vacant" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vacant</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{vacantRooms}</p>
            {totalRooms > 0 && (
              <p className="text-xs text-slate-400 mt-1">{occupancyRate}% occupied</p>
            )}
          </div>

          <div data-testid="property-summary-income" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Income</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(monthlyIncome)}
            </p>
            <p className="text-xs text-slate-400 mt-1">contracted rent</p>
          </div>

          <div data-testid="property-summary-profit" className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Profit</p>
            <p
              data-testid="property-summary-profit-value"
              className={`text-2xl font-bold mt-1 ${
                monthlyProfit >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {formatCurrency(monthlyProfit)}
            </p>
            <p className="text-xs text-slate-400 mt-1">income − costs</p>
          </div>
        </div>

        {/* ── Financial performance chart ────────────────────────────────── */}
        <div id="financials">
          <PropertyPerformanceChart data={chartData} />
        </div>

        {/* ── Mortgages ─────────────────────────────────────────────────── */}
        <PropertyMortgageSummary propertyId={id} mortgages={property.mortgages} />

        {/* ── Costs summary ─────────────────────────────────────────────── */}
        <PropertyCostsSummary
          propertyId={id}
          expenses={property.expenses}
          currentYear={thisYear}
          currentMonth={thisMonth}
          todayInputValue={todayInputValue}
        />

        {/* ── Rooms ─────────────────────────────────────────────────────── */}
        <div id="rooms" data-testid="property-rooms-section" className="space-y-3">
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
                const currentPaymentStatus = currentPayment ? computePaymentStatus(currentPayment) : null;

                return (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    data-testid="room-link"
                    className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3.5 sm:px-5 hover:border-blue-300 hover:shadow-sm transition group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                          {room.name}
                        </h3>
                        <RoomStatusBadge status={getDisplayRoomStatus(room)} size="sm" />
                      </div>
                      {activeOccupancy ? (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {activeOccupancy.tenant.firstName}{" "}
                          {activeOccupancy.tenant.lastName}
                          {" · "}Since {formatDate(activeOccupancy.leaseStart)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">Vacant</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatCurrency(room.monthlyRent)}
                        </p>
                        <p className="text-xs text-slate-500">/ mo</p>
                      </div>
                      {currentPayment && (
                        <span
                          className={`hidden sm:inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                            currentPaymentStatus === "PAID"
                              ? "bg-green-100 text-green-800"
                              : currentPaymentStatus === "OVERDUE"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {currentPaymentStatus === "PAID"
                            ? "Paid"
                            : currentPaymentStatus === "OVERDUE"
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
      </div>
    </div>
  );
}
