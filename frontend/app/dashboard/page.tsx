import { redirect } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getBackendBaseUrl } from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import LeadsQueue from "./LeadsQueue.client";

type MetricsResponse = {
  inbox_new: number;
  processed: number;
  approved_summaries: number;
  leads_followup_open: number;
  leads_followup_overdue: number;
  viewed_last_7d: Array<{ day: string; count: number }>;
  processed_last_7d: Array<{ day: string; count: number }>;
  recent_activity: Array<{
    created_at: string;
    action: string;
    actor_display: string | null;
    entity_type: string;
  }>;
  leads_queue: Array<{
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
  }>;
};

const buildBars = (counts: Array<{ day: string; count: number }>) => {
  const max = Math.max(1, ...counts.map((entry) => entry.count));
  return counts.map((entry) => ({
    ...entry,
    width: `${Math.round((entry.count / max) * 100)}%`
  }));
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const response = await fetch(`${getBackendBaseUrl()}/v1/dashboard/metrics`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load metrics (${response.status})`);
  }

  const metrics = (await response.json()) as MetricsResponse;
  const viewedBars = buildBars(metrics.viewed_last_7d);
  const processedBars = buildBars(metrics.processed_last_7d);
  const topLeadScore = metrics.leads_queue[0]
    ? Math.round(metrics.leads_queue[0].lead_score * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f1f5f9,_#ffffff_35%,_#f8fafc_100%)]">
      <AppHeader
        tabs={[
          { href: "/dashboard", label: "Dashboard", active: true },
          { href: "/transcripts", label: "Transcript Inbox" }
        ]}
      />
      <main className="mx-auto w-full max-w-5xl px-6 py-6">
        <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-6 shadow-md shadow-slate-200/40">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Lead Command Center
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Follow-up opportunities from transcript summaries
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
              <p className="text-xs uppercase text-amber-700">Open follow-up</p>
              <p className="mt-1 text-3xl font-semibold text-amber-900">
                {metrics.leads_followup_open}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
              <p className="text-xs uppercase text-rose-700">Overdue</p>
              <p className="mt-1 text-3xl font-semibold text-rose-900">
                {metrics.leads_followup_overdue}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
              <p className="text-xs uppercase text-slate-600">Top lead score</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {topLeadScore}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
              <p className="text-xs uppercase text-slate-600">New transcripts</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {metrics.inbox_new}
              </p>
              <a className="text-xs text-slate-600 underline" href="/transcripts">
                Open inbox
              </a>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-md shadow-slate-200/30 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Lead Queue
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Sort by urgency and close follow-ups directly from the queue.
            </p>
            <div className="mt-4 max-h-[34rem] overflow-y-auto pr-1">
              <LeadsQueue
                leads={metrics.leads_queue}
                accessToken={session.access_token}
                backendBaseUrl={getBackendBaseUrl()}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/30">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Throughput
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Processed</p>
                  <p className="text-2xl font-semibold text-slate-900">{metrics.processed}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Approved summaries</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {metrics.approved_summaries}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/30">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Last 7 Days
              </h3>
              <div className="mt-4 max-h-60 space-y-3 overflow-y-auto">
                {viewedBars.map((entry, index) => (
                  <div key={`viewed-${entry.day}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{entry.day}</span>
                      <span>Viewed: {entry.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-700"
                        style={{ width: entry.width }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="sr-only">Processed</span>
                      <span>Processed: {processedBars[index]?.count ?? 0}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: processedBars[index]?.width ?? "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-200/30">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent Activity
              </h3>
              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                {metrics.recent_activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity.</p>
                ) : (
                  metrics.recent_activity.map((event) => (
                    <div
                      key={`${event.created_at}-${event.action}`}
                      className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700"
                    >
                      <p className="font-medium text-slate-900">{event.action}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.created_at).toLocaleString()} ·{" "}
                        {event.actor_display ?? "unknown"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
