import "dotenv/config";
import fastify from "fastify";
import { apiPlugin } from "./plugins/api";
import { healthRoutes } from "./routes/health.routes";

const app = fastify();

app.register(apiPlugin);

const port = Number(process.env.BACKEND_PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Backend listening on http://localhost:${port}`);
});
