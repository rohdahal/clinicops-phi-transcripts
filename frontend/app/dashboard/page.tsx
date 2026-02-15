import { redirect } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getBackendBaseUrl } from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import LeadsQueue from "./LeadsQueue.client";
import Last7DaysChart from "./Last7DaysChart.client";

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
      | { patient_id?: string | null; patient_pseudonym?: string | null; source?: string | null }
      | Array<{ patient_id?: string | null; patient_pseudonym?: string | null; source?: string | null }>
      | null;
  }>;
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
  const topLeadScore = metrics.leads_queue[0]
    ? Math.round(metrics.leads_queue[0].lead_score * 100)
    : 0;
  const conversionRate =
    metrics.processed > 0
      ? Math.round((metrics.approved_summaries / metrics.processed) * 100)
      : 0;

  return (
    <div className="app-shell">
      <AppHeader
        tabs={[
          { href: "/dashboard", label: "Dashboard", active: true },
          { href: "/transcripts", label: "Transcript Inbox" }
        ]}
      />
      <main className="shell-container">
        <section className="panel reveal">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Lead command center</h2>
            <a className="text-xs font-medium text-teal-700 underline" href="/transcripts">
              Open inbox
            </a>
          </div>
          <div className="mt-3 overflow-x-auto pb-1">
            <div className="grid w-full min-w-[56rem] grid-cols-5 gap-2 lg:min-w-0">
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Open</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{metrics.leads_followup_open}</p>
            </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Overdue</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{metrics.leads_followup_overdue}</p>
            </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Top score</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{topLeadScore}%</p>
            </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Approval rate</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{conversionRate}%</p>
            </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">New transcripts</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{metrics.inbox_new}</p>
            </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="order-2 panel-soft reveal flex min-h-0 flex-col overflow-hidden lg:order-1 lg:h-[calc(100vh-0.5rem)]">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead Queue</h3>
            <p className="mt-1 text-sm text-slate-600">Prioritize follow-ups and close actions directly from the queue.</p>
            <div className="mt-4 min-h-0 flex-1 overflow-hidden">
              <LeadsQueue
                leads={metrics.leads_queue}
                accessToken={session.access_token}
                backendBaseUrl={getBackendBaseUrl()}
              />
            </div>
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:flex lg:h-[calc(100vh-0.5rem)] lg:flex-col">
            <div className="panel-soft reveal">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Throughput</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-3">
                  <p className="text-xs text-slate-500">Processed</p>
                  <p className="text-2xl font-semibold text-slate-900">{metrics.processed}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-3">
                  <p className="text-xs text-slate-500">Approved summaries</p>
                  <p className="text-2xl font-semibold text-slate-900">{metrics.approved_summaries}</p>
                </div>
              </div>
            </div>

            <div className="panel-soft reveal">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Last 7 Days</h3>
              <div className="mt-3">
                <Last7DaysChart viewed={metrics.viewed_last_7d} processed={metrics.processed_last_7d} />
              </div>
            </div>

            <div className="panel-soft reveal lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Activity</h3>
              <div className="mt-4 max-h-[19.5rem] space-y-2 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
                {metrics.recent_activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity.</p>
                ) : (
                  metrics.recent_activity.map((event) => (
                    <div
                      key={`${event.created_at}-${event.action}`}
                      className="rounded-xl border border-slate-100 bg-white/90 p-3 text-sm text-slate-700"
                    >
                      <p className="font-medium text-slate-900">{event.action}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.created_at).toLocaleString()} · {event.actor_display ?? "unknown"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
