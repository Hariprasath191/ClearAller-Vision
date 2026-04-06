import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { searchAndEvaluateProducts } from "../services/product-search.js";

const searchQuerySchema = z.object({
  userId: z.string(),
  q: z.string().min(2),
  lens: z.enum(["packaged-food", "cosmetic"]).optional(),
  scope: z.enum(["selected", "all"]).default("all"),
  profileIds: z.string().optional()
});

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get("/api/search/products", async (request) => {
    const query = searchQuerySchema.parse(request.query);
    return searchAndEvaluateProducts({
      userId: query.userId,
      query: query.q,
      lens: query.lens,
      scope: query.scope,
      profileIds: query.profileIds ? query.profileIds.split(",") : undefined
    });
  });
}
