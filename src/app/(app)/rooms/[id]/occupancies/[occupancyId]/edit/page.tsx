import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { OccupancyForm } from "@/components/rooms/OccupancyForm";
import prisma from "@/lib/prisma";

export default async function EditOccupancyPage({
  params,
}: {
  params: Promise<{ id: string; occupancyId: string }>;
}) {
  const { id, occupancyId } = await params;

  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId },
    include: {
      room: {
        include: {
          property: true,
        },
      },
      tenant: true,
    },
  });

  if (!occupancy || occupancy.roomId !== id || occupancy.status !== "ACTIVE") {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Edit Tenancy"
        description={`${occupancy.room.name} · ${occupancy.tenant.firstName} ${occupancy.tenant.lastName}`}
        actions={
          <>
            <Link
              href={`/rooms/${id}`}
              data-testid="edit-occupancy-parent-room-link"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Room
            </Link>
            <Link
              href={`/tenants/${occupancy.tenantId}`}
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Tenant
            </Link>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        <OccupancyForm occupancy={occupancy} tenant={occupancy.tenant} />
      </div>
    </div>
  );
}
