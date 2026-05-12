"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/currentUser";
import { deleteStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";

async function requireAuth() {
  return requireUser();
}

export async function deleteDocument(documentId: string): Promise<{ error?: string }> {
  const user = await requireAuth();

  const doc = await prisma.tenantDocument.findUnique({
    where: { id: documentId, userId: user.id },
  });

  if (!doc) return { error: "Document not found." };

  try {
    await deleteStoredDocument(doc.storageUrl);
  } catch {
    // File may already be gone — continue to remove DB record
  }

  await prisma.tenantDocument.delete({ where: { id: documentId, userId: user.id } });

  revalidatePath(`/tenants/${doc.tenantId}`);
  return {};
}
