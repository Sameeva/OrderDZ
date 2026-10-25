import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Nom de la boutique obligatoire.").max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/, "Identifiant : 3 à 50 lettres minuscules, chiffres ou tirets."),
  phone: z.string().trim().max(30).optional(),
});

const RESERVED = new Set(["login", "dashboard", "s", "api", "admin", "www", "app"]);

export class StoreError extends Error {
  constructor(public code: "SLUG_TAKEN" | "SLUG_RESERVED" | "ALREADY_HAS_STORE", message: string) {
    super(message);
  }
}

/** One store per owner for now. The slug is the public checkout address (/s/<slug>). */
export async function createStore(prisma: PrismaClient, ownerId: string, raw: z.input<typeof storeSchema>) {
  const data = storeSchema.parse(raw);
  if (RESERVED.has(data.slug)) throw new StoreError("SLUG_RESERVED", "Cet identifiant est réservé.");
  if (await prisma.store.findFirst({ where: { ownerId } })) {
    throw new StoreError("ALREADY_HAS_STORE", "Vous avez déjà une boutique.");
  }
  try {
    return await prisma.store.create({ data: { ownerId, ...data } });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      const target = JSON.stringify((e as { meta?: { target?: unknown } }).meta?.target ?? "");
      if (target.includes("ownerId")) throw new StoreError("ALREADY_HAS_STORE", "Vous avez déjà une boutique.");
      throw new StoreError("SLUG_TAKEN", "Cet identifiant est déjà pris.");
    }
    throw e;
  }
}

export function getOwnerStore(prisma: PrismaClient, ownerId: string) {
  return prisma.store.findFirst({ where: { ownerId } });
}
