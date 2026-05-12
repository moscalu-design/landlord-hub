"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signOut } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SignupSchema } from "@/lib/validations";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type SignupState = {
  error?: string;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the signup details." };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      password: hashedPassword,
      name: parsed.data.name,
      phone: parsed.data.phone,
      role: "USER",
    },
  });

  redirect("/login?signup=success");
}
