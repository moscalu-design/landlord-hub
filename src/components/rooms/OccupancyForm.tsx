"use client";

import { useFormStatus } from "react-dom";
import { updateOccupancy } from "@/actions/occupancies";
import type { Occupancy, Tenant } from "@/generated/prisma/client";
import { toDateInputValue } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

interface OccupancyFormProps {
  occupancy: Occupancy;
  tenant: Pick<Tenant, "firstName" | "lastName" | "email">;
}

export function OccupancyForm({ occupancy, tenant }: OccupancyFormProps) {
  const action = updateOccupancy.bind(null, occupancy.id);

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Tenancy Details</h2>
          <p className="mt-1 text-sm text-slate-500">
            {tenant.firstName} {tenant.lastName} {tenant.email ? `· ${tenant.email}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Lease Start <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="leaseStart"
              required
              defaultValue={toDateInputValue(occupancy.leaseStart)}
              data-testid="edit-occupancy-lease-start"
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
              defaultValue={toDateInputValue(occupancy.leaseEnd)}
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
              defaultValue={toDateInputValue(occupancy.moveInDate)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Current Rent Terms</p>
            <p className="mt-1 text-sm text-slate-700">Rent {occupancy.monthlyRent} · Due day {occupancy.rentDueDay}</p>
            <p className="mt-1 text-xs text-slate-500">Changing lease start also updates unpaid monthly payment rows.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            defaultValue={occupancy.notes ?? ""}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a href={`/rooms/${occupancy.roomId}`} className="text-sm text-slate-600 hover:text-slate-800">
          Cancel
        </a>
      </div>
    </form>
  );
}
