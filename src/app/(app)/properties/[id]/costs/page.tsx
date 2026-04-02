import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { CostsCategoryChart } from "@/components/properties/CostsCategoryChart";
import { PropertyExpensesSection } from "@/components/properties/PropertyExpensesSection";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import prisma from "@/lib/prisma";

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

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={property.name}
        description={`${property.address}, ${property.city}`}
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="costs" />

        <CostsCategoryChart expenses={property.expenses} />

        <PropertyExpensesSection propertyId={id} expenses={property.expenses} />
      </div>
    </div>
  );
}
