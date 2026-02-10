import type { FastifyInstance } from "fastify";
import { logAuditEvent } from "../lib/audit";
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
