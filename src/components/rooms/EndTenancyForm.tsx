"use client";

import { useState } from "react";
import { endOccupancy } from "@/actions/occupancies";

interface EndTenancyFormProps {
  occupancyId: string;
  todayInputValue: string;
}

export function EndTenancyForm({ occupancyId, todayInputValue }: EndTenancyFormProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      await endOccupancy(occupancyId, fd);
      // endOccupancy redirects on success — no need to close modal
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="end-tenancy-btn"
        onClick={() => setOpen(true)}
        className="text-xs text-red-600 hover:text-red-700 font-medium"
      >
        End Tenancy
      </button>

      {open && (
        <div
          data-testid="end-tenancy-modal"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">End Tenancy</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-600">
                This will mark the tenancy as ended and set the room back to vacant.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Move-out date
                </label>
                <input
                  name="moveOutDate"
                  type="date"
                  required
                  defaultValue={todayInputValue}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  data-testid="confirm-end-tenancy-btn"
                  disabled={pending}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {pending ? "Ending…" : "End Tenancy"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
