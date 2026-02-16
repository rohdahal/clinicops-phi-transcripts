import AppHeader from "@/src/components/AppHeader";
import ProcessTranscriptModal from "./ProcessTranscriptModal.client";
import TranscriptLeadsPanel from "./TranscriptLeadsPanel.client";
import {
  fetchTranscriptArtifacts,
  fetchTranscriptById,
  fetchTranscriptLeads,
  type TranscriptArtifact,
  getBackendBaseUrl
} from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
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
  const leads = accessToken
    ? await fetchTranscriptLeads(resolvedParams.id, { accessToken }).catch(() => [])
    : [];
  let approvedSummary: TranscriptArtifact | undefined;
  let latestSummary: TranscriptArtifact | undefined;

  try {
    const artifacts = await fetchTranscriptArtifacts(resolvedParams.id, {
      accessToken
    });
    latestSummary = artifacts.find((artifact) => artifact.artifact_type === "summary");
    approvedSummary = artifacts.find(
      (artifact) => artifact.artifact_type === "summary" && artifact.status === "approved"
    );
  } catch {
    approvedSummary = undefined;
    latestSummary = undefined;
  }

  const leadModel =
    leads[0]?.model === "qwen2.5:1.5b" || leads[0]?.model === "llama3.2:1b"
      ? leads[0].model
      : approvedSummary?.model === "qwen2.5:1.5b" || approvedSummary?.model === "llama3.2:1b"
        ? approvedSummary.model
        : latestSummary?.model === "qwen2.5:1.5b" || latestSummary?.model === "llama3.2:1b"
          ? latestSummary.model
          : null;

  return (
    <div className="app-shell">
      <AppHeader
        backHref="/transcripts"
        tabs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/transcripts", label: "Transcript Inbox", active: true }
        ]}
      />
      <main className="shell-container">
        <section className="panel reveal">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{transcript.patient_pseudonym}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</dt>
              <dd className="mt-1 text-sm text-slate-900">{transcript.source}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Ref</dt>
              <dd className="mt-1 text-sm text-slate-900">{transcript.source_ref ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead Opportunities</dt>
              <dd className="mt-1 text-sm text-slate-900">{leads.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-1 text-sm text-slate-900">{new Date(transcript.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="mt-1 text-sm text-slate-900">{transcript.status ?? "pending"}</dd>
            </div>
          </dl>
          {accessToken ? (
            <div className="mt-4">
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
            </div>
          ) : null}
        </section>

        {accessToken ? (
          <div className="mt-6">
            <TranscriptLeadsPanel
              transcriptId={transcript.id}
              transcriptPatientId={transcript.patient_id ?? null}
              leads={leads}
              accessToken={accessToken}
              backendBaseUrl={getBackendBaseUrl()}
              initialModel={leadModel}
            />
          </div>
        ) : null}

        {approvedSummary ? (
          <section className="panel mt-6 reveal">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Approved Summary</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{approvedSummary.content}</p>
          </section>
        ) : null}

        <section className="panel mt-6 reveal">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Transcript Text</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{transcript.redacted_text}</p>
        </section>
      </main>
    </div>
  );
}
