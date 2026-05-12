"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";
import { PropertySchema } from "@/lib/validations";

async function requireAuth() {
  return requireUser();
}

export async function createProperty(formData: FormData) {
  const user = await requireAuth();
  const validated = PropertySchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postcode: formData.get("postcode") || undefined,
    country: formData.get("country") || "UK",
    propertyType: formData.get("propertyType") || "HOUSE",
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  const property = await prisma.property.create({
    data: {
      userId: user.id,
      ...validated,
      notes: validated.notes || null,
      postcode: validated.postcode || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "PROPERTY_CREATED",
      description: `Property "${property.name}" created`,
      entityType: "PROPERTY",
      entityId: property.id,
      userId: user.id,
      propertyId: property.id,
    },
  });

  revalidatePath("/properties");
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(id: string, formData: FormData) {
  const user = await requireAuth();
  const validated = PropertySchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postcode: formData.get("postcode") || undefined,
    country: formData.get("country") || "UK",
    propertyType: formData.get("propertyType") || "HOUSE",
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  await prisma.property.update({
    where: { id, userId: user.id },
    data: {
      ...validated,
      notes: validated.notes || null,
      postcode: validated.postcode || null,
    },
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  redirect(`/properties/${id}`);
}

export async function archiveProperty(id: string) {
  const user = await requireAuth();
  await prisma.property.update({ where: { id, userId: user.id }, data: { status: "ARCHIVED" } });
  revalidatePath("/properties");
  redirect("/properties");
}
