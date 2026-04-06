import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ensureSeedUser, ensureUser } from "../lib/account.js";

const accountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2)
});

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/api/account/demo", async (_request, reply) => {
    const user = await ensureSeedUser();
    return reply.send(user);
  });

  app.post("/api/account", async (request, reply) => {
    const payload = accountSchema.parse(request.body);
    const user = await ensureUser(payload.email, payload.displayName);
    return reply.status(StatusCodes.CREATED).send(user);
  });
}
