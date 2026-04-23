import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { summarizeRooms } from "@/lib/roomOccupancy";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/types";

async function getProperties() {
  return prisma.property.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: {
      rooms: {
        include: {
          occupancies: {
            where: { status: "ACTIVE" },
            select: { status: true, monthlyRent: true },
          },
        },
      },
      _count: { select: { rooms: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function PropertiesPage() {
  const properties = await getProperties();

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Properties"
        description={`${properties.length} active propert${properties.length === 1 ? "y" : "ies"}`}
        actions={
          <Link
            href="/properties/new"
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Property
          </Link>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        {properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            description="Add your first property to get started."
            action={
              <Link
                href="/properties/new"
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Add Property
              </Link>
            }
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {properties.map((property) => {
              const { occupiedRooms, monthlyIncome } = summarizeRooms(property.rooms);
              const totalRooms = property._count.rooms;
              const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

              return (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  data-testid="property-link"
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {property.name}
                        </h3>
                        <p className="text-sm text-slate-500 truncate">
                          {property.address}, {property.city}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                      {PROPERTY_TYPE_LABELS[property.propertyType as PropertyType] ?? property.propertyType}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-lg font-bold text-slate-800">{occupiedRooms}<span className="text-sm text-slate-400 font-medium">/{totalRooms}</span></p>
                      <p className="text-xs text-slate-500">Occupied</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{occupancyRate}<span className="text-sm text-slate-400 font-medium">%</span></p>
                      <p className="text-xs text-slate-500">Occupancy</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(monthlyIncome)}</p>
                      <p className="text-xs text-slate-500">/ month</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
