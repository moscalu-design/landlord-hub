import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { CostsCategoryChart } from "@/components/properties/CostsCategoryChart";
import { PropertyExpensesSection } from "@/components/properties/PropertyExpensesSection";
import { QuickAddCostButton } from "@/components/properties/PropertyCostsSummary";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import prisma from "@/lib/prisma";
import { toDateInputValue } from "@/lib/utils";

export default async function PropertyCostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      expenses: {
        orderBy: [
          { reportingYear: "desc" },
          { reportingMonth: "desc" },
          { paymentDate: "desc" },
        ],
      },
    },
  });

  if (!property) notFound();
  const todayInputValue = toDateInputValue(new Date());

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="costs" />

        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Costs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add one-off bills or recurring costs without leaving this page.
              </p>
            </div>
            <div className="sm:w-auto w-full">
              <QuickAddCostButton
                propertyId={id}
                todayInputValue={todayInputValue}
                className="w-full sm:w-auto text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-4 py-2.5 transition-colors"
              />
            </div>
          </div>
        </div>

        {property.expenses.length === 0 && (
          <div
            data-testid="costs-empty-helper"
            className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-5 py-5"
          >
            <h3 className="text-sm font-medium text-slate-800">No costs recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Use Quick Add for a fast one-off bill or recurring cost, or use the sections
              below when you want the fuller cost form.
            </p>
          </div>
        )}

        <CostsCategoryChart expenses={property.expenses} />

        <PropertyExpensesSection propertyId={id} expenses={property.expenses} />
      </div>
    </div>
  );
}
