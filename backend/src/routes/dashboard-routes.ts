import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async (request) => {
    const query = z.object({ userId: z.string() }).parse(request.query);

    const [profiles, recentAnalyses, knowledgeCount] = await Promise.all([
      prisma.allergyProfile.findMany({ where: { userId: query.userId }, include: { allergySettings: true } }),
      prisma.analysisHistory.findMany({
        where: { userId: query.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { profileHits: true }
      }),
      prisma.ingredientKnowledge.count()
    ]);

    return {
      profiles,
      recentAnalyses,
      knowledgeCount
    };
  });
}
