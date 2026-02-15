"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  fetchTranscriptsPage,
  type TranscriptListItem
} from "@/src/lib/backend";

type Props = {
  initialItems: TranscriptListItem[];
  initialNextOffset: number | null;
  initialHasMore: boolean;
  accessToken?: string;
  initialFilters?: {
    source?: string;
    patient_pseudonym?: string;
  };
};

export default function TranscriptsList({
  initialItems,
  initialNextOffset,
  initialHasMore,
  accessToken,
  initialFilters
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [patientFilter] = useState(initialFilters?.patient_pseudonym ?? "");
  const [serverSource] = useState(initialFilters?.source ?? "");

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedSource && item.source !== selectedSource) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const patient = item.patient_pseudonym.toLowerCase();
      const source = item.source.toLowerCase();
      const sourceRef = (item.source_ref ?? "").toLowerCase();

      return (
        patient.includes(normalizedSearch) ||
        source.includes(normalizedSearch) ||
        sourceRef.includes(normalizedSearch)
      );
    });
  }, [items, searchText, selectedSource]);

  const handleLoadMore = async () => {
    if (!hasMore || nextOffset === null) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetchTranscriptsPage({
        limit: 20,
        offset: nextOffset,
        source: serverSource || undefined,
        patient_pseudonym: patientFilter || undefined,
        accessToken
      });

      setItems((prev) => [...prev, ...response.items]);
      setNextOffset(response.next_offset ?? null);
      setHasMore(response.has_more);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (id: string) => {
    router.push(`/transcripts/${id}?from=inbox`);
  };

  return (
    <div className="mt-6 space-y-4">
      <section className="panel-soft reveal">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
            Filter loaded results
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Filter loaded results..."
              className="field"
            />
          </label>
          <label className="flex w-48 flex-col gap-1 text-xs font-semibold text-slate-600">
            Source
            <select
              value={selectedSource}
              onChange={(event) => setSelectedSource(event.target.value)}
              className="field"
            >
              <option value="">All sources</option>
              <option value="call">call</option>
              <option value="chat">chat</option>
              <option value="note">note</option>
              <option value="import">import</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Filters apply to loaded items.</p>
        {patientFilter || serverSource ? (
          <p className="mt-1 text-xs text-slate-500">
            Database filters active
            {patientFilter ? ` · patient ${patientFilter}` : ""}
            {serverSource ? ` · source ${serverSource}` : ""}
          </p>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/90 shadow-[0_20px_40px_-35px_rgba(0,0,0,0.45)]">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Source Ref</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {filteredItems.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-teal-50/40" onClick={() => handleRowClick(item.id)}>
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.patient_pseudonym}</td>
                <td className="px-4 py-3">{item.source}</td>
                <td className="px-4 py-3">{item.source_ref ?? "-"}</td>
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-teal-700 underline"
                    href={`/transcripts/${item.id}?from=inbox`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  No transcripts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Showing {filteredItems.length} of {items.length} loaded
        </span>
        <button type="button" onClick={handleLoadMore} disabled={!hasMore || loading} className="btn-secondary">
          {loading ? "Loading..." : hasMore ? "Load more" : "No more"}
        </button>
      </div>
    </div>
  );
}
