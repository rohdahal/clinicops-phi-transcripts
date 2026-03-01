import { redirect } from "next/navigation";
import AppHeader from "@/src/components/AppHeader";
import { getBackendBaseUrl } from "@/src/lib/backend";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import LeadsQueue from "@/src/components/leads/LeadsQueue.client";
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
    meta: Record<string, unknown> | null;
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
  const cardSurface = "bg-[linear-gradient(140deg,#ffffff_0%,#f8fafc_100%)]";
  const cardInnerSurface = "bg-[linear-gradient(150deg,#ffffff_0%,#f8fafc_100%)]";
  const scoreboard = [
    {
      label: "Open",
      value: metrics.leads_followup_open,
      tone: "from-[#e8f0ff] via-[#f7fbff] to-[#f0f6ff]",
      border: "border-blue-300/70",
      text: "text-blue-700"
    },
    {
      label: "Overdue",
      value: metrics.leads_followup_overdue,
      tone: "from-[#e8fbff] via-[#f5feff] to-[#ebf8ff]",
      border: "border-cyan-300/70",
      text: "text-cyan-700"
    },
    {
      label: "Top score",
      value: `${topLeadScore}%`,
      tone: "from-[#ecebff] via-[#f9f8ff] to-[#f1edff]",
      border: "border-indigo-300/70",
      text: "text-indigo-700"
    },
    {
      label: "Approval",
      value: `${conversionRate}%`,
      tone: "from-[#e9f6ff] via-[#f7fcff] to-[#edf7ff]",
      border: "border-sky-300/70",
      text: "text-sky-700"
    },
    {
      label: "New transcripts",
      value: metrics.inbox_new,
      tone: "from-[#eaf1ff] via-[#f8fbff] to-[#eef5ff]",
      border: "border-blue-300/70",
      text: "text-blue-700"
    }
  ];

  return (
    <div className="app-shell">
      <AppHeader
        tabs={[
          { href: "/dashboard", label: "Dashboard", active: true },
          { href: "/transcripts", label: "Transcript Inbox" }
        ]}
      />
      <main className="shell-container">
        <section className="reveal relative overflow-hidden rounded-3xl border border-blue-200/55 bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 p-6 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.85)]">
          <div className="pointer-events-none absolute -left-20 -top-16 h-60 w-60 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-16 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-100/90">Operations cockpit</p>
              <p className="mt-3 text-sm text-blue-100/90 sm:text-base">
                Prioritize outreach, monitor queue pressure, and move clinical follow-up forward with one focused view.
              </p>
            </div>
            <a
              className="inline-flex items-center rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
              href="/transcripts"
            >
              Open inbox
            </a>
          </div>
          <div className="relative mt-6 overflow-x-auto pb-1">
            <div className="grid w-full min-w-[56rem] grid-cols-5 gap-3 lg:min-w-0">
              {scoreboard.map((item) => (
                <article
                  key={item.label}
                  className={`rounded-2xl border ${item.border} bg-gradient-to-br ${item.tone} p-4 shadow-[0_20px_36px_-24px_rgba(37,99,235,0.45)]`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${item.text}`}>{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--legion-ink)]">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-12">
          <div className={`order-2 reveal relative overflow-hidden rounded-3xl border border-slate-200 ${cardSurface} p-5 shadow-[0_26px_52px_-38px_rgba(15,23,42,0.28)] lg:order-1 lg:col-span-8 lg:h-[calc(100vh-0.5rem)]`}>
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.13em] text-slate-800">Lead Queue</h3>
                <p className="mt-1 text-sm text-slate-600">Prioritize follow-ups and close actions directly from the queue.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {metrics.leads_followup_open} active
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {metrics.leads_followup_overdue} overdue
                </span>
              </div>
            </div>
            <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
              <LeadsQueue
                leads={metrics.leads_queue}
                accessToken={session.access_token}
                backendBaseUrl={getBackendBaseUrl()}
              />
            </div>
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:col-span-4 lg:flex lg:h-[calc(100vh-0.5rem)] lg:flex-col">
            <div className={`reveal relative overflow-hidden rounded-3xl border border-slate-200 ${cardSurface} p-5 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.24)]`}>
              <h3 className="relative text-sm font-semibold uppercase tracking-[0.13em] text-slate-800">Throughput Snapshot</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border border-slate-200 ${cardInnerSurface} p-3 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.22)]`}>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Processed</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--legion-ink)]">{metrics.processed}</p>
                </div>
                <div className={`rounded-2xl border border-slate-200 ${cardInnerSurface} p-3 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.22)]`}>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Approved</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--legion-ink)]">{metrics.approved_summaries}</p>
                </div>
              </div>
              <div className={`mt-4 rounded-2xl border border-slate-200 ${cardInnerSurface} p-3`}>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Approval ratio</span>
                  <span className="font-semibold text-slate-800">{conversionRate}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-slate-700" style={{ width: `${conversionRate}%` }} />
                </div>
              </div>
            </div>

            <div className={`reveal relative overflow-hidden rounded-3xl border border-slate-200 ${cardSurface} p-5 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.24)]`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="relative text-sm font-semibold uppercase tracking-[0.13em] text-slate-800">Last 7 Days</h3>
                <span className="text-xs text-slate-500">Viewed vs Processed</span>
              </div>
              <div className="mt-3">
                <Last7DaysChart viewed={metrics.viewed_last_7d} processed={metrics.processed_last_7d} />
              </div>
            </div>

            <div className={`reveal relative overflow-hidden rounded-3xl border border-slate-200 ${cardSurface} p-5 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.24)] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}>
              <h3 className="relative text-sm font-semibold uppercase tracking-[0.13em] text-slate-800">Recent Activity</h3>
              <div className="mt-4 max-h-[19.5rem] space-y-2 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
                {metrics.recent_activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity.</p>
                ) : (
                  metrics.recent_activity.map((event) => (
                    <div
                      key={`${event.created_at}-${event.action}`}
                      className={`rounded-xl border border-slate-200 ${cardInnerSurface} p-3 text-sm text-slate-700 shadow-[0_14px_22px_-18px_rgba(15,23,42,0.26)]`}
                    >
                      <p className="font-medium text-[var(--legion-ink)]">{event.action}</p>
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
