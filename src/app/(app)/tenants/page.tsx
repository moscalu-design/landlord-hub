import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

async function getTenants() {
  return prisma.tenant.findMany({
    include: {
      occupancies: {
        where: { status: "ACTIVE" },
        include: { room: { include: { property: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Tenants"
        description={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        actions={
          <Link
            href="/tenants/new"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + Add Tenant
          </Link>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        {tenants.length === 0 ? (
          <EmptyState
            title="No tenants yet"
            description="Add your first tenant profile."
            action={
              <Link href="/tenants/new" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                Add Tenant
              </Link>
            }
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {tenants.map((tenant) => {
                const activeOccupancy = tenant.occupancies[0];
                return (
                  <Link
                    key={tenant.id}
                    href={`/tenants/${tenant.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 transition hover:border-blue-300"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                      {tenant.firstName[0]}{tenant.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 truncate">
                          {tenant.firstName} {tenant.lastName}
                        </p>
                        <TenantStatusBadge status={tenant.status} size="sm" />
                      </div>
                      {activeOccupancy ? (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {activeOccupancy.room.property.name} · {activeOccupancy.room.name}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">Unassigned</p>
                      )}
                      {tenant.email && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{tenant.email}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/40 md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Tenant</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Room</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Email</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Phone</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenants.map((tenant) => {
                      const activeOccupancy = tenant.occupancies[0];
                      return (
                        <tr key={tenant.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Link href={`/tenants/${tenant.id}`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs shrink-0">
                                {tenant.firstName[0]}{tenant.lastName[0]}
                              </div>
                              <span className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">
                                {tenant.firstName} {tenant.lastName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {activeOccupancy ? (
                              <Link href={`/rooms/${activeOccupancy.room.id}`} className="hover:text-blue-600">
                                {activeOccupancy.room.property.name} · {activeOccupancy.room.name}
                              </Link>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{tenant.email}</td>
                          <td className="px-5 py-3 text-slate-500">{tenant.phone ?? "—"}</td>
                          <td className="px-5 py-3">
                            <TenantStatusBadge status={tenant.status} size="sm" />
                          </td>
                          <td className="px-5 py-3 text-slate-500">
                            {activeOccupancy ? formatDate(activeOccupancy.leaseStart) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
