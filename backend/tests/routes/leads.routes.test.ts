import fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder, queueTableBuilders } from "../helpers/supabaseQueryMock";

const { supabaseAdminMock, logAuditEventMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() },
  logAuditEventMock: vi.fn()
}));

vi.mock("../../src/lib/supabaseAdmin", () => ({
  supabaseAdmin: supabaseAdminMock
}));

vi.mock("../../src/lib/audit", () => ({
  logAuditEvent: logAuditEventMock
}));

vi.mock("../../src/plugins/authUser", () => ({
  authUserPlugin: async () => {},
  authUser: async (request: { user?: { id: string; email: string } }) => {
    request.user = { id: "user-1", email: "user@example.com" };
  }
}));

import { leadsRoutes } from "../../src/routes/leads.routes";

describe("leadsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid_status for unknown status", async () => {
    const app = fastify();
    await app.register(leadsRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/leads/lead-1/status",
      payload: { status: "bad_status" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_status" });

    await app.close();
  });

  it("returns not_found when lead does not exist", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      lead_opportunities: [createQueryBuilder({ data: null, error: null })]
    });

    const app = fastify();
    await app.register(leadsRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/leads/lead-404/status",
      payload: { status: "open" }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });

    await app.close();
  });

  it("updates lead status and logs audit event", async () => {
    const fetchLead = createQueryBuilder({
      data: { id: "lead-1", transcript_id: "t1", status: "open" },
      error: null
    });
    const updateLead = createQueryBuilder({ error: null });

    supabaseAdminMock.from = queueTableBuilders({
      lead_opportunities: [fetchLead, updateLead]
    });

    const app = fastify();
    await app.register(leadsRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/leads/lead-1/status",
      payload: { status: "contacted", notes: "Reached out" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(updateLead.update).toHaveBeenCalledTimes(1);
    expect(updateLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "contacted",
        notes: "Reached out",
        last_contacted_at: expect.any(String)
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "lead",
        entity_id: "lead-1",
        action: "lead.status_updated"
      })
    );

    await app.close();
  });
});
