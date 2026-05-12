import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { RoomForm } from "@/components/rooms/RoomForm";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/currentUser";

export default async function NewRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const property = await prisma.property.findUnique({ where: { id, userId: user.id } });
  if (!property) notFound();
  if (property.rentalMode === "FULL_PROPERTY") {
    redirect(`/properties/${id}`);
  }

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Add Room"
        description={property.name}
        actions={
          <Link
            href={`/properties/${id}`}
            data-testid="new-room-parent-property-link"
            className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Property
          </Link>
        }
      />
      <div className="flex-1 p-4 sm:p-6">
        <RoomForm propertyId={id} />
      </div>
    </div>
  );
}
