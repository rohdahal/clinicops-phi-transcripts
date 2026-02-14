import type { FastifyInstance } from "fastify";
import { logAuditEvent } from "../lib/audit";
import {
  type AllowedModel,
  assertAllowedModel,
  ollamaGenerateLeadOpportunities,
  ollamaGenerateSummary,
  ollamaWarmup
} from "../lib/ollama";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { authUser } from "../plugins/authUser";

type TranscriptInput = {
  patient_pseudonym?: string;
  source?: string;
  source_ref?: string | null;
  text?: string;
  idempotency_key?: string;
  meta?: Record<string, unknown> | null;
};

type TranscriptQuery = {
  limit?: string;
  offset?: string;
  source?: string;
  patient_pseudonym?: string;
};

type TranscriptDetailQuery = {
  from?: string;
};

type ModelBody = {
  model?: string;
};

type ProcessBody = {
  artifact_id?: string;
};

type LeadStatus =
  | "open"
  | "in_progress"
  | "contacted"
  | "qualified"
  | "closed_won"
  | "closed_lost"
  | "dismissed"
  | "superseded";

const leadStatusRank: Record<LeadStatus, number> = {
  open: 0,
  in_progress: 1,
  contacted: 2,
  qualified: 3,
  closed_won: 4,
  closed_lost: 5,
  dismissed: 6,
  superseded: 7
};

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

async function createLeadsFromAi(params: {
  transcriptId: string;
  sourceArtifactId: string | null;
  model: AllowedModel;
  redactedText: string;
}) {
  const leadResult = await ollamaGenerateLeadOpportunities(params.model, params.redactedText);

  if (leadResult.items.length === 0) {
    return { count: 0, latency_ms: leadResult.latency_ms };
  }

  const item = leadResult.items[0];
  const row = {
    transcript_id: params.transcriptId,
    source_artifact_id: params.sourceArtifactId,
    model: params.model,
    title: item.title,
    reason: item.reason,
    next_action: item.next_action,
    lead_score: item.lead_score,
    status: "open",
    due_at: addDaysIso(item.due_in_days),
    meta: {
      origin: "ai",
      model: params.model,
      latency_ms: leadResult.latency_ms
    }
  };

  const { error } = await supabaseAdmin
    .from("lead_opportunities")
    .upsert(row, { onConflict: "transcript_id" });
  if (error) {
    throw new Error("supabase_error");
  }

  return { count: 1, latency_ms: leadResult.latency_ms };
}

