"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type PatientProfileData = {
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

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  data: PatientProfileData | null;
  onClose: () => void;
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

export default function PatientProfileDialog({ open, loading, error, data, onClose }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-4"
      onClick={onClose}
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
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {loading ? <p className="mt-3 text-sm text-slate-600">Loading patient...</p> : null}
        {error ? <p className="mt-3 text-sm font-medium text-slate-700">{error}</p> : null}
        {data && !loading ? (
          <div className="mt-4">
            <div className="mb-3 flex justify-center">
              {data.patient.patient_profile_image_url ? (
                <img
                  src={data.patient.patient_profile_image_url}
                  alt={data.patient.display_name}
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                  {getInitials(data.patient.display_name || data.patient.pseudonym)}
                </div>
              )}
            </div>
            <p className="text-center text-sm font-semibold text-slate-900">
              {data.patient.display_name}
            </p>
            <p className="mt-1 text-center text-xs text-slate-600">
              {data.patient.pseudonym}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
                  <span>{data.patient.email_masked ?? "-"}</span>
                  {data.patient.email_verified ? (
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
                  <span>{data.patient.phone_masked ?? "-"}</span>
                  {data.patient.phone_verified ? (
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
                <dd className="mt-1 text-sm text-slate-900">{data.patient.consent_status}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preferred</dt>
                <dd className="mt-1 text-sm text-slate-900">{data.patient.preferred_channel}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              {data.recent.transcript_count} transcript(s) · {data.recent.lead_count} lead(s)
            </p>
            {data.latest_interaction ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                <p className="text-sm text-slate-700">
                  Latest transcript · {new Date(data.latest_interaction.transcript_created_at).toLocaleString()}
                </p>
                <a
                  className="group relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  href={`/transcripts/${data.latest_interaction.transcript_id}?from=dashboard`}
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
  );
}
