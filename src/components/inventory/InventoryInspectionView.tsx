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
  photos: {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: Date | string;
  }[];
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadInspectionPhotos(inspectionId: string, files: File[]) {
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/inspections/${inspectionId}/photos`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error ?? `Photo upload failed for ${file.name}.`);
    }
  }
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
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inventoryItems.length === 0) {
      setError("No inventory items to inspect. Add items to the room inventory first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createInspection(occupancyId, roomId, {
        inspection: { type, date, notes: notes || undefined },
        items: inventoryItems.map((item) => ({
          inventoryItemId: item.id,
          itemName: item.name,
          condition: (conditions[item.id] ?? "GOOD") as "NEW" | "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "MISSING",
          quantity: quantities[item.id] ?? item.quantity,
          notes: itemNotes[item.id] || undefined,
        })),
      });

      if (selectedPhotos.length > 0) {
        try {
          await uploadInspectionPhotos(created.id, selectedPhotos);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Inspection saved, but photo upload failed.";
          window.alert(`${message} The inspection itself was saved. You can add photos to it afterward.`);
          onDone();
          return;
        }
      }

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

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Photos <span className="text-slate-400 font-normal">optional</span>
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setSelectedPhotos(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="mt-1 text-xs text-slate-500">
          Add multiple images from your phone camera or photo library. Max 4 MB per image.
        </p>
        {selectedPhotos.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {selectedPhotos.map((file) => (
              <li key={`${file.name}-${file.lastModified}`}>
                {file.name} · {formatBytes(file.size)}
              </li>
            ))}
          </ul>
        )}
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

function InspectionPhotos({
  inspectionId,
  photos,
}: {
  inspectionId: string;
  photos: Inspection["photos"];
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPhotos(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      await uploadInspectionPhotos(inspectionId, list);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photos.");
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Remove this inspection photo?")) return;

    setDeletingId(photoId);
    setError(null);
    try {
      const response = await fetch(`/api/inspection-photos/${photoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete photo.");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo.");
      setDeletingId(null);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-slate-100 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600">Photos</p>
          <p className="text-xs text-slate-500">
            Add more inspection images later if needed.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
          {uploading ? "Uploading…" : "+ Add photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void handleAddPhotos(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {photos.length === 0 ? (
        <p className="text-xs text-slate-400">No photos attached.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <a href={`/api/inspection-photos/${photo.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/inspection-photos/${photo.id}`}
                  alt={photo.fileName}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
              </a>
              <div className="space-y-1 px-2 py-2">
                <p className="truncate text-xs font-medium text-slate-700">{photo.fileName}</p>
                <p className="text-[11px] text-slate-400">
                  {formatBytes(photo.fileSize)} · {formatDate(photo.uploadedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(photo.id)}
                  disabled={deletingId === photo.id}
                  className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === photo.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

      <InspectionPhotos inspectionId={inspection.id} photos={inspection.photos} />

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
