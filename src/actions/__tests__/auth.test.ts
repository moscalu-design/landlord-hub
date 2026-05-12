import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

import { signupAction } from "@/actions/auth";

describe("signupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({ id: "user-new" });
  });

  it("creates a normal isolated user account with phone number", async () => {
    const formData = new FormData();
    formData.set("name", "Friend User");
    formData.set("email", "friend@example.com");
    formData.set("phone", "+352 621 123456");
    formData.set("password", "secure-password");
    formData.set("confirmPassword", "secure-password");

    await expect(signupAction({}, formData)).rejects.toThrow("NEXT_REDIRECT:/login?signup=success");

    expect(mocks.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "friend@example.com",
        name: "Friend User",
        phone: "+352 621 123456",
        role: "USER",
      }),
    });
  });

  it("rejects invalid phone numbers", async () => {
    const formData = new FormData();
    formData.set("name", "Friend User");
    formData.set("email", "friend@example.com");
    formData.set("phone", "abc");
    formData.set("password", "secure-password");
    formData.set("confirmPassword", "secure-password");

    await expect(signupAction({}, formData)).resolves.toEqual({
      error: "Phone number is too short",
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});
