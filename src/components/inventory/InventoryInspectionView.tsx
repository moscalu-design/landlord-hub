"use client";

import { useEffect, useMemo, useState } from "react";
import { createInspection, deleteInspection } from "@/actions/inventory";
import { INVENTORY_CONDITIONS } from "@/lib/validations";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
};

type InspectionPhoto = {
  id: string;
  inspectionItemId: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date | string;
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
  photos: InspectionPhoto[];
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

async function uploadInspectionPhoto(
  inspectionId: string,
  file: File,
  inspectionItemId?: string | null
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  if (inspectionItemId) {
    formData.append("inspectionItemId", inspectionItemId);
  }

  const response = await fetch(`/api/inspections/${inspectionId}/photos`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error ?? `Photo upload failed for ${file.name}.`);
  }
}

// Thumbnail with remove button for pre-save photo previews.
function PhotoPreviewThumb({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={objectUrl}
        alt={file.name}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-0.5 top-0.5 rounded-full bg-white/90 px-1.5 py-0 text-[10px] font-bold text-red-600 shadow hover:bg-white"
      >
        ×
      </button>
    </div>
  );
}

function ItemPhotoPicker({
  label,
  testId,
  files,
  onAdd,
  onRemove,
}: {
  label: string;
  testId?: string;
  files: File[];
  onAdd: (newFiles: File[]) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600">
        <span>+ {label}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="sr-only"
          data-testid={testId}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            if (list.length > 0) onAdd(list);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <PhotoPreviewThumb
              key={`${file.name}-${file.lastModified}-${idx}`}
              file={file}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  const [itemPhotos, setItemPhotos] = useState<Record<string, File[]>>({});
  const [generalPhotos, setGeneralPhotos] = useState<File[]>([]);
  const [type, setType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");

  function addItemPhotos(itemId: string, files: File[]) {
    setItemPhotos((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] ?? []), ...files],
    }));
  }

  function removeItemPhoto(itemId: string, idx: number) {
    setItemPhotos((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).filter((_, i) => i !== idx),
    }));
  }

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
          condition: (conditions[item.id] ?? "GOOD") as
            | "NEW" | "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "MISSING",
          quantity: quantities[item.id] ?? item.quantity,
          notes: itemNotes[item.id] || undefined,
        })),
      });

      // Map: roomInventoryItemId → inspectionItemId for photo uploads.
      const inspectionItemByRoomItem = new Map(
        created.items
          .filter((i) => i.inventoryItemId)
          .map((i) => [i.inventoryItemId as string, i.id])
      );

      const uploads: Promise<unknown>[] = [];
      for (const [roomItemId, files] of Object.entries(itemPhotos)) {
        const inspectionItemId = inspectionItemByRoomItem.get(roomItemId);
        for (const file of files) {
          uploads.push(uploadInspectionPhoto(created.id, file, inspectionItemId ?? null));
        }
      }
      for (const file of generalPhotos) {
        uploads.push(uploadInspectionPhoto(created.id, file, null));
      }

      if (uploads.length > 0) {
        try {
          await Promise.all(uploads);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Inspection saved, but one or more photos failed to upload.";
          window.alert(
            `${message} The inspection itself was saved. You can add photos to it afterward.`
          );
          window.location.reload();
          return;
        }
        // Photos were POSTed after the server action's revalidate, so force a refresh
        // to pull the new inspection + its photos into the current view.
        window.location.reload();
        return;
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="new-inspection-form"
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
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
            data-testid="new-inspection-type"
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

      {/* Per-item conditions + photos */}
      {inventoryItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Item conditions</p>
          {inventoryItems.map((item) => (
            <div
              key={item.id}
              data-testid="new-inspection-item-row"
              data-item-id={item.id}
              className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                </div>
                <select
                  value={conditions[item.id] ?? "GOOD"}
                  onChange={(e) =>
                    setConditions((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  aria-label={`Condition for ${item.name}`}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INVENTORY_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={itemNotes[item.id] ?? ""}
                  onChange={(e) =>
                    setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <ItemPhotoPicker
                label="Photos"
                testId={`new-inspection-item-photos-${item.id}`}
                files={itemPhotos[item.id] ?? []}
                onAdd={(files) => addItemPhotos(item.id, files)}
                onRemove={(idx) => removeItemPhoto(item.id, idx)}
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

      {/* General/overall photos (not tied to any specific item) */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          General photos <span className="text-slate-400 font-normal">optional</span>
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Overall room shots not tied to a specific item. Per-item photos go under each item above. Max 4 MB per image.
        </p>
        <ItemPhotoPicker
          label="Add photos"
          testId="new-inspection-general-photos"
          files={generalPhotos}
          onAdd={(files) => setGeneralPhotos((prev) => [...prev, ...files])}
          onRemove={(idx) =>
            setGeneralPhotos((prev) => prev.filter((_, i) => i !== idx))
          }
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

function PhotoGrid({
  photos,
  onDelete,
  deletingId,
}: {
  photos: InspectionPhoto[];
  onDelete: (photoId: string) => void;
  deletingId: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          data-testid="inspection-photo-thumb"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/40"
        >
          <a href={`/api/inspection-photos/${photo.id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/inspection-photos/${photo.id}`}
              alt={photo.fileName}
              className="h-24 w-full object-cover"
              loading="lazy"
            />
          </a>
          <div className="space-y-0.5 px-2 py-1.5">
            <p className="truncate text-[11px] font-medium text-slate-700">{photo.fileName}</p>
            <p className="text-[10px] text-slate-400">
              {formatBytes(photo.fileSize)} · {formatDate(photo.uploadedAt)}
            </p>
            <button
              type="button"
              onClick={() => onDelete(photo.id)}
              disabled={deletingId === photo.id}
              className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deletingId === photo.id ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddPhotosButton({
  inspectionId,
  inspectionItemId,
  uploading,
  setUploading,
  setError,
  testId,
  label = "+ Add photos",
}: {
  inspectionId: string;
  inspectionItemId: string | null;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  setError: (v: string | null) => void;
  testId?: string;
  label?: string;
}) {
  async function handleFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        await uploadInspectionPhoto(inspectionId, file, inspectionItemId);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photos.");
      setUploading(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
      {uploading ? "Uploading…" : label}
      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="sr-only"
        disabled={uploading}
        data-testid={testId}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function GeneralPhotosSection({
  inspectionId,
  photos,
}: {
  inspectionId: string;
  photos: InspectionPhoto[];
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="px-4 py-3 border-b border-slate-100 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600">General photos</p>
          <p className="text-xs text-slate-500">
            Overall shots not tied to a specific item.
          </p>
        </div>
        <AddPhotosButton
          inspectionId={inspectionId}
          inspectionItemId={null}
          uploading={uploading}
          setUploading={setUploading}
          setError={setError}
          testId={`general-photo-input-${inspectionId}`}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-xs text-slate-400">No general photos attached.</p>
      ) : (
        <PhotoGrid photos={photos} onDelete={handleDeletePhoto} deletingId={deletingId} />
      )}
    </div>
  );
}

function ItemPhotosInline({
  inspectionId,
  inspectionItemId,
  photos,
}: {
  inspectionId: string;
  inspectionItemId: string;
  photos: InspectionPhoto[];
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Remove this photo?")) return;
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
    <div className="mt-2 space-y-2" data-testid="inspection-item-photos">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {photos.length === 0
            ? "No photos attached."
            : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
        </span>
        <AddPhotosButton
          inspectionId={inspectionId}
          inspectionItemId={inspectionItemId}
          uploading={uploading}
          setUploading={setUploading}
          setError={setError}
          testId={`item-photo-input-${inspectionItemId}`}
          label="+ Photo"
        />
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {photos.length > 0 && (
        <PhotoGrid photos={photos} onDelete={handleDeletePhoto} deletingId={deletingId} />
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
    ? Object.fromEntries(
        compareInspection.items.map((i) => [i.inventoryItemId ?? i.itemName, i])
      )
    : null;

  // Group photos by item.
  const photosByItem = useMemo(() => {
    const map = new Map<string, InspectionPhoto[]>();
    for (const p of inspection.photos) {
      if (!p.inspectionItemId) continue;
      const list = map.get(p.inspectionItemId) ?? [];
      list.push(p);
      map.set(p.inspectionItemId, list);
    }
    return map;
  }, [inspection.photos]);

  const generalPhotos = useMemo(
    () => inspection.photos.filter((p) => !p.inspectionItemId),
    [inspection.photos]
  );

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 shadow-sm shadow-slate-200/40"
      data-testid="inspection-card"
      data-inspection-id={inspection.id}
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              inspection.type === "CHECK_IN"
                ? "bg-blue-100 text-blue-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {inspection.type === "CHECK_IN" ? "Check-in" : "Check-out"}
          </span>
          <span className="ml-2 text-xs text-slate-500">{formatDate(inspection.date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/inspections/${inspection.id}/report`}
            target="_blank"
            rel="noreferrer"
            data-testid="inspection-download-pdf"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
          >
            Download PDF
          </a>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>

      {inspection.notes && (
        <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">{inspection.notes}</p>
      )}

      <GeneralPhotosSection inspectionId={inspection.id} photos={generalPhotos} />

      {inspection.items.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-400">No items recorded.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {inspection.items.map((item) => {
            const prior = checkInConditions?.[item.inventoryItemId ?? item.itemName];
            const conditionChanged = prior && prior.condition !== item.condition;
            const itemPhotos = photosByItem.get(item.id) ?? [];

            return (
              <div
                key={item.id}
                className="px-4 py-3"
                data-testid="inspection-item"
                data-inspection-item-id={item.id}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-700">{item.itemName}</span>
                    {item.notes && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {prior && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          CONDITION_COLORS[prior.condition] ?? ""
                        }`}
                      >
                        {prior.condition.charAt(0) + prior.condition.slice(1).toLowerCase()}
                      </span>
                    )}
                    {conditionChanged && <span className="text-slate-400 text-xs">→</span>}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        CONDITION_COLORS[item.condition] ?? ""
                      }`}
                    >
                      {item.condition.charAt(0) + item.condition.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
                <ItemPhotosInline
                  inspectionId={inspection.id}
                  inspectionItemId={item.id}
                  photos={itemPhotos}
                />
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
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
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
        {checkIn && <InspectionCard inspection={checkIn} roomId={roomId} />}
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
