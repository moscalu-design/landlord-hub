import { notFound } from "next/navigation";
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
      />
      <div className="flex-1 p-6">
        <RoomForm propertyId={room.propertyId} room={room} />
      </div>
    </div>
  );
}
