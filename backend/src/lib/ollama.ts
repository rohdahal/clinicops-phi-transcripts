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
    "Summarize the transcript concisely for an ops dashboard. Output format requirements:\n" +
    "- Return ONLY the summary content (no preamble, no titles, no labels, no markdown headings).\n" +
    "- Use either a single short paragraph OR short bullet points.\n" +
    "- If using bullets, do NOT label them (no 'Symptoms:', 'Context:', etc.).\n" +
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

    return { text, latency_ms: Date.now() - start };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ollama_unavailable");
    }
    throw new Error("ollama_unavailable");
  }
}
