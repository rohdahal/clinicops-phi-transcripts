"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeadsQueue from "@/app/dashboard/LeadsQueue.client";

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
};

type Props = {
  transcriptId: string;
  leads: LeadRow[];
  accessToken: string;
  backendBaseUrl: string;
  initialModel?: ModelOption | null;
};

type ModelOption = "qwen2.5:1.5b" | "llama3.2:1b";

export default function TranscriptLeadsPanel({
  transcriptId,
  leads,
  accessToken,
  backendBaseUrl,
  initialModel
}: Props) {
  const router = useRouter();
  const [model, setModel] = useState<ModelOption>(
    initialModel ?? "qwen2.5:1.5b"
  );
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const generateLeads = async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch(
        `${backendBaseUrl}/v1/transcripts/${transcriptId}/ai/leads`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ model })
        }
      );

      if (!response.ok) {
        throw new Error(`Lead generation failed (${response.status})`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lead generation failed");
    } finally {
      setState("idle");
    }
  };

  return (
    <section className="panel reveal">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Lead Opportunities</h2>
          <p className="mt-1 text-sm text-slate-600">Prioritize follow-up actions directly from this transcript.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={model} onChange={(event) => setModel(event.target.value as ModelOption)} className="field !mt-0 !w-auto !py-1.5 !text-xs">
            <option value="qwen2.5:1.5b">qwen2.5:1.5b</option>
            <option value="llama3.2:1b">llama3.2:1b</option>
          </select>
          <button type="button" onClick={() => void generateLeads()} disabled={state === "loading"} className="btn-primary !px-3 !py-2 !text-xs">
            {state === "loading" ? "Generating..." : "Generate leads"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}

      <div className="mt-4 max-h-[32rem] overflow-y-auto pr-1">
        <LeadsQueue
          leads={leads}
          accessToken={accessToken}
          backendBaseUrl={backendBaseUrl}
          mode="transcript"
        />
      </div>
    </section>
  );
}
