import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../lib/supabaseAdmin";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string };
  }
}

export async function authUserPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);
}

export async function authUser(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("Missing or malformed Authorization header");
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    console.warn("Invalid Supabase access token", error);
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  request.user = {
    id: data.user.id,
    email: data.user.email ?? "unknown"
  };
}
