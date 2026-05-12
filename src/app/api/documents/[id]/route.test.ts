import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    tenantDocument: {
      findUnique: vi.fn(),
    },
  },
  readStoredDocument: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("@/lib/documentStorage", () => ({ readStoredDocument: mocks.readStoredDocument }));

import { GET } from "./route";

describe("GET /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
  });

  it("scopes document lookup to the authenticated user", async () => {
    mocks.prisma.tenantDocument.findUnique.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/documents/doc-b"),
      { params: Promise.resolve({ id: "doc-b" }) }
    );

    expect(mocks.prisma.tenantDocument.findUnique).toHaveBeenCalledWith({
      where: { id: "doc-b", userId: "user-a" },
    });
    expect(response.status).toBe(404);
    expect(mocks.readStoredDocument).not.toHaveBeenCalled();
  });
});
