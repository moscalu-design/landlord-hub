import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MortgagesSection } from "@/components/properties/MortgagesSection";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import {
  getCurrentBalance,
  getMonthlyCostForMonth,
  getMortgageOverview,
} from "@/lib/mortgage";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { requireUser } from "@/lib/currentUser";

function formatMonthYear(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default async function PropertyMortgagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const property = await prisma.property.findUnique({
    where: { id, userId: user.id },
    include: {
      mortgages: {
        include: {
          prepayments: {
            orderBy: { startDate: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!property) notFound();

  const now = new Date();
  const totalMonthlyOutflow = property.mortgages.reduce(
    (sum, mortgage) =>
      sum + getMonthlyCostForMonth(mortgage, now.getFullYear(), now.getMonth() + 1),
    0
  );
  const totalOutstanding = property.mortgages.reduce(
    (sum, mortgage) => sum + getCurrentBalance(mortgage, "actual"),
    0
  );
  const nearestPayoff = property.mortgages
    .map((mortgage) => getMortgageOverview(mortgage, "actual").payoffDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
        actions={
          <Link
            href={`/properties/${id}`}
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Property
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="mortgages" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">{property.mortgages.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Mortgage count</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalMonthlyOutflow)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Monthly outflow</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Outstanding balance</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-4">
            <p className="text-2xl font-bold text-slate-900">{formatMonthYear(nearestPayoff)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Nearest payoff</p>
          </div>
        </div>

        <MortgagesSection
          propertyId={id}
          mortgages={property.mortgages}
          detailsBasePath={`/properties/${id}/mortgages`}
        />
      </div>
    </div>
  );
}