export async function transcriptsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: TranscriptQuery }>(
    "/transcripts",
    { preHandler: authUser },
    async (request, reply) => {
      const limit = Math.min(Number(request.query.limit ?? 20), 100) || 20;
      const offset = Math.max(Number(request.query.offset ?? 0), 0) || 0;
      const source = request.query.source;
      const patientPseudonym = request.query.patient_pseudonym;
      const rangeEnd = offset + limit;

      let query = supabaseAdmin
        .from("transcripts")
        .select("id,created_at,patient_pseudonym,source,source_ref")
        .order("created_at", { ascending: false })
        .or("status.is.null,status.neq.processed")
        .range(offset, rangeEnd);

      if (source) {
        query = query.eq("source", source);
      }

      if (patientPseudonym) {
        query = query.eq("patient_pseudonym", patientPseudonym);
      }

      const { data, error } = await query;

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

  app.post<{ Body: ModelBody }>(
    "/ai/models/warmup",
    { preHandler: authUser },
    async (request, reply) => {
      const model = request.body?.model;

      if (!model) {
        reply.code(400);
        return { error: "missing_model" };
      }

      try {
        assertAllowedModel(model);
        await ollamaWarmup(model);
        console.log(`Ollama model warmed: ${model}`);
      } catch (error) {
        console.error("Ollama warmup failed", error);
        const message = error instanceof Error ? error.message : "unknown_error";
        if (message === "model_not_allowed") {
          reply.code(400);
          return { error: "model_not_allowed" };
        }

        reply.code(502);
        return { error: "ollama_unavailable" };
      }

      return { ok: true, model };
    }
  );

  app.get<{ Params: { id: string }; Querystring: TranscriptDetailQuery }>(
    "/transcripts/:id",
    { preHandler: authUser },
    async (request, reply) => {
      const { id } = request.params;
      const { data, error } = await supabaseAdmin
        .from("transcripts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!data) {
        reply.code(404);
        return { error: "not_found" };
      }

      await logAuditEvent({
        entity_type: "transcript",
        entity_id: data.id,
        actor_type: "user",
        actor_display: request.user!.email,
        actor_id: request.user!.id,
        action: "transcript.viewed",
        details: {
          ui: "detail",
          from: request.query.from ?? null
        }
      });

      return data;
    }
  );

  app.post<{ Params: { id: string }; Body: ModelBody }>(
    "/transcripts/:id/ai/summary",
    { preHandler: authUser },
    async (request, reply) => {
      const model = request.body?.model;

      if (!model) {
        reply.code(400);
        return { error: "missing_model" };
      }

      try {
        assertAllowedModel(model);
      } catch (error) {
        reply.code(400);
        return { error: "model_not_allowed" };
      }

      const { data: transcript, error: transcriptError } = await supabaseAdmin
        .from("transcripts")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();

      if (transcriptError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!transcript) {
        reply.code(404);
        return { error: "not_found" };
      }

      let summary;

      try {
        summary = await ollamaGenerateSummary(model, transcript.redacted_text);
      } catch (error) {
        console.error("Ollama summary failed", error);
        reply.code(502);
        return { error: "ollama_unavailable" };
      }

      const { data: artifact, error } = await supabaseAdmin
        .from("transcript_artifacts")
        .insert({
          transcript_id: transcript.id,
          artifact_type: "summary",
          model,
          status: "generated",
          content: summary.text,
          meta: { latency_ms: summary.latency_ms }
        })
        .select("*")
        .single();

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      await logAuditEvent({
        entity_type: "transcript",
        entity_id: transcript.id,
        actor_type: "user",
        actor_display: request.user!.email,
        actor_id: request.user!.id,
        action: "ai.summary_generated",
        details: { model, artifact_id: artifact.id }
      });

      let leadCount = 0;

      try {
        const leads = await createLeadsFromAi({
          transcriptId: transcript.id,
          sourceArtifactId: artifact.id,
          model,
          redactedText: transcript.redacted_text
        });
        leadCount = leads.count;

        await logAuditEvent({
          entity_type: "transcript",
          entity_id: transcript.id,
          actor_type: "user",
          actor_display: request.user!.email,
          actor_id: request.user!.id,
          action: "ai.leads_generated",
          details: { model, artifact_id: artifact.id, lead_count: leadCount }
        });
      } catch (error) {
        console.error("Lead generation failed", error);
      }

      return { ...artifact, lead_count: leadCount };
    }
  );

  app.post<{ Params: { id: string }; Body: ModelBody }>(
    "/transcripts/:id/ai/leads",
    { preHandler: authUser },
    async (request, reply) => {
      const model = request.body?.model;

      if (!model) {
        reply.code(400);
        return { error: "missing_model" };
      }

      try {
        assertAllowedModel(model);
      } catch (error) {
        reply.code(400);
        return { error: "model_not_allowed" };
      }

      const { data: transcript, error: transcriptError } = await supabaseAdmin
        .from("transcripts")
        .select("id,redacted_text")
        .eq("id", request.params.id)
        .maybeSingle();

      if (transcriptError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!transcript) {
        reply.code(404);
        return { error: "not_found" };
      }

      try {
        const result = await createLeadsFromAi({
          transcriptId: transcript.id,
          sourceArtifactId: null,
          model,
          redactedText: transcript.redacted_text
        });

        await logAuditEvent({
          entity_type: "transcript",
          entity_id: transcript.id,
          actor_type: "user",
          actor_display: request.user!.email,
          actor_id: request.user!.id,
          action: "ai.leads_generated",
          details: { model, lead_count: result.count, manual: true }
        });

        return { ok: true, lead_count: result.count };
      } catch (error) {
        console.error("Ollama leads failed", error);
        reply.code(502);
        return { error: "ollama_unavailable" };
      }
    }
  );

  app.post<{ Params: { id: string }; Body: ProcessBody }>(
    "/transcripts/:id/process",
    { preHandler: authUser },
    async (request, reply) => {
      const artifactId = request.body?.artifact_id;

      if (!artifactId) {
        reply.code(400);
        return { error: "missing_artifact" };
      }

      const { data: artifact, error: artifactError } = await supabaseAdmin
        .from("transcript_artifacts")
        .select("*")
        .eq("id", artifactId)
        .eq("transcript_id", request.params.id)
        .eq("artifact_type", "summary")
        .maybeSingle();

      if (artifactError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      if (!artifact) {
        reply.code(404);
        return { error: "not_found" };
      }

      const approvedAt = new Date().toISOString();

      const { error: updateArtifactError } = await supabaseAdmin
        .from("transcript_artifacts")
        .update({
          status: "approved",
          approved_at: approvedAt,
          approved_by: request.user!.id
        })
        .eq("id", artifact.id);

      if (updateArtifactError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const { error: updateTranscriptError } = await supabaseAdmin
        .from("transcripts")
        .update({ status: "processed" })
        .eq("id", request.params.id);

      if (updateTranscriptError) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      await logAuditEvent({
        entity_type: "transcript",
        entity_id: request.params.id,
        actor_type: "user",
        actor_display: request.user!.email,
        actor_id: request.user!.id,
        action: "transcript.processed",
        details: { artifact_id: artifact.id, model: artifact.model }
      });

      return { ok: true };
    }
  );

  app.get<{ Params: { id: string } }>(
    "/transcripts/:id/artifacts",
    { preHandler: authUser },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("transcript_artifacts")
        .select("*")
        .eq("transcript_id", request.params.id)
        .order("created_at", { ascending: false });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return data ?? [];
    }
  );

  app.get<{ Params: { id: string } }>(
    "/transcripts/:id/leads",
    { preHandler: authUser },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("lead_opportunities")
        .select("*")
        .eq("transcript_id", request.params.id)
        .order("created_at", { ascending: false });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      const sorted = (data ?? []).sort((a, b) => {
        const rankA = leadStatusRank[(a.status as LeadStatus) ?? "open"] ?? 99;
        const rankB = leadStatusRank[(b.status as LeadStatus) ?? "open"] ?? 99;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return (Number(b.lead_score) || 0) - (Number(a.lead_score) || 0);
      });

      return sorted;
    }
  );

  app.get<{ Params: { id: string } }>(
    "/transcripts/:id/audit",
    { preHandler: authUser },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("audit_events")
        .select("*")
        .eq("entity_type", "transcript")
        .eq("entity_id", request.params.id)
        .order("created_at", { ascending: false });

      if (error) {
        reply.code(500);
        return { error: "supabase_error" };
      }

      return data ?? [];
    }
  );

  app.post<{ Body: TranscriptInput }>("/transcripts", async (request, reply) => {
    const {
      patient_pseudonym: patientPseudonym,
      source,
      source_ref: sourceRef,
      text,
      idempotency_key: idempotencyKey,
      meta
    } = request.body ?? {};

    if (!patientPseudonym || !source || !text || !idempotencyKey) {
      reply.code(400);
      return { error: "missing_fields" };
    }

    const insertPayload = {
      patient_pseudonym: patientPseudonym,
      source,
      source_ref: sourceRef ?? null,
      redacted_text: text,
      idempotency_key: idempotencyKey,
      meta: meta ?? null
    };

    const { data, error } = await supabaseAdmin
      .from("transcripts")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing, error: fetchError } = await supabaseAdmin
          .from("transcripts")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (fetchError) {
          reply.code(500);
          return { error: "supabase_error" };
        }

        return existing ?? { error: "not_found" };
      }

      reply.code(500);
      return { error: "supabase_error" };
    }

    reply.code(201);
    return data;
  });
}
