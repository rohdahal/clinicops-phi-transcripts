import AppHeader from "@/src/components/AppHeader";
import ProcessTranscriptModal from "./ProcessTranscriptModal.client";
import {
  fetchTranscriptArtifacts,
  fetchTranscriptById,
  getBackendBaseUrl
} from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Props = {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: { from?: string | string[] } | Promise<{ from?: string | string[] }>;
};

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default async function TranscriptDetailPage({ params, searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const fromParam = getParamValue(resolvedSearchParams?.from);
  const transcript = await fetchTranscriptById(resolvedParams.id, {
    accessToken,
    from: fromParam ?? null
  });
  let approvedSummary = undefined;

  try {
    const artifacts = await fetchTranscriptArtifacts(resolvedParams.id, {
      accessToken
    });
    approvedSummary = artifacts.find(
      (artifact) =>
        artifact.artifact_type === "summary" && artifact.status === "approved"
    );
  } catch {
    approvedSummary = undefined;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Transcript Detail" backHref="/transcripts" />
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Status: {transcript.status ?? "pending"}
          </div>
          {accessToken ? (
            <ProcessTranscriptModal
              transcript={{
                id: transcript.id,
                created_at: transcript.created_at,
                patient_pseudonym: transcript.patient_pseudonym,
                source: transcript.source,
                source_ref: transcript.source_ref,
                status: transcript.status ?? null
              }}
              accessToken={accessToken}
              backendBaseUrl={getBackendBaseUrl()}
            />
          ) : null}
        </div>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Patient
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {transcript.patient_pseudonym}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Source
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{transcript.source}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Source Ref
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {transcript.source_ref ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Created
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {new Date(transcript.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">Redacted Text</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
            {transcript.redacted_text}
          </p>
        </section>

        {approvedSummary ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-700">
              Approved Summary
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
              {approvedSummary.content}
            </p>
          </section>
        ) : null}

        {transcript.meta ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-700">Meta</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-xs text-slate-700">
              {JSON.stringify(transcript.meta, null, 2)}
            </pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
