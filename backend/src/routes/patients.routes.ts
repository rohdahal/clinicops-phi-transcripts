import type { FastifyInstance } from "fastify";
import { logAuditEvent } from "../lib/audit";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { authUser } from "../plugins/authUser";

export async function patientsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/patients/:id",
    { preHandler: authUser },
    async (request, reply) => {
      const { data: patient, error: patientError } = await supabaseAdmin
        .from("patients")
        .select(
          "id,pseudonym,masked_name,patient_profile_image_url,email_masked,email_verified,phone_masked,phone_verified,preferred_channel,consent_status"
        )
        .eq("id", request.params.id)
        .maybeSingle();

      if (patientError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!patient) {
        reply.code(404);
        return { error: "not_found" };
      }

      const { data: transcripts, error: transcriptsError } = await supabaseAdmin
        .from("transcripts")
        .select("id,created_at,patient_pseudonym,source,source_ref,status")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (transcriptsError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const transcriptIds = (transcripts ?? []).map((row) => row.id);
      let leads: Array<{
        id: string;
        created_at: string;
        transcript_id: string;
        lead_score: number;
        status: string;
        due_at: string | null;
      }> = [];

      if (transcriptIds.length > 0) {
        const { data: leadRows, error: leadsError } = await supabaseAdmin
          .from("lead_opportunities")
          .select("id,created_at,transcript_id,lead_score,status,due_at")
          .in("transcript_id", transcriptIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (leadsError) {
          reply.code(500);
          return { error: "supabase_error" };
        }

        leads = leadRows ?? [];
      }

      const latestTranscript = transcripts?.[0] ?? null;
      const latestLead = latestTranscript
        ? leads.find((lead) => lead.transcript_id === latestTranscript.id) ?? null
        : null;

      await logAuditEvent({
        entity_type: "patient",
        entity_id: patient.id,
        actor_type: "user",
        actor_display: request.user!.email,
        actor_id: request.user!.id,
        action: "patient.viewed",
        details: {
          ui: "profile",
          transcript_count: transcripts?.length ?? 0,
          lead_count: leads.length
        }
      });

      return {
        patient: {
          id: patient.id,
          pseudonym: patient.pseudonym,
          display_name: patient.masked_name ?? patient.pseudonym,
          patient_profile_image_url: patient.patient_profile_image_url,
          email_masked: patient.email_masked,
          email_verified: patient.email_verified,
          phone_masked: patient.phone_masked,
          phone_verified: patient.phone_verified,
          preferred_channel: patient.preferred_channel,
          consent_status: patient.consent_status
        },
        latest_interaction: latestTranscript
          ? {
              transcript_id: latestTranscript.id,
              transcript_created_at: latestTranscript.created_at,
              lead_id: latestLead?.id ?? null,
              lead_status: latestLead?.status ?? null
            }
          : null,
        recent: {
          transcript_count: transcripts?.length ?? 0,
          lead_count: leads.length
        }
      };
    }
  );
}
