"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LeadRow = {
  id: string;
  created_at: string;
  transcript_id: string;
  title: string;
  reason: string;
  next_action: string;
  lead_score: number;
  status: string;
  due_at: string | null;
  transcripts?:
    | { patient_pseudonym?: string | null; source?: string | null }
    | Array<{ patient_pseudonym?: string | null; source?: string | null }>
    | null;
};

type Props = {
  leads: LeadRow[];
  accessToken: string;
  backendBaseUrl: string;
  mode?: "dashboard" | "transcript";
};

const statusTone: Record<string, string> = {
  open: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-slate-100 text-slate-700 border-slate-200",
  contacted: "bg-slate-100 text-slate-700 border-slate-200",
  qualified: "bg-slate-100 text-slate-700 border-slate-200",
  closed_won: "bg-slate-100 text-slate-700 border-slate-200",
  closed_lost: "bg-slate-100 text-slate-700 border-slate-200",
  dismissed: "bg-slate-100 text-slate-700 border-slate-200",
  superseded: "bg-slate-100 text-slate-700 border-slate-200"
};

const readTranscriptMeta = (value: LeadRow["transcripts"]) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const formatStatus = (status: string) => status.replaceAll("_", " ");
const scoreTone = (score: number) => {
  if (score >= 0.8) return "bg-slate-800";
  if (score >= 0.6) return "bg-slate-700";
  return "bg-slate-700";
};

export default function LeadsQueue({
  leads,
  accessToken,
  backendBaseUrl,
  mode = "dashboard"
}: Props) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "overdue" | "all">("active");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "due_soon" | "newest">("priority");

  const filteredLeads = useMemo(() => {
    let items = [...leads];
    const now = Date.now();
    const activeSet = new Set(["open", "in_progress", "contacted", "qualified"]);

    if (mode === "dashboard") {
      if (filter !== "all") {
        items = items.filter((lead) => {
          if (!activeSet.has(lead.status)) {
            return false;
          }
          if (filter === "overdue") {
            return lead.due_at ? new Date(lead.due_at).getTime() < now : false;
          }
          return true;
        });
      }

      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery) {
        items = items.filter((lead) => {
          const transcriptMeta = readTranscriptMeta(lead.transcripts);
          return (
            lead.title.toLowerCase().includes(normalizedQuery) ||
            lead.reason.toLowerCase().includes(normalizedQuery) ||
            (transcriptMeta?.patient_pseudonym ?? "").toLowerCase().includes(normalizedQuery)
          );
        });
      }

      items.sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "due_soon") {
          const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
          const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
          return aDue - bDue;
        }
        const scoreDiff = b.lead_score - a.lead_score;
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return items;
  }, [filter, leads, mode, query, sortBy]);

  const setStatus = async (leadId: string, status: string) => {
    setUpdatingId(leadId);
    setError(null);

    try {
      const response = await fetch(`${backendBaseUrl}/v1/leads/${leadId}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`Failed to update lead (${response.status})`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setUpdatingId(null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600">
        No lead opportunities yet.
      </div>
    );
  }

  return (
    <div className={mode === "dashboard" ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3"}>
      {mode === "dashboard" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/95 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, patient, reason"
              className="field !mt-0 h-9 min-w-[14rem] flex-1 !py-1.5"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "priority" | "due_soon" | "newest")}
              className="field !mt-0 h-9 min-w-[9rem] !py-1.5"
            >
              <option value="priority">Priority</option>
              <option value="due_soon">Due soon</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`chip transition ${
                filter === "active"
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilter("overdue")}
              className={`chip transition ${
                filter === "overdue"
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Overdue
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`chip transition ${
                filter === "all"
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={
          mode === "dashboard"
            ? "min-h-0 flex-1 max-h-[45rem] space-y-3 overflow-y-auto pr-1"
            : "space-y-3"
        }
      >
        {filteredLeads.length === 0 ? <p className="text-sm text-slate-500">No leads for this filter.</p> : null}

        {filteredLeads.map((lead) => {
          const transcriptMeta = readTranscriptMeta(lead.transcripts);
          const isBusy = updatingId === lead.id;
          const isOverdue = lead.due_at ? new Date(lead.due_at).getTime() < Date.now() : false;

          return (
            <article
              key={lead.id}
              className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isOverdue
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{lead.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${
                      statusTone[lead.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {formatStatus(lead.status)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${scoreTone(lead.lead_score)}`}>
                    {Math.round(lead.lead_score * 100)}% score
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-700">{lead.reason}</p>
              <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">Next action: {lead.next_action}</p>

              <div className="mt-2 text-xs text-slate-500">
                {lead.due_at ? `Due ${new Date(lead.due_at).toLocaleDateString()}` : "No due date"}
                {mode === "dashboard" ? (
                  <>
                    {" · "}
                    <a className="font-medium text-slate-700 underline" href={`/transcripts/${lead.transcript_id}?from=dashboard`}>
                      {transcriptMeta?.patient_pseudonym ?? lead.transcript_id}
                    </a>
                  </>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void setStatus(lead.id, "in_progress")} disabled={isBusy} className="btn-secondary !px-2 !py-1 !text-xs">
                  Start
                </button>
                <button type="button" onClick={() => void setStatus(lead.id, "contacted")} disabled={isBusy} className="btn-secondary !px-2 !py-1 !text-xs">
                  Contacted
                </button>
                <button type="button" onClick={() => void setStatus(lead.id, "qualified")} disabled={isBusy} className="btn-secondary !px-2 !py-1 !text-xs">
                  Qualified
                </button>
                <button type="button" onClick={() => void setStatus(lead.id, "dismissed")} disabled={isBusy} className="btn-secondary !px-2 !py-1 !text-xs">
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}

        {error ? <p className="text-sm font-medium text-slate-700">{error}</p> : null}
      </div>
    </div>
  );
}
