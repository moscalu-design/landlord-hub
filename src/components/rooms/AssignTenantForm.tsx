"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createTenantForAssignment,
  type QuickCreateTenantState,
} from "@/actions/tenants";
import { createOccupancy } from "@/actions/occupancies";
import type { Tenant } from "@/generated/prisma/client";

type TenantOption = Pick<Tenant, "id" | "firstName" | "lastName" | "email" | "status">;

function AssignSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="assign-tenant-submit"
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
      data-testid="create-tenant-submit"
      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Creating…" : "Create Tenant"}
    </button>
  );
}

interface AssignTenantFormProps {
  roomId: string;
  tenants: TenantOption[];
  defaultRent: number;
  defaultDeposit: number;
}

const initialCreateState: QuickCreateTenantState = {
  success: false,
};

export function AssignTenantForm({
  roomId,
  tenants,
  defaultRent,
  defaultDeposit,
}: AssignTenantFormProps) {
  const today = new Date().toISOString().split("T")[0];
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
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        data-testid="room-add-tenant-button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
      >
        Add Tenant
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8"
          onClick={() => setIsOpen(false)}
        >
          <div
            data-testid="add-tenant-modal"
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add Tenant</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Assign an existing tenant or create a new tenant without leaving this room.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="px-6 pt-5">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  data-testid="assign-existing-tab"
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
                  data-testid="create-new-tenant-tab"
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
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-600">
                      Set the tenancy details here. Deposit required defaults to the room’s deposit amount.
                    </p>
                  </div>

                  <form
                    key="assign-tenant-form"
                    action={createOccupancy}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <input type="hidden" name="roomId" value={roomId} />
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
                        data-testid="assign-tenant-select"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Select Tenant —</option>
                        {filteredTenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.firstName} {tenant.lastName} · {tenant.email}
                          </option>
                        ))}
                      </select>
                      {tenantOptions.length === 0 && (
                        <p className="mt-2 text-sm text-slate-500">
                          No available tenants yet. Switch to “Create New” to add one first.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Lease Start <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="leaseStart"
                        required
                        defaultValue={today}
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
                        defaultValue={defaultRent}
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
                        defaultValue={defaultDeposit}
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
                        Move-in Date
                      </label>
                      <input
                        type="date"
                        name="moveInDate"
                        defaultValue={today}
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
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-600">
                      Create the tenant here, then return to assignment with the new tenant preselected.
                    </p>
                  </div>

                  <form
                    key="create-tenant-form"
                    action={createTenantAction}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <input type="hidden" name="status" value="ACTIVE" />

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="firstName"
                        required
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="lastName"
                        required
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="email"
                        type="email"
                        required
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Phone
                      </label>
                      <input
                        name="phone"
                        type="tel"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nationality
                      </label>
                      <input
                        name="nationality"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {createState.error && (
                      <p
                        data-testid="create-tenant-error"
                        className="md:col-span-2 text-sm text-red-600"
                      >
                        {createState.error}
                      </p>
                    )}

                    {createState.success && createState.tenant && (
                      <p
                        data-testid="create-tenant-success"
                        className="md:col-span-2 text-sm text-green-700"
                      >
                        {createState.tenant.firstName} {createState.tenant.lastName} created. Review the tenancy details and assign them to this room.
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
