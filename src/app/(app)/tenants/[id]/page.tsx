import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TenantStatusBadge, PaymentStatusBadge, DepositStatusBadge } from "@/components/shared/StatusBadge";
import { DocumentsSection } from "@/components/documents/DocumentsSection";
import { DeleteTenantForm } from "@/components/tenants/DeleteTenantForm";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tenant, rawDocs] = await Promise.all([
    prisma.tenant.findUnique({
    where: { id },
    include: {
      occupancies: {
        include: {
          room: { include: { property: true } },
          deposit: true,
          payments: {
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            take: 24,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  }),
    prisma.tenantDocument.findMany({
      where: { tenantId: id },
      select: { id: true, type: true, fileName: true, fileSize: true, uploadedAt: true },
    }),
  ]);

  if (!tenant) notFound();

  // Build a map keyed by type — storageUrl is intentionally excluded
  type DocType = "idDocument" | "workContract" | "salarySlip";
  const documents = Object.fromEntries(
    rawDocs.map((d) => [d.type, { id: d.id, fileName: d.fileName, fileSize: d.fileSize, uploadedAt: d.uploadedAt }])
  ) as Partial<Record<DocType, { id: string; fileName: string; fileSize: number; uploadedAt: Date }>>;

  const activeOccupancy = tenant.occupancies.find((o) => o.status === "ACTIVE");
  const pastOccupancies = tenant.occupancies.filter((o) => o.status !== "ACTIVE");

  const totalPaid = tenant.occupancies
    .flatMap((o) => o.payments)
    .reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={`${tenant.firstName} ${tenant.lastName}`}
        description={tenant.email}
        actions={
          <div className="flex items-center gap-2">
            {activeOccupancy && (
              <>
                <Link
                  href={`/properties/${activeOccupancy.room.propertyId}`}
                  data-testid="tenant-active-property-link"
                  className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Property
                </Link>
                <Link
                  href={`/rooms/${activeOccupancy.roomId}`}
                  data-testid="tenant-active-room-link"
                  className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Room
                </Link>
              </>
            )}
            <TenantStatusBadge status={tenant.status} />
            {!activeOccupancy && <DeleteTenantForm tenantId={id} />}
            <Link
              href={`/tenants/${id}/edit`}
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Edit
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                {tenant.firstName[0]}{tenant.lastName[0]}
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{tenant.firstName} {tenant.lastName}</h2>
                <p className="text-sm text-slate-500">{tenant.email}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-sm">
              {tenant.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-700">{tenant.phone}</span>
                </div>
              )}
              {tenant.nationality && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Nationality</span>
                  <span className="text-slate-700">{tenant.nationality}</span>
                </div>
              )}
              {tenant.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Date of Birth</span>
                  <span className="text-slate-700">{formatDate(tenant.dateOfBirth)}</span>
                </div>
              )}
              {tenant.emergencyContact && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500">Emergency Contact</span>
                  <span className="text-slate-700">{tenant.emergencyContact}</span>
                </div>
              )}
              {tenant.idType && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ID</span>
                  <span className="text-slate-700">{tenant.idType.replace("_", " ")} {tenant.idReference ? `· ${tenant.idReference}` : ""}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">Total Paid (all time)</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{formatCurrency(totalPaid)}</p>
            </div>
          </div>

          {/* Current Tenancy */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Current Tenancy</h2>
            {activeOccupancy ? (
              <>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Property</span>
                    <Link href={`/properties/${activeOccupancy.room.propertyId}`} className="text-blue-600 hover:text-blue-700 font-medium">
                      {activeOccupancy.room.property.name}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room</span>
                    <Link href={`/rooms/${activeOccupancy.roomId}`} className="text-blue-600 hover:text-blue-700 font-medium">
                      {activeOccupancy.room.name}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lease Start</span>
                    <span className="text-slate-700">{formatDate(activeOccupancy.leaseStart)}</span>
                  </div>
                  {activeOccupancy.leaseEnd && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lease End</span>
                      <span className="text-slate-700">{formatDate(activeOccupancy.leaseEnd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly Rent</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(activeOccupancy.monthlyRent)}</span>
                  </div>
                </div>

                {activeOccupancy.deposit && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Deposit</span>
                      <DepositStatusBadge status={activeOccupancy.deposit.status} size="sm" />
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatCurrency(activeOccupancy.deposit.received)} / {formatCurrency(activeOccupancy.deposit.required)} received
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No active tenancy.</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Notes</h2>
            {tenant.notes ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{tenant.notes}</p>
            ) : (
              <p className="text-sm text-slate-400">No notes.</p>
            )}
          </div>
        </div>

        {/* Documents */}
        <DocumentsSection tenantId={id} initialDocuments={documents} />

        {/* Payment history */}
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
                    <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeOccupancy.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{formatMonthYear(p.periodYear, p.periodMonth)}</td>
                      <td className="px-5 py-3 text-slate-700">{formatCurrency(p.amountDue)}</td>
                      <td className="px-5 py-3 text-slate-700">{p.amountPaid > 0 ? formatCurrency(p.amountPaid) : "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(p.paidAt)}</td>
                      <td className="px-5 py-3"><PaymentStatusBadge status={p.status} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Past tenancies */}
        {pastOccupancies.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Past Tenancies</h2>
            <div className="space-y-2">
              {pastOccupancies.map((occ) => (
                <div key={occ.id} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <Link href={`/rooms/${occ.roomId}`} className="font-medium text-slate-700 hover:text-blue-600">
                      {occ.room.property.name} · {occ.room.name}
                    </Link>
                  </div>
                  <div className="text-slate-500">
                    {formatDate(occ.leaseStart)} → {occ.moveOutDate ? formatDate(occ.moveOutDate) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
