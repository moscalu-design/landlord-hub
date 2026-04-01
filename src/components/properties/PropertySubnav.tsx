import Link from "next/link";

type PropertySubnavItem = {
  key: string;
  label: string;
  href?: string;
  disabled?: boolean;
};

const ITEMS: PropertySubnavItem[] = [
  { key: "overview", label: "Overview" },
  { key: "mortgages", label: "Mortgages" },
  { key: "costs", label: "Costs" },
  { key: "documents", label: "Documents", disabled: true },
  { key: "settings", label: "Settings", disabled: true },
];

export function PropertySubnav({
  propertyId,
  active,
}: {
  propertyId: string;
  active: "overview" | "mortgages" | "costs";
}) {
  const hrefs: Record<string, string> = {
    overview: `/properties/${propertyId}`,
    mortgages: `/properties/${propertyId}/mortgages`,
    costs: `/properties/${propertyId}/costs`,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-2 py-2">
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          if (item.disabled) {
            return (
              <span
                key={item.key}
                className="px-3 py-2 text-xs rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed"
                aria-disabled="true"
                title="Coming soon"
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.key}
              href={hrefs[item.key]}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                isActive
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
