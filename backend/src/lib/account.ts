import { prisma } from "./db.js";

export async function ensureUser(email: string, displayName: string) {
  return prisma.user.upsert({
    where: { email },
    update: { displayName },
    create: { email, displayName }
  });
}

export async function ensureSeedUser() {
  return ensureUser("demo@clearaller.local", "Demo Family Account");
}
