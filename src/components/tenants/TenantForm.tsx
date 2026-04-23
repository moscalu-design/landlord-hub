"use client";

import { useFormStatus } from "react-dom";
import { createTenant, updateTenant } from "@/actions/tenants";
import type { Tenant } from "@/generated/prisma/client";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function TenantForm({ tenant }: { tenant?: Tenant }) {
  const action = tenant ? updateTenant.bind(null, tenant.id) : createTenant;

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      {/* Personal Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Personal Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              name="firstName"
              required
              defaultValue={tenant?.firstName}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              name="lastName"
              required
              defaultValue={tenant?.lastName}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={tenant?.email}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input
              name="phone"
              type="tel"
              defaultValue={tenant?.phone ?? ""}
              placeholder="+44 7700 000000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nationality</label>
            <input
              name="nationality"
              defaultValue={tenant?.nationality ?? ""}
              placeholder="British"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={tenant?.dateOfBirth ? new Date(tenant.dateOfBirth).toISOString().split("T")[0] : ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              name="status"
              defaultValue={tenant?.status ?? "ACTIVE"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="PAST">Past Tenant</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Emergency Contact</label>
          <input
            name="emergencyContact"
            defaultValue={tenant?.emergencyContact ?? ""}
            placeholder="Name, phone, relationship"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* ID & Documents */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">ID &amp; Documents</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ID Type</label>
            <select
              name="idType"
              defaultValue={tenant?.idType ?? ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— None —</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
              <option value="NATIONAL_ID">National ID</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ID Reference</label>
            <input
              name="idReference"
              defaultValue={tenant?.idReference ?? ""}
              placeholder="Document number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
        <textarea
          name="notes"
          defaultValue={tenant?.notes ?? ""}
          rows={3}
          placeholder="Any internal notes about this tenant…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={tenant ? "Save Changes" : "Create Tenant"} />
        <a
          href={tenant ? `/tenants/${tenant.id}` : "/tenants"}
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
