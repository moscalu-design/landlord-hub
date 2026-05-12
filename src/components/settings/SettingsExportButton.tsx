"use client";

import { useState } from "react";

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "rental-app-export.zip";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "rental-app-export.zip";
}

export function SettingsExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setMessage(null);
    setStatus(null);

    try {
      const response = await fetch("/api/settings/export", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Export failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus("success");
      setMessage("Export ZIP is ready.");
    } catch {
      setStatus("error");
      setMessage("Could not prepare the export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">Export account data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Download a ZIP with CSV files and uploaded documents for this account.
          </p>
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The ZIP may contain sensitive personal and financial data.
          </p>
        </div>

        <button
          type="button"
          data-testid="settings-export-zip"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? "Preparing..." : "Export ZIP"}
        </button>
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
