import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  buildAccountExport: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/accountExport", () => ({
  buildAccountExport: mocks.buildAccountExport,
}));

import { GET } from "./route";

describe("GET /api/settings/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.buildAccountExport).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and returns a ZIP attachment", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "USER",
      },
    });
    mocks.buildAccountExport.mockResolvedValue({
      filename: "rental-app-export_2026-05-11_1020.zip",
      buffer: Buffer.from("zip-data"),
    });

    const response = await GET();

    expect(mocks.buildAccountExport).toHaveBeenCalledWith({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      role: "USER",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain(
      "rental-app-export_2026-05-11_1020.zip"
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("zip-data");
  });
});
