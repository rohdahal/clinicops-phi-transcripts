export type TranscriptListItem = {
  id: string;
  created_at: string;
  patient_pseudonym: string;
  source: string;
  source_ref: string | null;
};

export type TranscriptListResponse = {
  items: TranscriptListItem[];
  limit: number;
  offset: number;
  next_offset: number | null;
  has_more: boolean;
};

export type TranscriptDetail = TranscriptListItem & {
  redacted_text: string;
  meta: Record<string, unknown> | null;
  idempotency_key?: string | null;
};

export function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
}

export async function fetchTranscriptsPage(params: {
  limit?: number;
  offset?: number;
  source?: string;
  patient_pseudonym?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 20));
  searchParams.set("offset", String(params.offset ?? 0));

  if (params.source) {
    searchParams.set("source", params.source);
  }

  if (params.patient_pseudonym) {
    searchParams.set("patient_pseudonym", params.patient_pseudonym);
  }

  const response = await fetch(
    `${getBackendBaseUrl()}/v1/transcripts?${searchParams.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Failed to load transcripts (${response.status})`);
  }

  return (await response.json()) as TranscriptListResponse;
}

export async function fetchTranscriptById(id: string) {
  const response = await fetch(
    `${getBackendBaseUrl()}/v1/transcripts/${encodeURIComponent(id)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Failed to load transcript (${response.status})`);
  }

  return (await response.json()) as TranscriptDetail;
}
