interface TopBarProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, description, actions }: TopBarProps) {
  return (
    <div className="min-h-16 border-b border-slate-200 bg-white flex flex-col gap-3 px-4 py-3 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
        {description && <p className="truncate text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
