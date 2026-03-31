"use client";

import { useRef, useState, useCallback } from "react";
import { deleteDocument } from "@/actions/documents";
import { normalizeUploadedDocument, type DocumentRecord } from "./documentRecord";

interface DocumentSlotProps {
  tenantId: string;
  type: "idDocument" | "workContract" | "salarySlip";
  label: string;
  document: DocumentRecord | null;
  onUploaded: (doc: DocumentRecord) => void;
  onDeleted: () => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FileIcon({ type }: { type: string }) {
  const isPdf = type === "application/pdf";
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-red-50" : "bg-blue-50"}`}>
      <svg className={`w-5 h-5 ${isPdf ? "text-red-500" : "text-blue-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
}

export function DocumentSlot({
  tenantId,
  type,
  label,
  document,
  onUploaded,
  onDeleted,
}: DocumentSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const upload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tenantId", tenantId);
    formData.append("type", type);

    try {
      // Simulate initial progress while uploading
      const progressTimer = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 85));
      }, 200);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);
      setProgress(100);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      onUploaded(normalizeUploadedDocument(data));
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [tenantId, type, onUploaded]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDelete = async () => {
    if (!document) return;
    setDeleting(true);
    const result = await deleteDocument(document.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (result.error) {
      setError(result.error);
    } else {
      onDeleted();
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>

      {document ? (
        /* ── Filled state ── */
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
          <FileIcon type="" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{document.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatBytes(document.fileSize)} · uploaded {formatDate(document.uploadedAt)}
            </p>
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500">Remove?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`/api/documents/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
              <a
                href={`/api/documents/${document.id}?dl=1`}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                onClick={() => inputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                title="Replace"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : uploading ? (
        /* ── Uploading state ── */
        <div className="bg-white border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm text-slate-600">Uploading…</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        /* ── Empty / drop zone state ── */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
            ${dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <svg className="w-6 h-6 text-slate-300 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-slate-500">
            <span className="font-medium text-blue-600">Choose file</span> or drag & drop
          </p>
          <p className="text-xs text-slate-400 mt-0.5">PDF, JPG or PNG · max 10 MB</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
