import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrisma } from "./db";
import { NO_LIMITS, OrderError, changeOrderStatus, createOrder } from "./orders";

// Integration tests: need a migrated Postgres in TEST_DATABASE_URL (skipped otherwise).
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("orders (database)", () => {
  let prisma: PrismaClient;
  let storeId: string;
  let productId: string;
  const now = new Date("2026-10-24T10:00:00Z");

  const checkout = (over: Record<string, unknown> = {}) => ({
    storeSlug: "boutique",
    customerName: "Karim B.",
    customerPhone: "0551 23 45 67",
    wilayaCode: 16,
    commune: "Bab Ezzouar",
    deliveryType: "DOMICILE" as const,
    items: [{ productId, quantity: 2 }],
    ...over,
  });

  beforeAll(() => {
    prisma = createPrisma(url);
  });
  afterAll(() => prisma.$disconnect());

  beforeEach(async () => {
    await prisma.store.deleteMany();
    const store = await prisma.store.create({
      data: { ownerId: crypto.randomUUID(), name: "Boutique", slug: "boutique" },
    });
    storeId = store.id;
    const product = await prisma.product.create({
      data: { storeId, name: "Sac", priceCentimes: 250_000, stock: 5 },
    });
    productId = product.id;
    await prisma.deliveryFee.create({ data: { storeId, wilayaCode: 16, deliveryType: "DOMICILE", feeCentimes: 60_000 } });
  });

  it("creates an order with server-side prices and a store number", async () => {
    const o = await createOrder(prisma, checkout(), now, NO_LIMITS);
    expect(o.number).toBe("CMD-2026-0001");
    expect(o.customerPhone).toBe("0551234567");
    expect(o.subtotalCentimes).toBe(500_000);
    expect(o.deliveryFeeCentimes).toBe(60_000);
    expect(o.totalCodCentimes).toBe(560_000);
    expect(o.status).toBe("PENDING");
    expect(o.items[0]).toMatchObject({ productName: "Sac", unitPriceCentimes: 250_000, quantity: 2 });
  });

  it("numbers concurrent orders without gaps or duplicates", async () => {
    const orders = await Promise.all(Array.from({ length: 10 }, () => createOrder(prisma, checkout({ items: [{ productId, quantity: 1 }] }), now, NO_LIMITS)));
    const numbers = orders.map((o) => o.number).sort();
    expect(numbers).toEqual(Array.from({ length: 10 }, (_, i) => `CMD-2026-${String(i + 1).padStart(4, "0")}`));
  });

  it("rejects bad input and unavailable things", async () => {
    await expect(createOrder(prisma, checkout({ customerPhone: "021234567" }), now, NO_LIMITS)).rejects.toThrow();
    await expect(createOrder(prisma, checkout({ wilayaCode: 70 }), now, NO_LIMITS)).rejects.toThrow();
    await expect(createOrder(prisma, checkout({ storeSlug: "nope" }), now, NO_LIMITS)).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    await expect(createOrder(prisma, checkout({ wilayaCode: 31 }), now, NO_LIMITS)).rejects.toMatchObject({ code: "NO_DELIVERY_FEE" });
    await expect(createOrder(prisma, checkout({ deliveryType: "STOP_DESK" }), now, NO_LIMITS)).rejects.toMatchObject({ code: "NO_DELIVERY_FEE" });
    await expect(createOrder(prisma, checkout({ items: [{ productId, quantity: 6 }] }), now, NO_LIMITS)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(createOrder(prisma, checkout({ items: [{ productId: crypto.randomUUID(), quantity: 1 }] }), now, NO_LIMITS)).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("does not sell a product of another store", async () => {
    const other = await prisma.store.create({ data: { ownerId: crypto.randomUUID(), name: "Autre", slug: "autre" } });
    const foreign = await prisma.product.create({ data: { storeId: other.id, name: "X", priceCentimes: 100, stock: 9 } });
    await expect(createOrder(prisma, checkout({ items: [{ productId: foreign.id, quantity: 1 }] }), now, NO_LIMITS)).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });

  it("confirming takes stock out, records an event, and cannot oversell", async () => {
    const a = await createOrder(prisma, checkout({ items: [{ productId, quantity: 3 }] }), now, NO_LIMITS);
    const b = await createOrder(prisma, checkout({ items: [{ productId, quantity: 3 }] }), now, NO_LIMITS);
    await changeOrderStatus(prisma, { storeId, orderId: a.id, to: "CONFIRMED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(2);
    await expect(changeOrderStatus(prisma, { storeId, orderId: b.id, to: "CONFIRMED" })).rejects.toBeInstanceOf(OrderError);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING");
    expect(await prisma.orderEvent.count({ where: { orderId: a.id } })).toBe(1);
    expect(await prisma.orderEvent.count({ where: { orderId: b.id } })).toBe(0);
  });

  it("refuses illegal transitions and orders of another store", async () => {
    const o = await createOrder(prisma, checkout(), now, NO_LIMITS);
    await expect(changeOrderStatus(prisma, { storeId, orderId: o.id, to: "DELIVERED" })).rejects.toThrow(/Illegal/);
    await expect(changeOrderStatus(prisma, { storeId: crypto.randomUUID(), orderId: o.id, to: "CANCELLED" })).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });
});
