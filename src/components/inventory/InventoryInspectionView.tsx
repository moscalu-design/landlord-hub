"use client";

import { useState } from "react";
import { createInspection, deleteInspection } from "@/actions/inventory";
import { INVENTORY_CONDITIONS } from "@/lib/validations";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
};

type InspectionItem = {
  id: string;
  inventoryItemId: string | null;
  itemName: string;
  condition: string;
  quantity: number;
  notes: string | null;
  inventoryItem: InventoryItem | null;
};

type Inspection = {
  id: string;
  type: string;
  date: Date | string;
  notes: string | null;
  items: InspectionItem[];
};

type Occupancy = {
  id: string;
  status: string;
  tenant: { firstName: string; lastName: string };
  inspections: Inspection[];
};

const CONDITION_COLORS: Record<string, string> = {
  NEW:     "bg-blue-100 text-blue-700",
  GOOD:    "bg-green-100 text-green-700",
  FAIR:    "bg-yellow-100 text-yellow-700",
  WORN:    "bg-orange-100 text-orange-700",
  DAMAGED: "bg-red-100 text-red-700",
  MISSING: "bg-slate-100 text-slate-600",
};

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function NewInspectionForm({
  roomId,
  occupancyId,
  inventoryItems,
  onDone,
}: {
  roomId: string;
  occupancyId: string;
  inventoryItems: InventoryItem[];
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Record<string, string>>(() =>
    Object.fromEntries(inventoryItems.map((i) => [i.id, "GOOD"]))
  );
  const [quantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(inventoryItems.map((i) => [i.id, i.quantity]))
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [type, setType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inventoryItems.length === 0) {
      setError("No inventory items to inspect. Add items to the room inventory first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createInspection(occupancyId, roomId, {
        inspection: { type, date, notes: notes || undefined },
        items: inventoryItems.map((item) => ({
          inventoryItemId: item.id,
          itemName: item.name,
          condition: (conditions[item.id] ?? "GOOD") as "NEW" | "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "MISSING",
          quantity: quantities[item.id] ?? item.quantity,
          notes: itemNotes[item.id] || undefined,
        })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Type + date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "CHECK_IN" | "CHECK_OUT")}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="CHECK_IN">Check-in</option>
            <option value="CHECK_OUT">Check-out</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Per-item conditions */}
      {inventoryItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Item conditions</p>
          {inventoryItems.map((item) => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start border border-slate-200 rounded-lg p-3 bg-white">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.name}</p>
              </div>
              <select
                value={conditions[item.id] ?? "GOOD"}
                onChange={(e) => setConditions((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INVENTORY_CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={itemNotes[item.id] ?? ""}
                onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No inventory items defined for this room yet.</p>
      )}

      {/* Overall notes */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Inspection notes <span className="text-slate-400 font-normal">optional</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? "Saving…" : "Save inspection"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function InspectionCard({
  inspection,
  roomId,
  compareInspection,
}: {
  inspection: Inspection;
  roomId: string;
  compareInspection?: Inspection;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this inspection record?")) return;
    setDeleting(true);
    try {
      await deleteInspection(inspection.id, roomId);
    } catch {
      setDeleting(false);
    }
  }

  // Build a comparison map: inventoryItemId → check-in condition
  const checkInConditions = compareInspection
    ? Object.fromEntries(compareInspection.items.map((i) => [i.inventoryItemId ?? i.itemName, i]))
    : null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            inspection.type === "CHECK_IN" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
          }`}>
            {inspection.type === "CHECK_IN" ? "Check-in" : "Check-out"}
          </span>
          <span className="ml-2 text-xs text-slate-500">{formatDate(inspection.date)}</span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>

      {inspection.notes && (
        <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">{inspection.notes}</p>
      )}

      {inspection.items.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-400">No items recorded.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {inspection.items.map((item) => {
            const prior = checkInConditions?.[item.inventoryItemId ?? item.itemName];
            const conditionChanged = prior && prior.condition !== item.condition;

            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700">{item.itemName}</span>
                  {item.notes && (
                    <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {prior && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONDITION_COLORS[prior.condition] ?? ""}`}>
                      {prior.condition.charAt(0) + prior.condition.slice(1).toLowerCase()}
                    </span>
                  )}
                  {conditionChanged && (
                    <span className="text-slate-400 text-xs">→</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONDITION_COLORS[item.condition] ?? ""}`}>
                    {item.condition.charAt(0) + item.condition.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InventoryInspectionView({
  roomId,
  occupancy,
  inventoryItems,
}: {
  roomId: string;
  occupancy: Occupancy;
  inventoryItems: InventoryItem[];
}) {
  const [showForm, setShowForm] = useState(false);

  const checkIn = occupancy.inspections.find((i) => i.type === "CHECK_IN");
  const checkOut = occupancy.inspections.find((i) => i.type === "CHECK_OUT");

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Inspections — {occupancy.tenant.firstName} {occupancy.tenant.lastName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {occupancy.status === "ACTIVE" ? "Active tenancy" : "Past tenancy"}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            + New inspection
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {showForm && (
          <NewInspectionForm
            roomId={roomId}
            occupancyId={occupancy.id}
            inventoryItems={inventoryItems}
            onDone={() => setShowForm(false)}
          />
        )}

        {occupancy.inspections.length === 0 && !showForm && (
          <p className="text-sm text-slate-500 text-center py-4">
            No inspections recorded for this tenancy.
          </p>
        )}

        {/* Check-out first (most recent), then check-in, with comparison */}
        {checkOut && (
          <InspectionCard
            inspection={checkOut}
            roomId={roomId}
            compareInspection={checkIn}
          />
        )}
        {checkIn && (
          <InspectionCard
            inspection={checkIn}
            roomId={roomId}
          />
        )}
        {/* Any other inspections beyond the two main ones */}
        {occupancy.inspections
          .filter((i) => i.id !== checkIn?.id && i.id !== checkOut?.id)
          .map((i) => (
            <InspectionCard key={i.id} inspection={i} roomId={roomId} />
          ))}
      </div>
    </div>
  );
}
