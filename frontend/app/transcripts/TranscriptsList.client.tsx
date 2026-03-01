"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  fetchTranscriptsPage,
  type TranscriptListItem
} from "@/src/lib/backend";

type Props = {
  initialItems: TranscriptListItem[];
  initialNextOffset: number | null;
  initialHasMore: boolean;
  initialTotalCount: number;
  accessToken?: string;
  sourceOptions: string[];
  initialFilters?: {
    source?: string;
    patient_pseudonym?: string;
  };
};

const PAGE_SIZE = 20;

export default function TranscriptsList({
  initialItems,
  initialNextOffset,
  initialHasMore,
  initialTotalCount,
  accessToken,
  sourceOptions,
  initialFilters
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [patientFilter] = useState(initialFilters?.patient_pseudonym ?? "");
  const [serverSource] = useState(initialFilters?.source ?? "");
  const availableSources = useMemo(() => {
    const combined = [...sourceOptions];
    for (const item of items) {
      const source = item.source?.trim();
      if (source && !combined.includes(source)) {
        combined.push(source);
      }
    }
    return combined.sort((a, b) => a.localeCompare(b));
  }, [items, sourceOptions]);

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

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageStart = pageIndex * PAGE_SIZE;
  const pagedItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPageIndex(0);
  }, [searchText, selectedSource]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  const handleLoadMore = async (): Promise<number> => {
    if (!hasMore || nextOffset === null) {
      return 0;
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
      setTotalCount(response.total_count);
      return response.items.length;
    } catch {
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = async () => {
    if (pageIndex < totalPages - 1) {
      setPageIndex((current) => current + 1);
      return;
    }

    if (hasMore && !loading) {
      const appended = await handleLoadMore();
      if (appended > 0) {
        setPageIndex((current) => current + 1);
      }
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
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
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
            {pagedItems.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => handleRowClick(item.id)}>
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{item.patient_pseudonym}</td>
                <td className="px-4 py-3">{item.source}</td>
                <td className="px-4 py-3">{item.source_ref ?? "-"}</td>
                <td className="px-4 py-3">
                  <Link
                    className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    href={`/transcripts/${item.id}?from=inbox`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {pagedItems.length === 0 ? (
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
          Showing {filteredItems.length === 0 ? 0 : pageStart + 1}-
          {Math.min(pageStart + PAGE_SIZE, filteredItems.length)} of {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
            className="btn-secondary"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={pageIndex === 0}
            className="btn-secondary"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => void handleNextPage()}
            disabled={loading || (pageIndex >= totalPages - 1 && !hasMore)}
            className="btn-secondary"
          >
            {loading ? "Loading..." : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
