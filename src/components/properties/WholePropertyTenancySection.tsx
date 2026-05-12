"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWholePropertyOccupancy } from "@/actions/occupancies";
import {
  createTenantForAssignment,
  type QuickCreateTenantState,
} from "@/actions/tenants";
import type { Tenant } from "@/generated/prisma/client";

type TenantOption = Pick<Tenant, "id" | "firstName" | "lastName" | "email" | "status">;

function AssignSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="whole-property-assign-submit"
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Assigning…" : "Assign Tenant"}
    </button>
  );
}

function CreateTenantSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="whole-property-create-tenant-submit"
      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Creating…" : "Create Tenant"}
    </button>
  );
}

interface Props {
  propertyId: string;
  monthlyRent: number;
  tenants: TenantOption[];
  todayInputValue: string;
}

const initialCreateState: QuickCreateTenantState = { success: false };

export function WholePropertyAssignTenant({
  propertyId,
  monthlyRent,
  tenants,
  todayInputValue,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"assign" | "create">(
    tenants.length > 0 ? "assign" : "create"
  );
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantOptions, setTenantOptions] = useState(tenants);
  const handledCreatedTenantId = useRef<string | null>(null);
  const [createState, createTenantAction] = useActionState(
    createTenantForAssignment,
    initialCreateState
  );

  const assignAction = createWholePropertyOccupancy.bind(null, propertyId);

  useEffect(() => {
    if (!createState.success || !createState.tenant) return;
    const createdTenant = createState.tenant;
    if (handledCreatedTenantId.current === createdTenant.id) return;
    handledCreatedTenantId.current = createdTenant.id;

    queueMicrotask(() => {
      setTenantOptions((current) =>
        current.some((tenant) => tenant.id === createdTenant.id)
          ? current
          : [...current, createdTenant].sort((a, b) =>
              `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
            )
      );
      setSelectedTenantId(createdTenant.id);
      setMode("assign");
    });
  }, [createState]);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tenantOptions;
    return tenantOptions.filter((tenant) =>
      `${tenant.firstName} ${tenant.lastName} ${tenant.email}`
        .toLowerCase()
        .includes(query)
    );
  }, [search, tenantOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="whole-property-add-tenant-button"
        className="inline-flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
      >
        Add Tenant
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
          onClick={() => setIsOpen(false)}
        >
          <div
            data-testid="whole-property-add-tenant-modal"
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add Tenant</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Start a tenancy for the whole property.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 pt-5">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("assign")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === "assign"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Assign Existing
                </button>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    mode === "create"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Create New
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              {mode === "assign" ? (
                <form
                  key="whole-property-assign"
                  action={assignAction}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <input type="hidden" name="status" value="ACTIVE" />

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Search Tenant
                    </label>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Tenant <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="tenantId"
                      required
                      value={selectedTenantId}
                      onChange={(event) => setSelectedTenantId(event.target.value)}
                      data-testid="whole-property-tenant-select"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select Tenant —</option>
                      {filteredTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.firstName} {tenant.lastName} · {tenant.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Lease Start <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="leaseStart"
                      required
                      defaultValue={todayInputValue}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Lease End
                    </label>
                    <input
                      type="date"
                      name="leaseEnd"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Monthly Rent (€) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="monthlyRent"
                      required
                      step="0.01"
                      min="0"
                      defaultValue={monthlyRent}
                      data-testid="whole-property-monthly-rent"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Deposit Required (€) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="depositRequired"
                      required
                      step="0.01"
                      min="0"
                      defaultValue={monthlyRent}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Rent Due Day
                    </label>
                    <input
                      type="number"
                      name="rentDueDay"
                      min="1"
                      max="28"
                      defaultValue={1}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Payment Grace Period (days)
                    </label>
                    <input
                      type="number"
                      name="paymentGracePeriodDays"
                      min="0"
                      step="1"
                      defaultValue={5}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Move-in Date
                      <span className="ml-1 text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      name="moveInDate"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <AssignSubmitButton />
                  </div>
                </form>
              ) : (
                <form
                  key="whole-property-create-tenant"
                  action={createTenantAction}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <input type="hidden" name="status" value="ACTIVE" />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input name="firstName" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input name="lastName" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input name="email" type="email" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                    <input name="phone" type="tel" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nationality</label>
                    <input name="nationality" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                    <textarea name="notes" rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {createState.error && (
                    <p className="md:col-span-2 text-sm text-red-600">{createState.error}</p>
                  )}

                  {createState.success && createState.tenant && (
                    <p className="md:col-span-2 text-sm text-green-700">
                      {createState.tenant.firstName} {createState.tenant.lastName} created. Switch back to “Assign Existing” to start the tenancy.
                    </p>
                  )}

                  <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("assign")}
                      className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      Back to assignment
                    </button>
                    <CreateTenantSubmitButton />
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
