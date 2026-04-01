"use client";

import { useFormStatus } from "react-dom";
import { createOccupancy } from "@/actions/occupancies";
import type { Tenant } from "@/generated/prisma/client";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Assigning…" : "Assign Tenant"}
    </button>
  );
}

interface AssignTenantFormProps {
  roomId: string;
  tenants: Tenant[];
  defaultRent: number;
  defaultDeposit: number;
}

export function AssignTenantForm({ roomId, tenants, defaultRent, defaultDeposit }: AssignTenantFormProps) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={createOccupancy} className="grid grid-cols-2 gap-4 max-w-xl">
      {/* Hidden room ID */}
      <input type="hidden" name="roomId" value={roomId} />

      <div className="col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Tenant <span className="text-red-500">*</span>
        </label>
        <select
          name="tenantId"
          required
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select Tenant —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName} · {t.email}
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
          defaultValue={today}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Lease End (optional)</label>
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
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Rent Due Day</label>
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
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Move-in Date</label>
        <input
          type="date"
          name="moveInDate"
          defaultValue={today}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <input type="hidden" name="status" value="ACTIVE" />

      <div className="col-span-2 flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
