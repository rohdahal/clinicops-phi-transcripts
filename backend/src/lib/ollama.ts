const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export type AllowedModel = "qwen2.5:1.5b" | "llama3.2:1b";

export function assertAllowedModel(model: string): asserts model is AllowedModel {
  if (model !== "qwen2.5:1.5b" && model !== "llama3.2:1b") {
    throw new Error("model_not_allowed");
  }
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const cleanSummaryOutput = (text: string) => {
  let cleaned = text.trim();

  // Strip common heading/preamble patterns models may prepend.
  cleaned = cleaned.replace(/^#{1,6}\s*summary\s*:?\s*/i, "");
  cleaned = cleaned.replace(/^summary\s*:?\s*/i, "");
  cleaned = cleaned.replace(/^\s*[-*]\s*\*\*[^*]+\*\*:\s*/gim, "- ");
  cleaned = cleaned.replace(/^\s*\*\*[^*]+\*\*:\s*/gim, "");

  return cleaned.trim();
};

const parseSummaryResponse = (text: string) => {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate) as { summary?: unknown };
      if (typeof parsed.summary === "string" && parsed.summary.trim().length > 0) {
        return parsed.summary.trim();
      }
    } catch {
      // ignore parse errors
    }
    return null;
  };

  const direct = tryParse(unfenced);
  if (direct) {
    return direct;
  }

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const extracted = tryParse(unfenced.slice(start, end + 1));
    if (extracted) {
      return extracted;
    }
  }

  const summaryField = unfenced.match(/"summary"\s*:\s*"([\s\S]*?)"/i);
  if (summaryField?.[1]) {
    return summaryField[1].trim();
  }

  return unfenced;
};

