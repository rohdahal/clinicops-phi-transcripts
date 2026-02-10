import TranscriptsList from "./TranscriptsList.client";
import AppHeader from "@/src/components/AppHeader";
import { fetchTranscriptsPage } from "@/src/lib/backend";

type SearchParams = {
  source?: string | string[];
  patient_pseudonym?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams;
};

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default async function TranscriptsPage({ searchParams }: PageProps) {
  const sourceParam = getParamValue(searchParams?.source)?.trim();
  const patientParam = getParamValue(searchParams?.patient_pseudonym)?.trim();
  const filters = {
    source: sourceParam || undefined,
    patient_pseudonym: patientParam || undefined
  };
  const initialData = await fetchTranscriptsPage({
    limit: 20,
    offset: 0,
    ...filters
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Transcripts Inbox" />
      <main className="mx-auto w-full max-w-5xl px-6 py-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Search database
          </h2>
          <form
            action="/transcripts"
            method="get"
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
              Patient pseudonym (exact)
              <input
                name="patient_pseudonym"
                defaultValue={filters.patient_pseudonym ?? ""}
                placeholder="PT-1029"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="flex w-48 flex-col gap-1 text-xs font-semibold text-slate-600">
              Source
              <select
                name="source"
                defaultValue={filters.source ?? ""}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All sources</option>
                <option value="call">call</option>
                <option value="chat">chat</option>
                <option value="note">note</option>
                <option value="import">import</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </section>

        <TranscriptsList
          initialItems={initialData.items}
          initialNextOffset={initialData.next_offset}
          initialHasMore={initialData.has_more}
          initialFilters={filters}
        />
      </main>
    </div>
  );
}
