import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { TenantForm } from "@/components/tenants/TenantForm";

export default function NewTenantPage() {
  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="New Tenant"
        description="Create a new tenant profile"
        actions={
          <Link
            href="/tenants"
            data-testid="new-tenant-list-link"
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Tenants
          </Link>
        }
      />
      <div className="flex-1 p-6">
        <TenantForm />
      </div>
    </div>
  );
}
