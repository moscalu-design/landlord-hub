import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    property: {
      update: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { updateProperty } from "@/actions/properties";

describe("property actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a", email: "a@example.com" } });
    mocks.prisma.property.update.mockResolvedValue({ id: "prop-b" });
  });

  it("updates records only through the current user's owner scope", async () => {
    const formData = new FormData();
    formData.set("name", "Updated");
    formData.set("address", "1 Main Street");
    formData.set("city", "London");
    formData.set("country", "UK");
    formData.set("propertyType", "HOUSE");
    formData.set("status", "ACTIVE");

    await expect(updateProperty("prop-b", formData)).rejects.toThrow("NEXT_REDIRECT:/properties/prop-b");

    expect(mocks.prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop-b", userId: "user-a" },
      })
    );
  });
});
