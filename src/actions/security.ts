"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/currentUser";
import { generateTotpSecret, getTotpUri, verifyTotpCode } from "@/lib/totp";

export async function beginTwoFactorSetup() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  if (dbUser.twoFactorEnabled) throw new Error("Two-factor authentication is already enabled.");

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  return {
    secret,
    otpauthUri: getTotpUri({ secret, email: dbUser.email }),
  };
}

export async function confirmTwoFactorSetup(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("totpCode") ?? "");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorSecret: true },
  });
  if (!dbUser?.twoFactorSecret || !verifyTotpCode(dbUser.twoFactorSecret, code)) {
    return { error: "Invalid two-factor code." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });
  revalidatePath("/settings");
  return {};
}

export async function disableTwoFactor() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  revalidatePath("/settings");
}
