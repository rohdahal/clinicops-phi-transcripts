import fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder, queueTableBuilders } from "../helpers/supabaseQueryMock";

const { supabaseAdminMock, logAuditEventMock, ollamaMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() },
  logAuditEventMock: vi.fn(),
  ollamaMock: {
    assertAllowedModel: vi.fn(),
    ollamaGenerateSummary: vi.fn(),
    ollamaGenerateLeadOpportunities: vi.fn(),
    ollamaWarmup: vi.fn()
  }
}));

vi.mock("../../src/lib/supabaseAdmin", () => ({
  supabaseAdmin: supabaseAdminMock
}));

vi.mock("../../src/lib/audit", () => ({
  logAuditEvent: logAuditEventMock
}));

vi.mock("../../src/lib/ollama", () => ollamaMock);

vi.mock("../../src/plugins/authUser", () => ({
  authUserPlugin: async () => {},
  authUser: async (request: { user?: { id: string; email: string } }) => {
    request.user = { id: "user-1", email: "user@example.com" };
  }
}));

import { transcriptsRoutes } from "../../src/routes/transcripts.routes";

describe("transcriptsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists transcripts with pagination metadata", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      transcripts: [
        createQueryBuilder({
          data: [
            { id: "t3", created_at: "2026-02-22T00:00:00.000Z", patient_pseudonym: "P3", source: "note", source_ref: null },
            { id: "t2", created_at: "2026-02-21T00:00:00.000Z", patient_pseudonym: "P2", source: "call", source_ref: null },
            { id: "t1", created_at: "2026-02-20T00:00:00.000Z", patient_pseudonym: "P1", source: "chat", source_ref: null }
          ],
          error: null
        })
      ]
    });

    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/transcripts?limit=2&offset=0" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        limit: 2,
        offset: 0,
        has_more: true,
        next_offset: 2,
        items: expect.arrayContaining([expect.objectContaining({ id: "t3" })])
      })
    );

    await app.close();
  });

  it("rejects transcript create without required fields", async () => {
    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "POST", url: "/v1/transcripts", payload: { source: "call" } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "missing_fields" });

    await app.close();
  });

  it("handles idempotency conflicts by returning existing transcript", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      transcripts: [
        createQueryBuilder({
          data: null,
          error: { code: "23505", message: "duplicate key" }
        }),
        createQueryBuilder({
          data: {
            id: "t-existing",
            idempotency_key: "idem-1",
            patient_pseudonym: "P1",
            source: "call",
            source_ref: null,
            redacted_text: "hello"
          },
          error: null
        })
      ]
    });

    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/transcripts",
      payload: {
        patient_pseudonym: "P1",
        source: "call",
        text: "hello",
        idempotency_key: "idem-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({ id: "t-existing" }));

    await app.close();
  });

  it("returns missing_model when summary model is absent", async () => {
    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "POST", url: "/v1/transcripts/t1/ai/summary", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "missing_model" });

    await app.close();
  });

  it("generates summary artifact and lead", async () => {
    ollamaMock.ollamaGenerateSummary.mockResolvedValue({ text: "summary text", latency_ms: 120 });
    ollamaMock.ollamaGenerateLeadOpportunities.mockResolvedValue({
      items: [
        {
          title: "Follow-up",
          reason: "Reason",
          next_action: "Action",
          outreach_channel: "text",
          lead_score: 0.8,
          due_in_days: 2
        }
      ],
      latency_ms: 88
    });

    const transcriptRow = createQueryBuilder({
      data: { id: "t1", redacted_text: "cleaned" },
      error: null
    });
    const artifactInsert = createQueryBuilder({
      data: {
        id: "a1",
        transcript_id: "t1",
        artifact_type: "summary",
        model: "qwen2.5:1.5b",
        status: "generated",
        content: "summary text",
        meta: { latency_ms: 120 }
      },
      error: null
    });
    const leadUpsert = createQueryBuilder({ error: null });

    supabaseAdminMock.from = queueTableBuilders({
      transcripts: [transcriptRow],
      transcript_artifacts: [artifactInsert],
      lead_opportunities: [leadUpsert]
    });

    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/transcripts/t1/ai/summary",
      payload: { model: "qwen2.5:1.5b" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({ id: "a1", lead_count: 1 }));
    expect(logAuditEventMock).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it("sorts transcript leads by workflow status then score", async () => {
    supabaseAdminMock.from = queueTableBuilders({
      lead_opportunities: [
        createQueryBuilder({
          data: [
            { id: "l-closed", status: "closed_won", lead_score: 0.99, created_at: "2026-02-20T00:00:00.000Z" },
            { id: "l-open-low", status: "open", lead_score: 0.1, created_at: "2026-02-19T00:00:00.000Z" },
            { id: "l-open-high", status: "open", lead_score: 0.9, created_at: "2026-02-21T00:00:00.000Z" }
          ],
          error: null
        })
      ]
    });

    const app = fastify();
    await app.register(transcriptsRoutes, { prefix: "/v1" });

    const response = await app.inject({ method: "GET", url: "/v1/transcripts/t1/leads" });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((row: { id: string }) => row.id)).toEqual([
      "l-open-high",
      "l-open-low",
      "l-closed"
    ]);

    await app.close();
  });
});
