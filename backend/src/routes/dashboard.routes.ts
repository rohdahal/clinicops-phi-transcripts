import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { authUser } from "../plugins/authUser";

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

const buildLast7Days = () => {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i <= 6; i += 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    days.push(formatDay(day));
  }
  return days;
};

export async function dashboardRoutes(app: FastifyInstance) {
  const followupStatuses = ["open", "in_progress", "contacted", "qualified"];

  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/dashboard/leads",
    { preHandler: authUser },
    async (request, reply) => {
      const limit = Math.min(Number(request.query.limit ?? 15), 50) || 15;
      const offset = Math.max(Number(request.query.offset ?? 0), 0) || 0;
      const rangeEnd = offset + limit;

      const { data, error } = await supabaseAdmin
        .from("lead_opportunities")
        .select(
          "id,created_at,transcript_id,title,reason,next_action,lead_score,status,due_at,meta,transcripts(patient_id,patient_pseudonym,source)"
        )
        .in("status", followupStatuses)
        .order("lead_score", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, rangeEnd);

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const items = data ?? [];
      const hasMore = items.length > limit;
      const slicedItems = hasMore ? items.slice(0, limit) : items;

      return {
        items: slicedItems,
        limit,
        offset,
        next_offset: hasMore ? offset + limit : null,
        has_more: hasMore
      };
    }
  );

  app.get("/dashboard/metrics", { preHandler: authUser }, async (request, reply) => {
    const inboxPromise = supabaseAdmin
      .from("transcripts")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    const processedPromise = supabaseAdmin
      .from("transcripts")
      .select("id", { count: "exact", head: true })
      .eq("status", "processed");
    const approvedPromise = supabaseAdmin
      .from("transcript_artifacts")
      .select("id", { count: "exact", head: true })
      .eq("artifact_type", "summary")
      .eq("status", "approved");

    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);

    const activityPromise = supabaseAdmin
      .from("audit_events")
      .select("created_at,action")
      .gte("created_at", start.toISOString())
      .in("action", ["transcript.viewed", "transcript.processed"]);

    const recentActivityPromise = supabaseAdmin
      .from("audit_events")
      .select("created_at,action,actor_display,entity_type")
      .order("created_at", { ascending: false })
      .limit(10);

    const leadsOpenPromise = supabaseAdmin
      .from("lead_opportunities")
      .select("id", { count: "exact", head: true })
      .in("status", followupStatuses);

    const leadsOverduePromise = supabaseAdmin
      .from("lead_opportunities")
      .select("id", { count: "exact", head: true })
      .in("status", followupStatuses)
      .not("due_at", "is", null)
      .lt("due_at", new Date().toISOString());

    const leadsQueuePromise = supabaseAdmin
      .from("lead_opportunities")
      .select(
        "id,created_at,transcript_id,title,reason,next_action,lead_score,status,due_at,meta,transcripts(patient_id,patient_pseudonym,source)"
      )
      .in("status", followupStatuses)
      .order("lead_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15);

    const [
      inboxRes,
      processedRes,
      approvedRes,
      activityRes,
      recentActivityRes,
      leadsOpenRes,
      leadsOverdueRes,
      leadsQueueRes
    ] = await Promise.all([
      inboxPromise,
      processedPromise,
      approvedPromise,
      activityPromise,
      recentActivityPromise,
      leadsOpenPromise,
      leadsOverduePromise,
      leadsQueuePromise
    ]);
    const queryErrors = [
      inboxRes.error,
      processedRes.error,
      approvedRes.error,
      activityRes.error,
      recentActivityRes.error,
      leadsOpenRes.error,
      leadsOverdueRes.error,
      leadsQueueRes.error
    ].filter(Boolean);
    if (queryErrors.length > 0) {
      request.log.warn(
        { queryErrors },
        "dashboard metrics degraded to empty state due to supabase query errors"
      );
    }

    const days = buildLast7Days();
    const viewedCounts = new Map(days.map((day) => [day, 0]));
    const processedCounts = new Map(days.map((day) => [day, 0]));

    for (const event of activityRes.error ? [] : (activityRes.data ?? [])) {
      const day = formatDay(new Date(event.created_at));
      if (event.action === "transcript.viewed") {
        viewedCounts.set(day, (viewedCounts.get(day) ?? 0) + 1);
      }
      if (event.action === "transcript.processed") {
        processedCounts.set(day, (processedCounts.get(day) ?? 0) + 1);
      }
    }

    return {
      inbox_new: inboxRes.error ? 0 : (inboxRes.count ?? 0),
      processed: processedRes.error ? 0 : (processedRes.count ?? 0),
      approved_summaries: approvedRes.error ? 0 : (approvedRes.count ?? 0),
      leads_followup_open: leadsOpenRes.error ? 0 : (leadsOpenRes.count ?? 0),
      leads_followup_overdue: leadsOverdueRes.error ? 0 : (leadsOverdueRes.count ?? 0),
      viewed_last_7d: days.map((day) => ({ day, count: viewedCounts.get(day) ?? 0 })),
      processed_last_7d: days.map((day) => ({ day, count: processedCounts.get(day) ?? 0 })),
      recent_activity: recentActivityRes.error ? [] : (recentActivityRes.data ?? []),
      leads_queue: leadsQueueRes.error ? [] : (leadsQueueRes.data ?? [])
    };
  });
}
