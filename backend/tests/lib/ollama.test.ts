import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAllowedModel,
  ollamaGenerateLeadOpportunities,
  ollamaGenerateSummary,
  ollamaWarmup
} from "../../src/lib/ollama";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ollama helpers", () => {
  it("assertAllowedModel rejects unknown models", () => {
    expect(() => assertAllowedModel("bad-model")).toThrow("model_not_allowed");
  });

  it("ollamaWarmup throws when upstream is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(ollamaWarmup("qwen2.5:1.5b")).rejects.toThrow("ollama_unavailable");
  });

  it("ollamaGenerateSummary extracts summary from fenced json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: "```json\n{\"summary\":\"Summary: follow-up needed\"}\n```" })
      })
    );

    const result = await ollamaGenerateSummary("qwen2.5:1.5b", "transcript text");

    expect(result.text).toBe("follow-up needed");
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("ollamaGenerateLeadOpportunities normalizes response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify([
            {
              title: "Rebook check-in",
              reason: "Missed last visit",
              next_action: "Call and ask if they want to revisit; share options if they opt in.",
              outreach_channel: "sms",
              lead_score: 1.4,
              due_in_days: 50
            }
          ])
        })
      })
    );

    const result = await ollamaGenerateLeadOpportunities("llama3.2:1b", "transcript text");

    expect(result.items).toEqual([
      {
        title: "Rebook check-in",
        reason: "Missed last visit",
        next_action: "Call and ask if they want to revisit; share options if they opt in.",
        outreach_channel: "text",
        lead_score: 1,
        due_in_days: 30
      }
    ]);
  });
});
