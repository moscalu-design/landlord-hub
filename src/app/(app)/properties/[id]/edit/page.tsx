import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PropertyForm } from "@/components/properties/PropertyForm";
import prisma from "@/lib/prisma";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Edit Property"
        description={property.name}
        actions={
          <Link
            href={`/properties/${id}`}
            data-testid="edit-property-parent-link"
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Property
          </Link>
        }
      />
      <div className="flex-1 p-6">
        <PropertyForm property={property} />
      </div>
    </div>
  );
}
