"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type TranscriptMeta = {
  id: string;
  created_at: string;
  patient_pseudonym: string;
  source: string;
  source_ref: string | null;
  status?: string | null;
};

type Artifact = {
  id: string;
  content: string;
  model: string;
  status: string;
};

type LeadItem = {
  id: string;
  title: string;
  reason: string;
  next_action: string;
  lead_score: number;
  status: string;
};

type Props = {
  transcript: TranscriptMeta;
  accessToken: string;
  backendBaseUrl: string;
};

type WarmupState = "idle" | "loading" | "ready" | "error";
type Step = 1 | 2 | 3;
type ModelOption = "" | "qwen2.5:1.5b" | "llama3.2:1b";

export default function ProcessTranscriptModal({ transcript, accessToken, backendBaseUrl }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [selectedModel, setSelectedModel] = useState<ModelOption>("");
  const [warmupState, setWarmupState] = useState<WarmupState>("idle");
  const [summaryArtifact, setSummaryArtifact] = useState<Artifact | null>(null);
  const [leadItems, setLeadItems] = useState<LeadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "loading">("idle");
  const [ellipsis, setEllipsis] = useState(".");

  const resetState = () => {
    setStep(1);
    setSelectedModel("");
    setWarmupState("idle");
    setSummaryArtifact(null);
    setLeadItems([]);
    setError(null);
    setSubmitState("idle");
  };

  const openModal = () => {
    resetState();
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const warmup = async () => {
      if (!selectedModel) {
        setWarmupState("idle");
        return;
      }

      setWarmupState("loading");
      setSummaryArtifact(null);
      setLeadItems([]);
      setError(null);

      try {
        const response = await fetch(`${backendBaseUrl}/v1/ai/models/warmup`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ model: selectedModel })
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Session expired. Please log in again.");
          }
          if (response.status === 502) {
            throw new Error("Ollama unavailable.");
          }
          throw new Error("Warmup failed");
        }

        setWarmupState("ready");
      } catch (err) {
        setWarmupState("error");
        const message = err instanceof Error ? err.message : "Warmup failed";
        setError(message);
      }
    };

    void warmup();
  }, [selectedModel, accessToken, backendBaseUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) {
      return;
    }

    const updateHeaderBottom = () => {
      const header = document.querySelector("header");
      setHeaderBottom(header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0);
    };

    updateHeaderBottom();
    window.addEventListener("resize", updateHeaderBottom);

    return () => {
      window.removeEventListener("resize", updateHeaderBottom);
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted || !isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (warmupState !== "loading" && submitState !== "loading") {
      setEllipsis(".");
      return;
    }

    let index = 0;
    const ticks = [".", "..", "..."];
    const interval = setInterval(() => {
      index = (index + 1) % ticks.length;
      setEllipsis(ticks[index]);
    }, 500);

    return () => clearInterval(interval);
  }, [warmupState, submitState]);

  const handleProcess = async () => {
    if (!selectedModel) {
      return;
    }

    setSubmitState("loading");
    setError(null);

    try {
      const response = await fetch(`${backendBaseUrl}/v1/transcripts/${transcript.id}/ai/summary`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ model: selectedModel })
      });

      if (!response.ok) {
        let message = `Summary failed (${response.status})`;
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) {
            message = body.error;
          }
        } catch {
          // ignore parsing errors
        }
        throw new Error(message);
      }

      const data = (await response.json()) as Artifact;
      setSummaryArtifact(data);

      const leadsResponse = await fetch(`${backendBaseUrl}/v1/transcripts/${transcript.id}/leads`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (leadsResponse.ok) {
        const leads = (await leadsResponse.json()) as LeadItem[];
        setLeadItems(leads);
      } else {
        setLeadItems([]);
      }

      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      setError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  const handleApprove = async () => {
    if (!summaryArtifact) {
      return;
    }

    setSubmitState("loading");
    setError(null);

    try {
      const response = await fetch(`${backendBaseUrl}/v1/transcripts/${transcript.id}/process`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ artifact_id: summaryArtifact.id })
      });

      if (!response.ok) {
        throw new Error("Approve failed");
      }

      closeModal();
      router.refresh();
    } catch {
      setError("Failed to approve summary.");
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <div>
      <button type="button" onClick={openModal} className="btn-primary">
        Process transcript
      </button>

      {isOpen && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[9999]">
          <div
            className="absolute inset-x-0 bottom-0 bg-slate-900/30"
            style={{ top: `${headerBottom}px` }}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center px-4 py-6"
            style={{ top: `${headerBottom}px` }}
          >
            <div className="w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Process transcript</h2>
                <p className="mt-1 text-sm text-slate-600">Step {step} of 3</p>
              </div>
              <button type="button" onClick={closeModal} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {step === 1 ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-4 text-sm text-slate-700">
                  <p><span className="font-semibold">Patient:</span> {transcript.patient_pseudonym}</p>
                  <p><span className="font-semibold">Source:</span> {transcript.source}</p>
                  <p><span className="font-semibold">Source Ref:</span> {transcript.source_ref ?? "-"}</p>
                  <p><span className="font-semibold">Created:</span> {new Date(transcript.created_at).toLocaleString()}</p>
                  <p><span className="font-semibold">Status:</span> {transcript.status ?? "pending"}</p>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <label className="flex flex-col gap-2">
                    Select model
                    <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value as ModelOption)} className="field !mt-0">
                      <option value="">Choose a model</option>
                      <option value="qwen2.5:1.5b">qwen2.5:1.5b</option>
                      <option value="llama3.2:1b">llama3.2:1b</option>
                    </select>
                  </label>
                  <p className="text-xs text-slate-500">
                    {warmupState === "loading" ? `Loading model${ellipsis}` : null}
                    {warmupState === "ready" ? "Model ready." : null}
                    {warmupState === "error" ? "Model warmup failed." : null}
                  </p>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3 text-sm text-slate-700">
                  {summaryArtifact ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generated Summary</p>
                      <p className="mt-2 whitespace-pre-wrap">{summaryArtifact.content}</p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead Opportunities</p>
                    {leadItems.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">No lead opportunities generated.</p>
                    ) : (
                      <div className="mt-2 space-y-3">
                        {leadItems.map((lead) => (
                          <div key={lead.id} className="rounded-md border border-slate-200 bg-white p-3">
                            <p className="font-medium text-slate-900">{lead.title} ({Math.round(lead.lead_score * 100)}%)</p>
                            <p className="mt-1 text-slate-700">{lead.reason}</p>
                            <p className="mt-1 text-xs text-slate-600">Next action: {lead.next_action}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as Step)}
                disabled={step === 1}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {step === 1 ? (
                  <button type="button" onClick={() => setStep((prev) => Math.min(3, prev + 1) as Step)} className="btn-primary">
                    Next
                  </button>
                ) : step === 2 ? (
                  <button type="button" onClick={handleProcess} disabled={warmupState !== "ready" || submitState === "loading"} className="btn-primary">
                    {submitState === "loading" ? `Processing${ellipsis}` : "Process"}
                  </button>
                ) : (
                  <button type="button" onClick={handleApprove} disabled={!summaryArtifact || submitState === "loading"} className="btn-primary !bg-emerald-600 hover:!bg-emerald-500">
                    Approve and mark processed
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
