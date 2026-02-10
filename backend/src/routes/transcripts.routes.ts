import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabaseAdmin";

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

export async function transcriptsRoutes(app: FastifyInstance) {
  // List transcripts for ops UI (paginated)
  app.get<{ Querystring: TranscriptQuery }>("/transcripts", async (request, reply) => {
    const limitRaw = Number(request.query.limit ?? 20);
    let limit = Number.isNaN(limitRaw) ? 20 : limitRaw;
    limit = Math.min(Math.max(limit, 1), 500);

    const offsetRaw = Number(request.query.offset ?? 0);
    const offset = Number.isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;

    const source = request.query.source;
    const patientPseudonym = request.query.patient_pseudonym;

    let query = supabaseAdmin
      .from("transcripts")
      .select("id,created_at,patient_pseudonym,source,source_ref")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

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
    return {
      items,
      limit,
      offset,
      next_offset: offset + items.length,
      has_more: items.length === limit,
    };
  });

  // Fetch full transcript by id (detail view)
  app.get<{ Params: { id: string } }>("/transcripts/:id", async (request, reply) => {
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

    return data;
  });

  // Ingest a new transcript from upstream system (idempotent)
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
