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
  accessToken?: string;
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

  const headers = new Headers();

  if (params.accessToken) {
    headers.set("Authorization", `Bearer ${params.accessToken}`);
  }

  const response = await fetch(
    `${getBackendBaseUrl()}/v1/transcripts?${searchParams.toString()}`,
    { cache: "no-store", headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to load transcripts (${response.status})`);
  }

  return (await response.json()) as TranscriptListResponse;
}

export async function fetchTranscriptById(
  id: string,
  options?: { accessToken?: string; from?: string | null }
) {
  const headers = new Headers();

  if (options?.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const searchParams = new URLSearchParams();

  if (options?.from) {
    searchParams.set("from", options.from);
  }

  const querySuffix = searchParams.toString()
    ? `?${searchParams.toString()}`
    : "";

  const response = await fetch(
    `${getBackendBaseUrl()}/v1/transcripts/${encodeURIComponent(id)}${querySuffix}`,
    { cache: "no-store", headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to load transcript (${response.status})`);
  }

  return (await response.json()) as TranscriptDetail;
}
