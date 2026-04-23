"use client";

import { useFormStatus } from "react-dom";
import { createRoom, updateRoom } from "@/actions/rooms";
import type { Room } from "@/generated/prisma/client";

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

interface RoomFormProps {
  propertyId: string;
  room?: Room;
}

export function RoomForm({ propertyId, room }: RoomFormProps) {
  const action = room
    ? updateRoom.bind(null, room.id, propertyId)
    : createRoom.bind(null, propertyId);

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Room Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              defaultValue={room?.name}
              required
              placeholder="e.g. Blue Room, Garden Room, Room 1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Floor</label>
            <input
              name="floor"
              defaultValue={room?.floor ?? ""}
              placeholder="Ground, First, 2..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Size (m²)</label>
            <input
              name="sizeM2"
              type="number"
              step="0.1"
              min="0"
              defaultValue={room?.sizeM2 ?? ""}
              placeholder="e.g. 14.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Monthly Rent (£) <span className="text-red-500">*</span>
            </label>
            <input
              name="monthlyRent"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={room?.monthlyRent}
              placeholder="900"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Deposit (£) <span className="text-red-500">*</span>
            </label>
            <input
              name="depositAmount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={room?.depositAmount}
              placeholder="900"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              name="status"
              defaultValue={room?.status ?? "VACANT"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="VACANT">Vacant</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RESERVED">Reserved</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="furnished"
              defaultChecked={room?.furnished ?? true}
              value="true"
              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Furnished</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="privateBathroom"
              defaultChecked={room?.privateBathroom ?? false}
              value="true"
              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Private Bathroom</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            defaultValue={room?.notes ?? ""}
            rows={3}
            placeholder="Any notes about this room…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={room ? "Save Changes" : "Create Room"} />
        <a
          href={room ? `/rooms/${room.id}` : `/properties/${propertyId}`}
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
