import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAccountExport } from "@/lib/accountExport";

export const runtime = "nodejs";

const EXPORT_COOLDOWN_MS = 60_000;
const recentExports = new Map<string, number>();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const lastExportAt = recentExports.get(session.user.id) ?? 0;
    if (now - lastExportAt < EXPORT_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait before requesting another export." },
        { status: 429 }
      );
    }
    recentExports.set(session.user.id, now);

    const { filename, buffer } = await buildAccountExport({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as { role?: string | null }).role,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[settings/export] Failed to generate account export:", error);
    return NextResponse.json(
      { error: "Unable to generate export. Please try again." },
      { status: 500 }
    );
  }
}
