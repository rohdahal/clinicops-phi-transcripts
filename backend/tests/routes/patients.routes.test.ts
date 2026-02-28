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

import { patientsRoutes } from "../../src/routes/patients.routes";

describe("patientsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when patient does not exist", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      patients: [createQueryBuilder({ data: null, error: null })]
    });

    const app = fastify();
    await app.register(patientsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/patients/p-404" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });

    await app.close();
  });

  it("returns profile summary with latest interaction", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      patients: [
        createQueryBuilder({
          data: {
            id: "p1",
            pseudonym: "PT-100",
            masked_name: null,
            patient_profile_image_url: null,
            email_masked: "p***@mail.com",
            email_verified: true,
            phone_masked: "***-***-1234",
            phone_verified: false,
            preferred_channel: "text",
            consent_status: "consented"
          },
          error: null
        })
      ],
      transcripts: [
        createQueryBuilder({
          data: [
            {
              id: "t2",
              created_at: "2026-02-20T10:00:00.000Z",
              patient_pseudonym: "PT-100",
              source: "call",
              source_ref: null,
              status: "new"
            }
          ],
          error: null
        })
      ],
      lead_opportunities: [
        createQueryBuilder({
          data: [
            {
              id: "l1",
              created_at: "2026-02-20T11:00:00.000Z",
              transcript_id: "t2",
              lead_score: 0.9,
              status: "open",
              due_at: null
            }
          ],
          error: null
        })
      ]
    });

    const app = fastify();
    await app.register(patientsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/patients/p1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        patient: expect.objectContaining({ id: "p1", display_name: "PT-100" }),
        latest_interaction: expect.objectContaining({ transcript_id: "t2", lead_id: "l1" }),
        recent: { transcript_count: 1, lead_count: 1 }
      })
    );
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
