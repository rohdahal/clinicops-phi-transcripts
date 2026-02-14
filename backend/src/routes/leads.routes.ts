import type { FastifyInstance } from "fastify";
import { logAuditEvent } from "../lib/audit";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { authUser } from "../plugins/authUser";

type LeadStatus =
  | "open"
  | "in_progress"
  | "contacted"
  | "qualified"
  | "closed_won"
  | "closed_lost"
  | "dismissed"
  | "superseded";

type LeadStatusBody = {
  status?: LeadStatus;
  notes?: string | null;
  due_at?: string | null;
};

const ALLOWED_STATUS: LeadStatus[] = [
  "open",
  "in_progress",
  "contacted",
  "qualified",
  "closed_won",
  "closed_lost",
  "dismissed",
  "superseded"
];

export async function leadsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: LeadStatusBody }>(
    "/leads/:id/status",
    { preHandler: authUser },
    async (request, reply) => {
      const nextStatus = request.body?.status;
      const notes = request.body?.notes ?? null;
      const dueAt = request.body?.due_at ?? null;

      if (!nextStatus || !ALLOWED_STATUS.includes(nextStatus)) {
        reply.code(400);
        return { error: "invalid_status" };
      }

      const { data: lead, error: leadError } = await supabaseAdmin
        .from("lead_opportunities")
        .select("id,transcript_id,status")
        .eq("id", request.params.id)
        .maybeSingle();

      if (leadError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!lead) {
        reply.code(404);
        return { error: "not_found" };
      }

      const patch: Record<string, unknown> = {
        status: nextStatus,
        notes
      };

      if (dueAt !== null) {
        patch.due_at = dueAt;
      }

      if (nextStatus === "contacted") {
        patch.last_contacted_at = new Date().toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from("lead_opportunities")
        .update(patch)
        .eq("id", request.params.id);

      if (updateError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      await logAuditEvent({
        entity_type: "lead",
        entity_id: lead.id,
        actor_type: "user",
        actor_display: request.user!.email,
        actor_id: request.user!.id,
        action: "lead.status_updated",
        details: {
          previous_status: lead.status,
          next_status: nextStatus,
          notes: notes ?? null
        }
      });

      return { ok: true };
    }
  );
}
