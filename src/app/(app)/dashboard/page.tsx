import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/shared/StatCard";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { summarizeRooms } from "@/lib/roomOccupancy";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getDashboardData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    properties,
    rooms,
    currentMonthPayments,
    recentActivity,
  ] = await Promise.all([
    prisma.property.findMany({ where: { status: { not: "ARCHIVED" } } }),
    prisma.room.findMany({
      where: { property: { status: { not: "ARCHIVED" } } },
      include: {
        occupancies: {
          where: { status: "ACTIVE" },
          select: { status: true, monthlyRent: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { periodYear: year, periodMonth: month },
      include: {
        occupancy: {
          include: {
            tenant: true,
            room: { include: { property: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { property: true, room: true, tenant: true },
    }),
  ]);

  const { totalRooms, occupiedRooms, vacantRooms } = summarizeRooms(rooms);

  const rentDue = currentMonthPayments
    .filter((p) => ["UNPAID", "PARTIAL", "OVERDUE"].includes(p.status))
    .reduce((sum, p) => sum + p.amountDue - p.amountPaid, 0);

  const rentReceived = currentMonthPayments
    .filter((p) => p.amountPaid > 0)
    .reduce((sum, p) => sum + p.amountPaid, 0);

  const overduePayments = currentMonthPayments.filter((p) => p.status === "OVERDUE");

  return {
    propertyCount: properties.length,
    totalRooms,
    occupiedRooms,
    vacantRooms,
    rentDue,
    rentReceived,
    overduePayments,
    currentMonthPayments,
    recentActivity,
    year,
    month,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const monthName = new Date(data.year, data.month - 1).toLocaleString("en-GB", { month: "long" });

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Dashboard"
        description={`Overview for ${monthName} ${data.year}`}
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Properties"
            value={data.propertyCount}
            sub="active"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          />
          <StatCard
            label="Occupied Rooms"
            value={`${data.occupiedRooms} / ${data.totalRooms}`}
            sub={`${data.vacantRooms} vacant`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
          />
          <StatCard
            label="Rent Received"
            value={formatCurrency(data.rentReceived)}
            sub={`${monthName}`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(data.rentDue)}
            sub={`${data.overduePayments.length} overdue`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* This month's payments */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">{monthName} Payments</h2>
              <Link href="/payments" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.currentMonthPayments.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No payments this month</p>
              ) : (
                data.currentMonthPayments.slice(0, 6).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {payment.occupancy.tenant.firstName} {payment.occupancy.tenant.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {payment.occupancy.room.property.name} · {payment.occupancy.room.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-medium text-slate-700">
                        {formatCurrency(payment.amountDue)}
                      </span>
                      <PaymentStatusBadge status={payment.status} size="sm" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No activity yet</p>
              ) : (
                data.recentActivity.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <p className="text-xs font-medium text-slate-700 leading-snug">{log.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(log.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/properties/new", label: "Add Property" },
            { href: "/tenants/new", label: "Add Tenant" },
            { href: "/payments", label: "Rent Ledger" },
            { href: "/properties", label: "Portfolio" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition text-center"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
