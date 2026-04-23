import Link from "next/link";

interface TopBarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function TopBar({ title, description, actions, backHref, backLabel }: TopBarProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 shrink-0 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors mb-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel ?? "Back"}
            </Link>
          )}
          <h1 className="truncate text-lg font-semibold text-slate-900 leading-tight sm:text-xl">{title}</h1>
          {description && (
            <p className="truncate text-xs text-slate-500 mt-0.5 sm:text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
