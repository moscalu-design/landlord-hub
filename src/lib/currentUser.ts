import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  const sessionUser = session?.user;
  const userId = sessionUser?.id;
  if (!sessionUser || !userId) redirect("/login");

  return {
    id: userId,
    email: sessionUser.email,
    name: sessionUser.name,
    role: (sessionUser as { role?: string | null }).role,
  };
}

export function ensureOwned<T>(record: T | null | undefined): T {
  if (!record) throw new Error("Not found");
  return record;
}
