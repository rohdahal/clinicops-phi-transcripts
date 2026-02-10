import AppHeader from "@/src/components/AppHeader";
import { fetchTranscriptById } from "@/src/lib/backend";

type Props = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function TranscriptDetailPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const transcript = await fetchTranscriptById(resolvedParams.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Transcript Detail" backHref="/transcripts" />
      <main className="mx-auto w-full max-w-4xl px-6 py-6">

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
