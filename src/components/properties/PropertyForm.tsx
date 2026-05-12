"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPropertyFromState,
  updatePropertyFromState,
  type PropertyActionState,
} from "@/actions/properties";
import type { Property } from "@/generated/prisma/client";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="property-form-submit"
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

interface PropertyFormProps {
  property?: Property;
}

const initialState: PropertyActionState = { error: null };

export function PropertyForm({ property }: PropertyFormProps) {
  const action = property
    ? updatePropertyFromState.bind(null, property.id)
    : createPropertyFromState;
  const [state, formAction] = useActionState<PropertyActionState, FormData>(
    action,
    initialState
  );
  const [rentalMode, setRentalMode] = useState<"ROOM_LEVEL" | "FULL_PROPERTY">(
    (property?.rentalMode as "ROOM_LEVEL" | "FULL_PROPERTY" | undefined) ?? "ROOM_LEVEL"
  );

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div
          role="alert"
          data-testid="property-form-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Rental Mode */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">How do you rent this property?</h2>
          <p className="text-xs text-slate-500 mt-1">
            Switching modes is blocked while there are active tenancies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              rentalMode === "ROOM_LEVEL"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="rentalMode"
              value="ROOM_LEVEL"
              checked={rentalMode === "ROOM_LEVEL"}
              onChange={() => setRentalMode("ROOM_LEVEL")}
              data-testid="rental-mode-room-level"
              className="sr-only"
            />
            <p className="font-medium text-sm text-slate-900">Room by room</p>
            <p className="text-xs text-slate-500 mt-1">
              Multiple rentable rooms with individual tenancies.
            </p>
          </label>

          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              rentalMode === "FULL_PROPERTY"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="rentalMode"
              value="FULL_PROPERTY"
              checked={rentalMode === "FULL_PROPERTY"}
              onChange={() => setRentalMode("FULL_PROPERTY")}
              data-testid="rental-mode-full-property"
              className="sr-only"
            />
            <p className="font-medium text-sm text-slate-900">Whole property</p>
            <p className="text-xs text-slate-500 mt-1">
              One tenancy for the entire property — no room records needed.
            </p>
          </label>
        </div>

        {rentalMode === "FULL_PROPERTY" && (
          <div data-testid="property-monthly-rent-block">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Monthly Rent (€) <span className="text-red-500">*</span>
            </label>
            <input
              name="monthlyRent"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={property?.monthlyRent ?? ""}
              placeholder="1500"
              data-testid="property-monthly-rent-input"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Used to bill the whole-property tenant each month.
            </p>
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Property Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              defaultValue={property?.name}
              required
              placeholder="e.g. Oak Street House"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              name="address"
              defaultValue={property?.address}
              required
              placeholder="123 Oak Street"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              City <span className="text-red-500">*</span>
            </label>
            <input
              name="city"
              defaultValue={property?.city}
              required
              placeholder="London"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Postcode</label>
            <input
              name="postcode"
              defaultValue={property?.postcode ?? ""}
              placeholder="SW1A 1AA"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Property Type</label>
            <select
              name="propertyType"
              defaultValue={property?.propertyType ?? "HOUSE"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="HOUSE">House</option>
              <option value="APARTMENT">Apartment</option>
              <option value="HMO">HMO</option>
              <option value="STUDIO">Studio</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              name="status"
              defaultValue={property?.status ?? "ACTIVE"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Static info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Property Information</h2>
          <p className="text-xs text-slate-500 mt-1">
            Static details describing the building itself.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Rooms</label>
            <input
              name="totalRoomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.totalRoomCount ?? ""}
              placeholder="5"
              data-testid="property-total-room-count-input"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bedrooms</label>
            <input
              name="bedroomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.bedroomCount ?? ""}
              placeholder="3"
              data-testid="property-bedroom-count-input"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bathrooms</label>
            <input
              name="bathroomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.bathroomCount ?? ""}
              placeholder="2"
              data-testid="property-bathroom-count-input"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Surface (m²)</label>
            <input
              name="surfaceAreaSqm"
              type="number"
              min="0"
              step="0.1"
              defaultValue={property?.surfaceAreaSqm ?? ""}
              placeholder="80"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(
            [
              { name: "hasTerrace", label: "Terrace" },
              { name: "hasBalcony", label: "Balcony" },
              { name: "hasGarden", label: "Garden" },
              { name: "hasParking", label: "Parking" },
              { name: "isFurnished", label: "Furnished" },
            ] as const
          ).map((feature) => {
            const checked = Boolean(
              property?.[feature.name as keyof Property] as boolean | undefined
            );
            return (
              <label key={feature.name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={feature.name}
                  defaultChecked={checked}
                  value="true"
                  data-testid={`property-${feature.name}-input`}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">{feature.label}</span>
              </label>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            name="description"
            defaultValue={property?.description ?? ""}
            rows={3}
            placeholder="Public description of the property…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Internal Notes</label>
          <textarea
            name="notes"
            defaultValue={property?.notes ?? ""}
            rows={3}
            placeholder="Private notes about this property…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={property ? "Save Changes" : "Create Property"} />
        <a href={property ? `/properties/${property.id}` : "/properties"} className="text-sm text-slate-600 hover:text-slate-800">
          Cancel
        </a>
      </div>
    </form>
  );
}
