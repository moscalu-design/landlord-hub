import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MortgageDetailView } from "@/components/properties/MortgagesSection";
import { PropertySubnav } from "@/components/properties/PropertySubnav";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/currentUser";

export default async function MortgageDetailPage({
  params,
}: {
  params: Promise<{ id: string; mortgageId: string }>;
}) {
  const { id, mortgageId } = await params;
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

  const mortgage = property.mortgages.find((entry) => entry.id === mortgageId);
  if (!mortgage) notFound();

  const mortgageLabel = mortgage.label || mortgage.lender || "Mortgage";

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title={mortgageLabel}
        description={`${property.name} · Mortgage details`}
        actions={
          <Link
            href={`/properties/${id}/mortgages`}
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Back to Mortgages
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        <PropertySubnav propertyId={id} active="mortgages" />

        <MortgageDetailView
          propertyId={id}
          mortgage={mortgage}
          backHref={`/properties/${id}/mortgages`}
        />
      </div>
    </div>
  );
}
