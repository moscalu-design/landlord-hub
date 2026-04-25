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
    <div className="sticky top-14 z-20 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-4 lg:top-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="mb-1 inline-flex items-center gap-1 rounded-md text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel ?? "Back"}
            </Link>
          )}
          <h1 className="truncate text-lg font-semibold leading-tight text-slate-950 sm:text-xl">{title}</h1>
          {description && (
            <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
