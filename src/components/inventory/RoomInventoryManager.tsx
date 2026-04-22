"use client";

import { useState } from "react";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/actions/inventory";
import { INVENTORY_CATEGORIES } from "@/lib/validations";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  estimatedValue: number | null;
  notes: string | null;
  sortOrder: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  FURNITURE: "Furniture",
  APPLIANCE: "Appliance",
  FIXTURE: "Fixture",
  BEDDING: "Bedding",
  ELECTRONICS: "Electronics",
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  OTHER: "Other",
};

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(value);
}

function ItemForm({
  roomId,
  item,
  onDone,
}: {
  roomId: string;
  item?: InventoryItem;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (item) {
        await updateInventoryItem(item.id, roomId, fd);
      } else {
        await createInventoryItem(roomId, fd);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input
            name="name"
            required
            defaultValue={item?.name ?? ""}
            placeholder="e.g. Double bed"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
          <select
            name="category"
            defaultValue={item?.category ?? "FURNITURE"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {INVENTORY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={item?.quantity ?? 1}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Est. Value (€) <span className="text-slate-400 font-normal">optional</span>
          </label>
          <input
            name="estimatedValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.estimatedValue ?? ""}
            placeholder="0.00"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Notes <span className="text-slate-400 font-normal">optional</span>
        </label>
        <input
          name="notes"
          defaultValue={item?.notes ?? ""}
          placeholder="Any details…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <input type="hidden" name="sortOrder" value={item?.sortOrder ?? 0} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? "Saving…" : item ? "Save" : "Add item"}
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

export function RoomInventoryManager({
  roomId,
  items,
}: {
  roomId: string;
  items: InventoryItem[];
  activeOccupancyId: string | null;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this item from the inventory?")) return;
    setDeleting(id);
    try {
      await deleteInventoryItem(id, roomId);
    } catch {
      setDeleting(null);
    }
  }

  const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue ?? 0) * i.quantity, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Room Inventory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} item{items.length !== 1 ? "s" : ""}
            {totalValue > 0 && ` · est. ${formatCurrency(totalValue)} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          + Add item
        </button>
      </div>

      <div className="p-4 space-y-3">
        {showAdd && (
          <ItemForm roomId={roomId} onDone={() => setShowAdd(false)} />
        )}

        {items.length === 0 && !showAdd && (
          <p className="text-sm text-slate-500 text-center py-6">
            No items yet. Add furniture, appliances, and fixtures to track.
          </p>
        )}

        {items.map((item) => (
          editingId === item.id ? (
            <ItemForm
              key={item.id}
              roomId={roomId}
              item={item}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div
              key={item.id}
              data-testid="inventory-item-row"
              className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800">{item.name}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                  {item.quantity > 1 && (
                    <span className="text-xs text-slate-500">×{item.quantity}</span>
                  )}
                </div>
                {item.notes && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{item.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.estimatedValue !== null && (
                  <span className="text-xs text-slate-500">{formatCurrency(item.estimatedValue * item.quantity)}</span>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingId(item.id); setShowAdd(false); }}
                  className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting === item.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
