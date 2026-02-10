"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("http://localhost:3001/health");

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as { ok?: boolean };
      setStatus(data.ok === true ? "Backend OK" : "Unexpected response");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <main className="w-full max-w-xl rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          ClinicOps PHI Transcript Ops
        </h1>
        <p className="mt-3 text-slate-600">
          Use the button below to confirm the backend health check.
        </p>
        <button
          type="button"
          onClick={checkHealth}
          disabled={loading}
          className="mt-6 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Checking..." : "Check Backend Health"}
        </button>
        {status ? (
          <p className="mt-4 text-sm text-slate-700">{status}</p>
        ) : null}
      </main>
    </div>
  );
}