export async function ollamaWarmup(model: AllowedModel): Promise<void> {
  try {
    const response = await fetchWithTimeout(
      `${ollamaBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: "ping", stream: false })
      },
      60000
    );

    if (!response.ok) {
      throw new Error("ollama_unavailable");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ollama_unavailable");
    }
    throw new Error("ollama_unavailable");
  }
}

export async function ollamaGenerateSummary(
  model: AllowedModel,
  redactedText: string
): Promise<{ text: string; latency_ms: number }> {
  const prompt =
    "Summarize the transcript concisely for an ops dashboard.\n" +
    "Output must be STRICT JSON object only with one key:\n" +
    '- {"summary":"..."}\n' +
    "Do not output markdown, headings, labels, or any extra keys.\n" +
    "Keep summary to one short paragraph or concise unlabeled bullets.\n" +
    "Content rules: do not invent facts, do not include PHI, keep it neutral and concise.\n\n" +
    "Transcript:\n" +
    redactedText;

  const start = Date.now();

  try {
    const response = await fetchWithTimeout(
      `${ollamaBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false })
      },
      30000
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ollama_error:${response.status}:${body}`);
    }

    const data = (await response.json()) as { response?: string };
    const text = data.response?.trim();

    if (!text) {
      throw new Error("ollama_unavailable");
    }

    const parsed = parseSummaryResponse(text);
    return { text: cleanSummaryOutput(parsed), latency_ms: Date.now() - start };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ollama_unavailable");
    }
    throw new Error("ollama_unavailable");
  }
}

type RawLeadOpportunity = {
  title?: unknown;
  reason?: unknown;
  next_action?: unknown;
  outreach_channel?: unknown;
  lead_score?: unknown;
  due_in_days?: unknown;
};

type OutreachChannel = "call" | "text" | "email";

export type LeadOpportunityDraft = {
  title: string;
  reason: string;
  next_action: string;
  outreach_channel: OutreachChannel;
  lead_score: number;
  due_in_days: number;
};

const normalizeOutreachChannel = (value: unknown): OutreachChannel => {
  if (typeof value !== "string") {
    return "text";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "call" || normalized === "phone") {
    return "call";
  }
  if (normalized === "email") {
    return "email";
  }
  if (normalized === "text" || normalized === "sms") {
    return "text";
  }
  return "text";
};

const parseLeadsJson = (text: string): RawLeadOpportunity[] => {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? (parsed as RawLeadOpportunity[]) : [];
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start < 0 || end < 0 || end <= start) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      return Array.isArray(parsed) ? (parsed as RawLeadOpportunity[]) : [];
    } catch {
      return [];
    }
  }
};

const normalizeLeadDrafts = (raw: RawLeadOpportunity[]): LeadOpportunityDraft[] => {
  return raw
    .map((item) => {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const reason = typeof item.reason === "string" ? item.reason.trim() : "";
      const nextAction =
        typeof item.next_action === "string" ? item.next_action.trim() : "";
      const score =
        typeof item.lead_score === "number" && Number.isFinite(item.lead_score)
          ? item.lead_score
          : 0.5;
      const dueInDays =
        typeof item.due_in_days === "number" && Number.isFinite(item.due_in_days)
          ? item.due_in_days
          : 3;

      if (!title || !reason || !nextAction) {
        return null;
      }

      return {
        title,
        reason,
        next_action: nextAction,
        outreach_channel: normalizeOutreachChannel(item.outreach_channel),
        lead_score: Math.max(0, Math.min(1, score)),
        due_in_days: Math.max(0, Math.min(30, Math.round(dueInDays)))
      };
    })
    .filter((item): item is LeadOpportunityDraft => item !== null)
    .slice(0, 1);
};

export async function ollamaGenerateLeadOpportunities(
  model: AllowedModel,
  redactedText: string
): Promise<{ items: LeadOpportunityDraft[]; latency_ms: number }> {
  const prompt =
    "You are extracting retention leads from a professional transcript/notes between a licensed healthcare provider and a patient.\n" +
    "The business goal is medical-provider retention and patient re-engagement with the same provider/practice.\n" +
    "Output must be STRICT JSON array only, no markdown, no extra text.\n" +
    "Each array item keys:\n" +
    '- "title": concise lead title\n' +
    '- "reason": why this is an opportunity based on transcript facts\n' +
    '- "next_action": concrete provider-staff follow-up action sentence\n' +
    '- "outreach_channel": one of "call", "text", "email"\n' +
    '- "lead_score": number 0.0 to 1.0\n' +
    '- "due_in_days": integer 0 to 30\n' +
    "Rules: no PHI, no invented facts, return exactly one best lead when present, otherwise return [].\n" +
    "Critical constraints for next_action:\n" +
    "- Must be what provider staff should do (call, email, schedule, rebook, adherence check-in).\n" +
    "- Must drive retention/revenue for this provider.\n" +
    "- Must start with outreach/check-in, not direct scheduling.\n" +
    "- Scheduling must happen only at patient will (after patient confirms interest/availability).\n" +
    "- Frame scheduling as conditional follow-on, never as an immediate directive.\n" +
    "- Focus on contact for revisit intent and readiness for next visit.\n" +
    "- Must NOT be patient self-care advice.\n" +
    "- Must NOT recommend referral-out as primary action.\n" +
    "Good examples of next_action style:\n" +
    '- "Call to check whether sleep symptoms are still impacting daily function and ask if they want to revisit; share slots only if they confirm."\n' +
    '- "Send a check-in email about the missed visit and ask if they want to continue care; provide booking options only after they opt in."\n' +
    '- "Send medication adherence check-in and ask whether they want a follow-up discussion; schedule only if they request it."\n\n' +
    "Transcript:\n" +
    redactedText;

  const start = Date.now();

  try {
    const response = await fetchWithTimeout(
      `${ollamaBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false })
      },
      30000
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ollama_error:${response.status}:${body}`);
    }

    const data = (await response.json()) as { response?: string };
    const text = data.response?.trim();

    if (!text) {
      throw new Error("ollama_unavailable");
    }

    const parsed = parseLeadsJson(text);
    const items = normalizeLeadDrafts(parsed);
    return { items, latency_ms: Date.now() - start };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ollama_unavailable");
    }
    throw new Error("ollama_unavailable");
  }
}
