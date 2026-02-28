import fastify from "fastify";
import { describe, expect, it } from "vitest";
import { healthRoutes } from "../../src/routes/health.routes";

describe("healthRoutes", () => {
  it("returns ok", async () => {
    const app = fastify();
    await app.register(healthRoutes);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
