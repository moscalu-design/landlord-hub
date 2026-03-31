"use client";

import { useState } from "react";
import { DocumentSlot } from "./DocumentSlot";
import type { DocumentRecord } from "./documentRecord";

type DocType = "idDocument" | "workContract" | "salarySlip";

const DOC_SLOTS: { type: DocType; label: string }[] = [
  { type: "idDocument",    label: "Passport / ID Card" },
  { type: "workContract",  label: "Work Contract" },
  { type: "salarySlip",    label: "Salary Slip" },
];

interface Props {
  tenantId: string;
  initialDocuments: Partial<Record<DocType, DocumentRecord>>;
}

export function DocumentsSection({ tenantId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<Partial<Record<DocType, DocumentRecord>>>(
    initialDocuments
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-800">Documents</h2>
          <span className="text-xs text-slate-400">
            {Object.keys(documents).length} / {DOC_SLOTS.length}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 ml-6">
          Sensitive — accessible to authenticated users only
        </p>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
        {DOC_SLOTS.map(({ type, label }) => (
          <DocumentSlot
            key={type}
            tenantId={tenantId}
            type={type}
            label={label}
            document={documents[type] ?? null}
            onUploaded={(doc) =>
              setDocuments((prev) => ({ ...prev, [type]: doc }))
            }
            onDeleted={() =>
              setDocuments((prev) => {
                const next = { ...prev };
                delete next[type];
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
