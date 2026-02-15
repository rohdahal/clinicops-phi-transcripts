import TranscriptsList from "./TranscriptsList.client";
import AppHeader from "@/src/components/AppHeader";
import { fetchTranscriptsPage } from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type SearchParams = {
  source?: string | string[];
  patient_pseudonym?: string | string[];
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export default async function TranscriptsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const sourceParam = getParamValue(resolvedSearchParams?.source)?.trim();
  const patientParam = getParamValue(resolvedSearchParams?.patient_pseudonym)?.trim();
  const filters = {
    source: sourceParam || undefined,
    patient_pseudonym: patientParam || undefined
  };
  const initialData = await fetchTranscriptsPage({
    limit: 20,
    offset: 0,
    accessToken,
    ...filters
  });

  return (
    <div className="app-shell">
      <AppHeader
        tabs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/transcripts", label: "Transcript Inbox", active: true }
        ]}
      />
      <main className="shell-container">
        <section className="panel reveal">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Search database</h2>
          <form action="/transcripts" method="get" className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
              Patient pseudonym (exact)
              <input
                name="patient_pseudonym"
                defaultValue={filters.patient_pseudonym ?? ""}
                placeholder="PT-1029"
                className="field"
              />
            </label>
            <label className="flex w-48 flex-col gap-1 text-xs font-semibold text-slate-600">
              Source
              <select name="source" defaultValue={filters.source ?? ""} className="field">
                <option value="">All sources</option>
                <option value="call">call</option>
                <option value="chat">chat</option>
                <option value="note">note</option>
                <option value="import">import</option>
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
        </section>

        <TranscriptsList
          initialItems={initialData.items}
          initialNextOffset={initialData.next_offset}
          initialHasMore={initialData.has_more}
          accessToken={accessToken}
          initialFilters={filters}
        />
      </main>
    </div>
  );
}
