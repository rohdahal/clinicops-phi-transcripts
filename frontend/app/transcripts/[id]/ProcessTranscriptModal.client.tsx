"use client";

import { useRouter } from "next/navigation";
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

type Props = {
  transcript: TranscriptMeta;
  accessToken: string;
  backendBaseUrl: string;
};

type WarmupState = "idle" | "loading" | "ready" | "error";
type Step = 1 | 2 | 3;
type ModelOption = "" | "qwen2.5:1.5b" | "llama3.2:1b";

export default function ProcessTranscriptModal({
  transcript,
  accessToken,
  backendBaseUrl
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [selectedModel, setSelectedModel] = useState<ModelOption>("");
  const [warmupState, setWarmupState] = useState<WarmupState>("idle");
  const [summaryArtifact, setSummaryArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "loading">("idle");
  const [ellipsis, setEllipsis] = useState(".");

  const resetState = () => {
    setStep(1);
    setSelectedModel("");
    setWarmupState("idle");
    setSummaryArtifact(null);
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

  const handleGenerate = async () => {
    if (!selectedModel) {
      return;
    }

    setSubmitState("loading");
    setError(null);

    try {
      const response = await fetch(
        `${backendBaseUrl}/v1/transcripts/${transcript.id}/ai/summary`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ model: selectedModel })
        }
      );

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Summary failed";
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
      const response = await fetch(
        `${backendBaseUrl}/v1/transcripts/${transcript.id}/process`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ artifact_id: summaryArtifact.id })
        }
      );

      if (!response.ok) {
        throw new Error("Approve failed");
      }

      closeModal();
      router.refresh();
    } catch (err) {
      setError("Failed to approve summary.");
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Process transcript
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Process transcript
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Step {step} of 3
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {step === 1 ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Patient:</span>{" "}
                    {transcript.patient_pseudonym}
                  </p>
                  <p>
                    <span className="font-semibold">Source:</span> {transcript.source}
                  </p>
                  <p>
                    <span className="font-semibold">Source Ref:</span>{" "}
                    {transcript.source_ref ?? "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Created:</span>{" "}
                    {new Date(transcript.created_at).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-semibold">Status:</span>{" "}
                    {transcript.status ?? "pending"}
                  </p>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <label className="flex flex-col gap-2">
                    Select model
                    <select
                      value={selectedModel}
                      onChange={(event) =>
                        setSelectedModel(event.target.value as ModelOption)
                      }
                      className="rounded-md border border-slate-200 px-3 py-2"
                    >
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
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={submitState === "loading" || !selectedModel}
                    className="rounded-md border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitState === "loading"
                      ? `Generating${ellipsis}`
                      : "Generate summary"}
                  </button>
                  {summaryArtifact ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Generated Summary
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">
                        {summaryArtifact.content}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 text-sm text-rose-600">{error}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as Step)}
                disabled={step === 1}
                className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => Math.min(3, prev + 1) as Step)}
                    disabled={step === 2 && warmupState !== "ready"}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!summaryArtifact || submitState === "loading"}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve and mark processed
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
