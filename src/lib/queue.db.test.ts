import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrisma } from "./db";
import { NO_LIMITS, createOrder } from "./orders";
import { countByStatus, listOrders, setCallNote, whatsappLink } from "./queue";
import { StoreError, createStore, storeSchema } from "./stores";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

describe("whatsappLink and storeSchema", () => {
  it("builds an international link", () => {
    expect(whatsappLink("0551234567")).toBe("https://wa.me/213551234567");
  });
  it("normalizes and validates slugs", () => {
    expect(storeSchema.parse({ name: "Ma Boutique", slug: " Ma-Boutique " }).slug).toBe("ma-boutique");
    for (const slug of ["ab", "-abc", "abc-", "a b c", "é-shop", "x".repeat(60)]) {
      expect(storeSchema.safeParse({ name: "Ma Boutique", slug }).success, slug).toBe(false);
    }
  });
});

d("stores and queue (database)", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createPrisma(url);
  });
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    await prisma.store.deleteMany();
  });

  async function seed(slug: string) {
    const store = await createStore(prisma, crypto.randomUUID(), { name: slug, slug });
    const product = await prisma.product.create({ data: { storeId: store.id, name: "Sac", priceCentimes: 100_000, stock: 50 } });
    await prisma.deliveryFee.create({ data: { storeId: store.id, wilayaCode: 16, deliveryType: "DOMICILE", feeCentimes: 60_000 } });
    const order = (phone = "0551234567") =>
      createOrder(prisma, {
        storeSlug: slug,
        customerName: "Client",
        customerPhone: phone,
        wilayaCode: 16,
        commune: "Alger",
        deliveryType: "DOMICILE",
        items: [{ productId: product.id, quantity: 1 }],
      }, new Date(), NO_LIMITS);
    return { store, order };
  }

  it("creates one store per owner with a unique, non-reserved slug", async () => {
    const owner = crypto.randomUUID();
    await createStore(prisma, owner, { name: "Une", slug: "une" });
    await expect(createStore(prisma, owner, { name: "Deux", slug: "deux" })).rejects.toMatchObject({ code: "ALREADY_HAS_STORE" });
    await expect(createStore(prisma, crypto.randomUUID(), { name: "Autre", slug: "une" })).rejects.toMatchObject({ code: "SLUG_TAKEN" });
    await expect(createStore(prisma, crypto.randomUUID(), { name: "Admin", slug: "admin" })).rejects.toBeInstanceOf(StoreError);
  });

  it("lists only the orders of the store, filtered by status, with counts", async () => {
    const a = await seed("boutique-a");
    const b = await seed("boutique-b");
    await a.order();
    await a.order("0661234567");
    await b.order();
    expect(await listOrders(prisma, a.store.id)).toHaveLength(2);
    expect(await listOrders(prisma, a.store.id, ["CONFIRMED"])).toHaveLength(0);
    expect(await countByStatus(prisma, a.store.id)).toEqual({ PENDING: 2 });
  });

  it("flags a customer with earlier returned or cancelled orders", async () => {
    const a = await seed("boutique-a");
    const old = await a.order("0771234567");
    await prisma.order.update({ where: { id: old.id }, data: { status: "RETURNED" } });
    await a.order("0771234567");
    const rows = await listOrders(prisma, a.store.id, ["PENDING"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].previousProblemOrders).toBe(1);
  });

  it("saves a call note only for the owner's store", async () => {
    const a = await seed("boutique-a");
    const b = await seed("boutique-b");
    const o = await a.order();
    await setCallNote(prisma, a.store.id, o.id, "  rappeler à 18h ");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).callNotes).toBe("rappeler à 18h");
    await expect(setCallNote(prisma, b.store.id, o.id, "x")).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });
});
