"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

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
    | { patient_id?: string | null; patient_pseudonym?: string | null; source?: string | null }
    | Array<{ patient_id?: string | null; patient_pseudonym?: string | null; source?: string | null }>
    | null;
};

type Props = {
  leads: LeadRow[];
  accessToken: string;
  backendBaseUrl: string;
  mode?: "dashboard" | "transcript";
};

type PatientProfileData = {
  patient: {
    id: string;
    pseudonym: string;
    display_name: string;
    patient_profile_image_url: string | null;
    email_masked: string | null;
    email_verified: boolean;
    phone_masked: string | null;
    phone_verified: boolean;
    preferred_channel: string;
    consent_status: string;
  };
  latest_interaction: {
    transcript_id: string;
    transcript_created_at: string;
    lead_id: string | null;
    lead_status: string | null;
  } | null;
  recent: {
    transcript_count: number;
    lead_count: number;
  };
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
const getScoreTier = (score: number) => {
  if (score >= 0.8) return { label: "High", dotClass: "bg-emerald-500" };
  if (score >= 0.5) return { label: "Medium", dotClass: "bg-amber-500" };
  return { label: "Low", dotClass: "bg-slate-400" };
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function LeadsQueue({
  leads,
  accessToken,
  backendBaseUrl,
  mode = "dashboard"
}: Props) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openMenuLeadId, setOpenMenuLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "overdue" | "all">("active");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "due_soon" | "newest">("priority");
  const [selectedPatient, setSelectedPatient] = useState<PatientProfileData | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (!openMenuLeadId) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-lead-actions-root='true']")) {
        return;
      }
      setOpenMenuLeadId(null);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [openMenuLeadId]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedPatientId]);

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

      setOpenMenuLeadId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setUpdatingId(null);
    }
  };

  const openPatientModal = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setPatientLoading(true);
    setPatientError(null);
    setSelectedPatient(null);

    try {
      const response = await fetch(`${backendBaseUrl}/v1/patients/${encodeURIComponent(patientId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Failed to load patient (${response.status})`);
      }

      const payload = (await response.json()) as PatientProfileData;
      setSelectedPatient(payload);
    } catch (err) {
      setPatientError(err instanceof Error ? err.message : "Failed to load patient");
    } finally {
      setPatientLoading(false);
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
          const scoreTier = getScoreTier(lead.lead_score);

          return (
            <article
              key={lead.id}
              className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isOverdue
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900" title={lead.title}>
                  {lead.title}
                </p>
                <div className="ml-auto flex shrink-0 items-center gap-0">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${
                      statusTone[lead.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {formatStatus(lead.status)}
                  </span>
                  <div className="relative" data-lead-actions-root="true">
                    <button
                      type="button"
                      aria-label="Lead actions"
                      aria-haspopup="menu"
                      aria-expanded={openMenuLeadId === lead.id}
                      onClick={() => setOpenMenuLeadId((current) => (current === lead.id ? null : lead.id))}
                      disabled={isBusy}
                      className="-ml-1 inline-flex h-7 w-7 items-center justify-center text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <circle cx="10" cy="4" r="1.5" />
                        <circle cx="10" cy="10" r="1.5" />
                        <circle cx="10" cy="16" r="1.5" />
                      </svg>
                    </button>
                    {openMenuLeadId === lead.id ? (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[8rem] rounded-xl border border-slate-200 bg-white p-1 shadow-md">
                        <button
                          type="button"
                          onClick={() => void setStatus(lead.id, "in_progress")}
                          disabled={isBusy}
                          className="block w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(lead.id, "contacted")}
                          disabled={isBusy}
                          className="block w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Contacted
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(lead.id, "qualified")}
                          disabled={isBusy}
                          className="block w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Qualified
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStatus(lead.id, "dismissed")}
                          disabled={isBusy}
                          className="block w-full rounded-lg px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-700">{lead.reason}</p>
              <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">Next action: {lead.next_action}</p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs text-slate-500">
                  {lead.due_at ? `Due ${new Date(lead.due_at).toLocaleDateString()}` : "No due date"}
                  {mode === "dashboard" ? (
                    <>
                      {" · "}
                      {transcriptMeta?.patient_id ? (
                        <button
                          type="button"
                          onClick={() => void openPatientModal(transcriptMeta.patient_id!)}
                          className="font-medium text-slate-700 underline"
                        >
                          {transcriptMeta?.patient_pseudonym ?? lead.transcript_id}
                        </button>
                      ) : (
                        <a
                          className="font-medium text-slate-700 underline"
                          href={`/transcripts/${lead.transcript_id}?from=dashboard`}
                        >
                          {transcriptMeta?.patient_pseudonym ?? lead.transcript_id}
                        </a>
                      )}
                    </>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {mode === "dashboard" ? (
                    <a
                      href={`/transcripts/${lead.transcript_id}?from=dashboard`}
                      aria-label="View transcript"
                      className="group relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14l3-2 3 2 3-2 3 2V8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h5M9 12h5" />
                      </svg>
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                        View transcript
                      </span>
                    </a>
                  ) : null}
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white/85 px-2 py-1 text-xs font-semibold text-teal-800"
                  >
                    <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${scoreTier.dotClass}`} aria-hidden="true" />
                    {Math.round(lead.lead_score * 100)}% {scoreTier.label}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {error ? <p className="text-sm font-medium text-slate-700">{error}</p> : null}
      </div>

      {isClient && selectedPatientId
        ? createPortal(
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-4"
          onClick={() => setSelectedPatientId(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Patient profile</h3>
              <button
                type="button"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
                onClick={() => setSelectedPatientId(null)}
              >
                Close
              </button>
            </div>
            {patientLoading ? <p className="mt-3 text-sm text-slate-600">Loading patient...</p> : null}
            {patientError ? <p className="mt-3 text-sm font-medium text-slate-700">{patientError}</p> : null}
            {selectedPatient && !patientLoading ? (
              <div className="mt-4">
                <div className="mb-3 flex justify-center">
                  {selectedPatient.patient.patient_profile_image_url ? (
                    <img
                      src={selectedPatient.patient.patient_profile_image_url}
                      alt={selectedPatient.patient.display_name}
                      className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                      {getInitials(selectedPatient.patient.display_name || selectedPatient.patient.pseudonym)}
                    </div>
                  )}
                </div>
                <p className="text-center text-sm font-semibold text-slate-900">
                  {selectedPatient.patient.display_name}
                </p>
                <p className="mt-1 text-center text-xs text-slate-600">
                  {selectedPatient.patient.pseudonym}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
                      <span>{selectedPatient.patient.email_masked ?? "-"}</span>
                      {selectedPatient.patient.email_verified ? (
                        <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" title="Verified">
                          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                            <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="sr-only">Verified</span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                            Verified
                          </span>
                        </span>
                      ) : (
                        <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-600" title="Unverified">
                          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <span className="sr-only">Unverified</span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                            Unverified
                          </span>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
                      <span>{selectedPatient.patient.phone_masked ?? "-"}</span>
                      {selectedPatient.patient.phone_verified ? (
                        <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" title="Verified">
                          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                            <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="sr-only">Verified</span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                            Verified
                          </span>
                        </span>
                      ) : (
                        <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-600" title="Unverified">
                          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <span className="sr-only">Unverified</span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                            Unverified
                          </span>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Consent</dt>
                    <dd className="mt-1 text-sm text-slate-900">{selectedPatient.patient.consent_status}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preferred</dt>
                    <dd className="mt-1 text-sm text-slate-900">{selectedPatient.patient.preferred_channel}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  {selectedPatient.recent.transcript_count} transcript(s) · {selectedPatient.recent.lead_count} lead(s)
                </p>
                {selectedPatient.latest_interaction ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-sm text-slate-700">
                      Latest transcript · {new Date(selectedPatient.latest_interaction.transcript_created_at).toLocaleString()}
                    </p>
                    <a
                      className="group relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      href={`/transcripts/${selectedPatient.latest_interaction.transcript_id}?from=dashboard`}
                      aria-label="View transcript"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14l3-2 3 2 3-2 3 2V8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h5M9 12h5" />
                      </svg>
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm group-hover:block">
                        View transcript
                      </span>
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
