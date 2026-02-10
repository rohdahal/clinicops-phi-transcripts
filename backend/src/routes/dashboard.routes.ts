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

    const [
      inboxRes,
      processedRes,
      approvedRes,
      activityRes,
      recentActivityRes
    ] = await Promise.all([
      inboxPromise,
      processedPromise,
      approvedPromise,
      activityPromise,
      recentActivityPromise
    ]);

    if (
      inboxRes.error ||
      processedRes.error ||
      approvedRes.error ||
      activityRes.error ||
      recentActivityRes.error
    ) {
      reply.code(500);
      return { error: "supabase_error" };
    }

    const days = buildLast7Days();
    const viewedCounts = new Map(days.map((day) => [day, 0]));
    const processedCounts = new Map(days.map((day) => [day, 0]));

    for (const event of activityRes.data ?? []) {
      const day = formatDay(new Date(event.created_at));
      if (event.action === "transcript.viewed") {
        viewedCounts.set(day, (viewedCounts.get(day) ?? 0) + 1);
      }
      if (event.action === "transcript.processed") {
        processedCounts.set(day, (processedCounts.get(day) ?? 0) + 1);
      }
    }

    return {
      inbox_new: inboxRes.count ?? 0,
      processed: processedRes.count ?? 0,
      approved_summaries: approvedRes.count ?? 0,
      viewed_last_7d: days.map((day) => ({ day, count: viewedCounts.get(day) ?? 0 })),
      processed_last_7d: days.map((day) => ({ day, count: processedCounts.get(day) ?? 0 })),
      recent_activity: recentActivityRes.data ?? []
    };
  });
}
