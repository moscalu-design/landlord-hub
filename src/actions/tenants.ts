"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { TenantSchema } from "@/lib/validations";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function parseTenantFormData(formData: FormData) {
  return TenantSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    nationality: formData.get("nationality") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
    idType: formData.get("idType") || undefined,
    idReference: formData.get("idReference") || undefined,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });
}

function buildTenantCreateData(validated: ReturnType<typeof parseTenantFormData>) {
  return {
    ...validated,
    phone: validated.phone || null,
    nationality: validated.nationality || null,
    dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
    emergencyContact: validated.emergencyContact || null,
    idType: validated.idType || null,
    idReference: validated.idReference || null,
    notes: validated.notes || null,
  };
}

export type QuickCreateTenantState = {
  success: boolean;
  error?: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
};

export async function createTenant(formData: FormData) {
  const user = await requireAuth();
  const validated = parseTenantFormData(formData);

  const tenant = await prisma.tenant.create({
    data: buildTenantCreateData(validated),
  });

  await prisma.activityLog.create({
    data: {
      action: "TENANT_CREATED",
      description: `Tenant "${tenant.firstName} ${tenant.lastName}" created`,
      entityType: "TENANT",
      entityId: tenant.id,
      userId: user.id,
      tenantId: tenant.id,
    },
  });

  revalidatePath("/tenants");
  redirect(`/tenants/${tenant.id}`);
}

export async function createTenantForAssignment(
  _prevState: QuickCreateTenantState,
  formData: FormData
): Promise<QuickCreateTenantState> {
  const user = await requireAuth();

  try {
    const validated = parseTenantFormData(formData);

    const existing = await prisma.tenant.findUnique({
      where: { email: validated.email },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: "A tenant with this email already exists.",
      };
    }

    const tenant = await prisma.tenant.create({
      data: buildTenantCreateData(validated),
    });

    await prisma.activityLog.create({
      data: {
        action: "TENANT_CREATED",
        description: `Tenant "${tenant.firstName} ${tenant.lastName}" created`,
        entityType: "TENANT",
        entityId: tenant.id,
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    revalidatePath("/tenants");

    return {
      success: true,
      tenant: {
        id: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        status: tenant.status,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to create tenant.",
    };
  }
}

export async function updateTenant(id: string, formData: FormData) {
  await requireAuth();
  const validated = parseTenantFormData(formData);

  await prisma.tenant.update({
    where: { id },
    data: buildTenantCreateData(validated),
  });

  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  redirect(`/tenants/${id}`);
}

export async function deleteTenant(id: string) {
  await requireAuth();

  const activeOccupancy = await prisma.occupancy.findFirst({
    where: { tenantId: id, status: "ACTIVE" },
    select: { id: true },
  });

  if (activeOccupancy) {
    throw new Error("Cannot delete a tenant with an active tenancy.");
  }

  await prisma.tenant.delete({ where: { id } });

  revalidatePath("/tenants");
  redirect("/tenants");
}
