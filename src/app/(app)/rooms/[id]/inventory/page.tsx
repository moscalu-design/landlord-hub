import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { RoomInventoryManager } from "@/components/inventory/RoomInventoryManager";
import { InventoryInspectionView } from "@/components/inventory/InventoryInspectionView";
import prisma from "@/lib/prisma";

export default async function RoomInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      property: true,
      inventoryItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      occupancies: {
        where: { status: { in: ["ACTIVE", "ENDED"] } },
        include: {
          tenant: true,
          inspections: {
            include: {
              items: {
                include: { inventoryItem: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { date: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!room) notFound();

  const activeOccupancy = room.occupancies.find((o) => o.status === "ACTIVE");

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Inventory"
        description={`${room.name} · ${room.property.name}`}
        actions={
          <>
            <Link
              href={`/properties/${room.propertyId}`}
              data-testid="inventory-parent-property-link"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Property
            </Link>
            <Link
              href={`/rooms/${id}`}
              data-testid="inventory-parent-room-link"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Room
            </Link>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <RoomInventoryManager
          roomId={id}
          items={room.inventoryItems}
          activeOccupancyId={activeOccupancy?.id ?? null}
        />

        {room.occupancies.map((occupancy) => (
          <InventoryInspectionView
            key={occupancy.id}
            roomId={id}
            occupancy={occupancy}
            inventoryItems={room.inventoryItems}
          />
        ))}
      </div>
    </div>
  );
}
