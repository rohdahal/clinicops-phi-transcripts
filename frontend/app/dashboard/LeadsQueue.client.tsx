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
  open: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-sky-100 text-sky-800 border-sky-200",
  contacted: "bg-indigo-100 text-indigo-800 border-indigo-200",
  qualified: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed_won: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed_lost: "bg-rose-100 text-rose-800 border-rose-200",
  dismissed: "bg-slate-200 text-slate-700 border-slate-300",
  superseded: "bg-slate-200 text-slate-700 border-slate-300"
};

const readTranscriptMeta = (value: LeadRow["transcripts"]) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

const formatStatus = (status: string) => status.replaceAll("_", " ");
const scoreTone = (score: number) => {
  if (score >= 0.8) return "bg-emerald-700";
  if (score >= 0.6) return "bg-amber-600";
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

  const filteredLeads = useMemo(() => {
    if (mode === "transcript") {
      return leads;
    }

    if (filter === "all") {
      return leads;
    }

    const now = Date.now();
    const activeSet = new Set(["open", "in_progress", "contacted", "qualified"]);

    return leads.filter((lead) => {
      if (!activeSet.has(lead.status)) {
        return false;
      }
      if (filter === "overdue") {
        return lead.due_at ? new Date(lead.due_at).getTime() < now : false;
      }
      return true;
    });
  }, [filter, leads, mode]);

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
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        No lead opportunities yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === "dashboard" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === "active"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setFilter("overdue")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === "overdue"
                ? "border-rose-700 bg-rose-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Overdue
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All
          </button>
        </div>
      ) : null}

      {filteredLeads.length === 0 ? (
        <p className="text-sm text-slate-500">No leads for this filter.</p>
      ) : null}

      {filteredLeads.map((lead) => {
        const transcriptMeta = readTranscriptMeta(lead.transcripts);
        const isBusy = updatingId === lead.id;
        const isOverdue = lead.due_at
          ? new Date(lead.due_at).getTime() < Date.now()
          : false;

        return (
          <article
            key={lead.id}
            className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
              isOverdue
                ? "border-rose-200 bg-gradient-to-r from-rose-50/70 to-white"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{lead.title}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${
                  statusTone[lead.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {formatStatus(lead.status)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] text-white ${scoreTone(
                  lead.lead_score
                )}`}
              >
                {Math.round(lead.lead_score * 100)}% score
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-700">{lead.reason}</p>
            <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
              Next action: {lead.next_action}
            </p>

            <div className="mt-2 text-xs text-slate-500">
              {lead.due_at ? `Due ${new Date(lead.due_at).toLocaleDateString()}` : "No due date"}
              {mode === "dashboard" ? (
                <>
                  {" · "}
                  <a
                    className="underline"
                    href={`/transcripts/${lead.transcript_id}?from=dashboard`}
                  >
                    {transcriptMeta?.patient_pseudonym ?? lead.transcript_id}
                  </a>
                </>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void setStatus(lead.id, "in_progress")}
                disabled={isBusy}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => void setStatus(lead.id, "contacted")}
                disabled={isBusy}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Contacted
              </button>
              <button
                type="button"
                onClick={() => void setStatus(lead.id, "qualified")}
                disabled={isBusy}
                className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Qualified
              </button>
              <button
                type="button"
                onClick={() => void setStatus(lead.id, "dismissed")}
                disabled={isBusy}
                className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </article>
        );
      })}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
