import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTranscriptArtifacts,
  fetchTranscriptById,
  fetchTranscriptLeads,
  fetchTranscriptsPage,
  getBackendBaseUrl
} from "../../src/lib/backend";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
});

describe("frontend backend client", () => {
  it("uses NEXT_PUBLIC_BACKEND_URL when set", () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.example.com";
    expect(getBackendBaseUrl()).toBe("https://api.example.com");
  });

  it("fetchTranscriptsPage passes filters and token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], limit: 20, offset: 0, next_offset: null, has_more: false })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTranscriptsPage({
      limit: 10,
      offset: 30,
      source: "call",
      patient_pseudonym: "PT-1",
      accessToken: "token-1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/transcripts?limit=10&offset=30&source=call&patient_pseudonym=PT-1"),
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers)
      })
    );

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("fetchTranscriptById adds from query and throws on non-200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(fetchTranscriptById("abc", { from: "inbox" })).rejects.toThrow(
      "Failed to load transcript (404)"
    );
  });

  it("fetchTranscriptArtifacts and fetchTranscriptLeads parse payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "a1" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "l1" }] });

    vi.stubGlobal("fetch", fetchMock);

    const artifacts = await fetchTranscriptArtifacts("t1", { accessToken: "token" });
    const leads = await fetchTranscriptLeads("t1", { accessToken: "token" });

    expect(artifacts).toEqual([{ id: "a1" }]);
    expect(leads).toEqual([{ id: "l1" }]);
  });
});
