import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    auth: {
      getUser: vi.fn()
    }
  }
}));

vi.mock("../../src/lib/supabaseAdmin", () => ({
  supabaseAdmin: supabaseAdminMock
}));

import { authUser } from "../../src/plugins/authUser";

describe("authUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing authorization header", async () => {
    const request = { headers: {} } as any;
    const send = vi.fn();
    const reply = { code: vi.fn(() => ({ send })) } as any;

    await authUser(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ error: "unauthorized" });
  });

  it("sets request.user for valid bearer token", async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "u@example.com" } },
      error: null
    });

    const request = { headers: { authorization: "Bearer token-1" } } as any;
    const reply = { code: vi.fn(() => ({ send: vi.fn() })) } as any;

    await authUser(request, reply);

    expect(request.user).toEqual({ id: "u1", email: "u@example.com" });
    expect(reply.code).not.toHaveBeenCalled();
  });
});
