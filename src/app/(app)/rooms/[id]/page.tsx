import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { RoomStatusBadge, DepositStatusBadge } from "@/components/shared/StatusBadge";
import { RecordPaymentForm } from "@/components/payments/RecordPaymentForm";
import { AssignTenantForm } from "@/components/rooms/AssignTenantForm";
import { ContractUpload } from "@/components/rooms/ContractUpload";
import { DepositManager } from "@/components/rooms/DepositManager";
import {
  PaymentHistorySection,
  type RoomPaymentHistoryRow,
} from "@/components/rooms/PaymentHistorySection";
import { DeleteRoomForm } from "@/components/rooms/DeleteRoomForm";
import { EndTenancyForm } from "@/components/rooms/EndTenancyForm";
import { summarizeDepositTransactions } from "@/lib/depositUtils";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const paymentHistory: RoomPaymentHistoryRow[] = room.occupancies
    .flatMap((occupancy) =>
      occupancy.payments.map((payment) => ({
        id: payment.id,
        payerName: `${occupancy.tenant.firstName} ${occupancy.tenant.lastName}`,
        periodYear: payment.periodYear,
        periodMonth: payment.periodMonth,
        amountDue: payment.amountDue,
        amountPaid: payment.amountPaid,
        paidAt: payment.paidAt,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
      }))
    )
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear;
      if (a.periodMonth !== b.periodMonth) return b.periodMonth - a.periodMonth;
      return 0;
    });

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
            {!activeOccupancy && (
              <DeleteRoomForm roomId={id} propertyId={room.propertyId} />
            )}
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
        <div data-testid="room-info-strip" className="flex items-center gap-6 bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">Monthly Rent</p>
            <p className="text-base font-bold text-slate-800">{formatCurrency(room.monthlyRent)}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-500">Deposit</p>
            <p data-testid="room-default-deposit-value" className="text-base font-bold text-slate-800">{formatCurrency(room.depositAmount)}</p>
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
            <div data-testid="room-current-tenant-card" className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Current Tenant</h2>
                <EndTenancyForm occupancyId={activeOccupancy.id} />
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/tenants/${activeOccupancy.tenantId}`}
                  data-testid="room-tenant-avatar-link"
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0 hover:bg-blue-200 transition-colors"
                  aria-label={`Open tenant ${activeOccupancy.tenant.firstName} ${activeOccupancy.tenant.lastName}`}
                >
                  {activeOccupancy.tenant.firstName[0]}{activeOccupancy.tenant.lastName[0]}
                </Link>
                <div>
                  <Link
                    href={`/tenants/${activeOccupancy.tenantId}`}
                    data-testid="room-tenant-name-link"
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

              <div className="pt-2 border-t border-slate-100">
                <ContractUpload
                  occupancyId={activeOccupancy.id}
                  contractFileName={activeOccupancy.contractFileName}
                  contractFileSize={activeOccupancy.contractFileSize}
                  contractUploadedAt={activeOccupancy.contractUploadedAt}
                />
              </div>
            </div>

            {/* Deposit */}
            <div data-testid="room-deposit-card" className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
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
                      <span data-testid="deposit-required-value" className="font-semibold text-slate-700">{formatCurrency(activeOccupancy.deposit.required)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Received</span>
                      <span data-testid="deposit-received-value" className="font-semibold text-green-700">{formatCurrency(activeOccupancy.deposit.received)}</span>
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

                  <DepositManager
                    occupancyId={activeOccupancy.id}
                    required={activeOccupancy.deposit.required}
                    received={activeOccupancy.deposit.received}
                    refunded={activeOccupancy.deposit.refunded}
                    refundDueDate={activeOccupancy.deposit.refundDueDate}
                    transactions={activeOccupancy.deposit.transactions}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">No deposit record</p>
              )}
            </div>

            {/* Record Payment (current month) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-800">Record Payment</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a period and save the payment with the button below.
                </p>
              </div>
              <RecordPaymentForm
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

        {/* Deposit refund-due warnings from past tenancies */}
        {pastOccupancies.some(
          (o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate
        ) && (
          <div className="space-y-2">
            {pastOccupancies
              .filter((o) => o.deposit && !o.deposit.refunded && o.deposit.refundDueDate)
              .map((o) => {
                const refundDue = new Date(o.deposit!.refundDueDate!);
                const isOverdue = refundDue < now;
                return (
                  <div
                    key={o.id}
                    data-testid="deposit-refund-warning"
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                      isOverdue
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <span className={`text-base mt-0.5 ${isOverdue ? "text-red-500" : "text-amber-500"}`}>⚠</span>
                    <div>
                      {(() => {
                        const summary = summarizeDepositTransactions(
                          o.deposit!.required,
                          o.deposit!.transactions
                        );

                        return (
                          <>
                      <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-amber-700"}`}>
                        Deposit return {isOverdue ? "overdue" : "due soon"}
                      </p>
                      <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                        {o.tenant.firstName} {o.tenant.lastName} moved out on{" "}
                        {formatDate(o.moveOutDate)} — deposit of{" "}
                        {formatCurrency(summary.outstandingRefund || o.deposit!.required)} should be returned by{" "}
                        {formatDate(refundDue)}.
                      </p>
                          </>
                        );
                      })()}

                      <DepositManager
                        occupancyId={o.id}
                        required={o.deposit!.required}
                        received={o.deposit!.received}
                        refunded={o.deposit!.refunded}
                        refundDueDate={o.deposit!.refundDueDate}
                        transactions={o.deposit!.transactions}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        <PaymentHistorySection roomId={id} payments={paymentHistory} />

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
