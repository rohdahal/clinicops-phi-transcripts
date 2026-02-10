import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../routes/health.routes";
import { transcriptsRoutes } from "../routes/transcripts.routes";
import { dashboardRoutes } from "../routes/dashboard.routes";
import { authUserPlugin } from "./authUser";

export async function apiPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type,authorization");
  });

  app.options("*", async (_request, reply) => {
    reply.status(204).send();
  });

  app.register(authUserPlugin);
  app.register(healthRoutes);
  app.register(dashboardRoutes, { prefix: "/v1" });
  app.register(transcriptsRoutes, { prefix: "/v1" });
}
