"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface ContractUploadProps {
  occupancyId: string;
  contractFileName: string | null;
  contractFileSize: number | null;
  contractUploadedAt: Date | string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContractUpload({
  occupancyId,
  contractFileName,
  contractFileSize,
  contractUploadedAt,
}: ContractUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/occupancies/${occupancyId}/contract`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch(`/api/occupancies/${occupancyId}/contract`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Remove failed.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">Rental Contract</p>

      {contractFileName ? (
        <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div className="min-w-0">
            <a
              href={`/api/occupancies/${occupancyId}/contract`}
              data-testid="contract-link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 truncate block"
            >
              {contractFileName}
            </a>
            <p className="text-xs text-slate-400 mt-0.5">
              {contractFileSize ? formatFileSize(contractFileSize) : ""}
              {contractUploadedAt ? ` · Uploaded ${formatDate(contractUploadedAt)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="contract-replace-button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || removing}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              data-testid="contract-remove-button"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="contract-upload-button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          {uploading ? "Uploading…" : "Attach contract (PDF · max 4 MB)"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        data-testid="contract-input"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
