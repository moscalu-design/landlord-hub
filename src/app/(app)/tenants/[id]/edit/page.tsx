import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantForm } from "@/components/tenants/TenantForm";
import prisma from "@/lib/prisma";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Edit Tenant"
        description={`${tenant.firstName} ${tenant.lastName}`}
        actions={
          <Link
            href={`/tenants/${id}`}
            data-testid="edit-tenant-parent-link"
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Tenant
          </Link>
        }
      />
      <div className="flex-1 p-4 sm:p-6">
        <TenantForm tenant={tenant} />
      </div>
    </div>
  );
}
