import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";

const allergyCategoryEnum = z.enum(["dairy", "peanuts", "gluten", "soy", "eggs", "shellfish", "tree-nuts", "sesame", "fragrance", "preservatives", "colorants", "sulfates", "parabens"]);
const severityEnum = z.enum(["low", "medium", "high", "critical"]);

const allergyProfileSchema = z.object({
  userId: z.string().min(3),
  name: z.string().min(2),
  age: z.number().int().positive(),
  allergySettings: z.array(
    z.object({
      category: allergyCategoryEnum,
      severity: severityEnum
    })
  ).min(1),
  medicalConditions: z.array(z.object({ name: z.string(), note: z.string().optional() })).optional()
});

function toPrismaCategory(category: string) {
  return category.replace("-", "_");
}

function uniqueAllergies(allergySettings: Array<{ category: string; severity: string }>) {
  return Array.from(new Map(allergySettings.map((entry) => [entry.category, entry])).values());
}

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get("/api/profiles", async (request) => {
    const query = z.object({ userId: z.string() }).parse(request.query);
    return prisma.allergyProfile.findMany({
      where: { userId: query.userId },
      include: { allergySettings: true },
      orderBy: { createdAt: "desc" }
    });
  });

  app.post("/api/profiles", async (request, reply) => {
    const payload = allergyProfileSchema.parse(request.body);

    const profile = await prisma.allergyProfile.create({
      data: {
        userId: payload.userId,
        name: payload.name,
        age: payload.age,
        medicalConditions: payload.medicalConditions ?? [],
        allergySettings: {
          create: uniqueAllergies(payload.allergySettings).map((entry) => ({
            category: toPrismaCategory(entry.category) as never,
            severity: entry.severity as never
          }))
        }
      },
      include: { allergySettings: true }
    });

    return reply.status(StatusCodes.CREATED).send(profile);
  });

  app.put("/api/profiles/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const payload = allergyProfileSchema.parse(request.body);

    const profile = await prisma.allergyProfile.findFirst({
      where: {
        id: params.id,
        userId: payload.userId
      }
    });

    if (!profile) {
      return reply.status(StatusCodes.NOT_FOUND).send({ message: "Profile not found." });
    }

    const updated = await prisma.allergyProfile.update({
      where: { id: profile.id },
      data: {
        name: payload.name,
        age: payload.age,
        medicalConditions: payload.medicalConditions ?? [],
        allergySettings: {
          deleteMany: {},
          create: uniqueAllergies(payload.allergySettings).map((entry) => ({
            category: toPrismaCategory(entry.category) as never,
            severity: entry.severity as never
          }))
        }
      },
      include: { allergySettings: true }
    });

    return reply.status(StatusCodes.OK).send(updated);
  });

  app.delete("/api/profiles/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({ userId: z.string() }).parse(request.query);

    const profile = await prisma.allergyProfile.findFirst({
      where: {
        id: params.id,
        userId: query.userId
      }
    });

    if (!profile) {
      return reply.status(StatusCodes.NOT_FOUND).send({ message: "Profile not found." });
    }

    await prisma.allergyProfile.delete({
      where: { id: profile.id }
    });

    return reply.status(StatusCodes.OK).send({ success: true });
  });
}
