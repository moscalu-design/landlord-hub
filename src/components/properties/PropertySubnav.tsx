import Link from "next/link";

const ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "mortgages", label: "Mortgages" },
  { key: "costs", label: "Costs" },
] as const;

type SubnavKey = typeof ITEMS[number]["key"];

export function PropertySubnav({
  propertyId,
  active,
}: {
  propertyId: string;
  active: SubnavKey;
}) {
  const hrefs: Record<SubnavKey, string> = {
    overview: `/properties/${propertyId}`,
    mortgages: `/properties/${propertyId}/mortgages`,
    costs: `/properties/${propertyId}/costs`,
  };

  return (
    <nav
      aria-label="Property sections"
      className="-mx-4 px-4 sm:mx-0 sm:px-0"
    >
      <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-sm">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={hrefs[item.key]}
              aria-current={isActive ? "page" : undefined}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors sm:text-sm sm:px-4 sm:py-2 ${
                isActive
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
