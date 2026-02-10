import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../routes/health.routes";
import { transcriptsRoutes } from "../routes/transcripts.routes";
import { authUserPlugin } from "./authUser";

export async function apiPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-methods", "GET,OPTIONS");
    reply.header("access-control-allow-headers", "content-type");
  });

  app.options("*", async (_request, reply) => {
    reply.status(204).send();
  });

  app.register(authUserPlugin);
  app.register(healthRoutes);
  app.register(transcriptsRoutes, { prefix: "/v1" });
}
