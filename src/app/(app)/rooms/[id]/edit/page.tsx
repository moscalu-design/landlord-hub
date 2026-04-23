import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { RoomForm } from "@/components/rooms/RoomForm";
import prisma from "@/lib/prisma";

export default async function EditRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    include: { property: true },
  });
  if (!room) notFound();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Edit Room"
        description={`${room.name} · ${room.property.name}`}
        actions={
          <>
            <Link
              href={`/properties/${room.propertyId}`}
              data-testid="edit-room-parent-property-link"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Property
            </Link>
            <Link
              href={`/rooms/${id}`}
              data-testid="edit-room-parent-room-link"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Room
            </Link>
          </>
        }
      />
      <div className="flex-1 p-4 sm:p-6">
        <RoomForm propertyId={room.propertyId} room={room} />
      </div>
    </div>
  );
}
