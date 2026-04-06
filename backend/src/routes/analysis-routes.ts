import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { analyzeIngredients } from "../services/risk-engine.js";

const analysisSchema = z.object({
  userId: z.string(),
  extractedText: z.string().min(3),
  productQuery: z.string().optional(),
  scope: z.enum(["selected", "all"]),
  profileIds: z.array(z.string()).optional()
});

export async function registerAnalysisRoutes(app: FastifyInstance) {
  app.post("/api/analyze", async (request) => {
    const payload = analysisSchema.parse(request.body);
    return analyzeIngredients(payload);
  });
}
