"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type OutreachChannel = "call" | "text" | "email";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  patientPseudonym?: string | null;
  emailMasked?: string | null;
  phoneMasked?: string | null;
  outreachChannel: OutreachChannel;
  isSubmitting: boolean;
  onChannelChange: (channel: OutreachChannel) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function StartOutreachDialog({
  open,
  loading,
  error,
  patientPseudonym,
  emailMasked,
  phoneMasked,
  outreachChannel,
  isSubmitting,
  onChannelChange,
  onClose,
  onConfirm
}: Props) {
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Start outreach</h3>
            <p className="mt-1 text-xs text-slate-600">Choose how AI should initiate this follow-up.</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-600">Loading patient details...</p> : null}
        {error ? <p className="mt-4 text-sm font-medium text-slate-700">{error}</p> : null}

        {!loading ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Patient</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{patientPseudonym ?? "Unknown patient"}</p>
              <p className="mt-2 text-xs text-slate-600">Email: {emailMasked ?? "Unavailable"}</p>
              <p className="mt-1 text-xs text-slate-600">Phone: {phoneMasked ?? "Unavailable"}</p>
            </div>

            <fieldset>
              <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Outreach channel
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["call", "text", "email"] as OutreachChannel[]).map((channel) => {
                  const checked = outreachChannel === channel;
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => onChannelChange(channel)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
                        checked
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {channel}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Starting..." : `Start with AI (${outreachChannel})`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
