import fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder, queueTableBuilders } from "../helpers/supabaseQueryMock";

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() }
}));

vi.mock("../../src/lib/supabaseAdmin", () => ({
  supabaseAdmin: supabaseAdminMock
}));

vi.mock("../../src/plugins/authUser", () => ({
  authUserPlugin: async () => {},
  authUser: async (request: { user?: { id: string; email: string } }) => {
    request.user = { id: "user-1", email: "user@example.com" };
  }
}));

import { dashboardRoutes } from "../../src/routes/dashboard.routes";

describe("dashboardRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns metrics payload", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      transcripts: [
        createQueryBuilder({ count: 5, error: null }),
        createQueryBuilder({ count: 7, error: null })
      ],
      transcript_artifacts: [createQueryBuilder({ count: 2, error: null })],
      audit_events: [
        createQueryBuilder({
          data: [{ created_at: new Date().toISOString(), action: "transcript.viewed" }],
          error: null
        }),
        createQueryBuilder({
          data: [{ created_at: "2026-02-20T12:00:00.000Z", action: "transcript.viewed", actor_display: "u", entity_type: "transcript" }],
          error: null
        })
      ],
      lead_opportunities: [
        createQueryBuilder({ count: 4, error: null }),
        createQueryBuilder({ count: 1, error: null }),
        createQueryBuilder({ data: [{ id: "l1", status: "open" }], error: null })
      ]
    });

    const app = fastify();
    await app.register(dashboardRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/dashboard/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        inbox_new: 5,
        processed: 7,
        approved_summaries: 2,
        leads_followup_open: 4,
        leads_followup_overdue: 1,
        recent_activity: expect.any(Array),
        leads_queue: expect.any(Array)
      })
    );

    await app.close();
  });

  it("degrades to safe defaults when queries error", async () => {
    const err = { message: "boom" };

    supabaseAdminMock.from = queueTableBuilders({
      transcripts: [
        createQueryBuilder({ count: null, error: err }),
        createQueryBuilder({ count: null, error: err })
      ],
      transcript_artifacts: [createQueryBuilder({ count: null, error: err })],
      audit_events: [
        createQueryBuilder({ data: null, error: err }),
        createQueryBuilder({ data: null, error: err })
      ],
      lead_opportunities: [
        createQueryBuilder({ count: null, error: err }),
        createQueryBuilder({ count: null, error: err }),
        createQueryBuilder({ data: null, error: err })
      ]
    });

    const app = fastify();
    await app.register(dashboardRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/dashboard/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        inbox_new: 0,
        processed: 0,
        approved_summaries: 0,
        leads_followup_open: 0,
        leads_followup_overdue: 0,
        recent_activity: [],
        leads_queue: []
      })
    );

    await app.close();
  });
});
