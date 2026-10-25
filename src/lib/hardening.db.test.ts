import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrisma } from "./db";
import { DEFAULT_LIMITS, NO_LIMITS, OrderError, changeOrderStatus, createOrder } from "./orders";
import { createStore } from "./stores";

// Integration tests: need a migrated Postgres in TEST_DATABASE_URL (skipped otherwise).
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("hardening (database)", () => {
  let prisma: PrismaClient;
  let storeId: string;
  let productId: string;
  const now = new Date();

  const checkout = (over: Record<string, unknown> = {}) => ({
    storeSlug: "boutique",
    customerName: "Karim B.",
    customerPhone: "0551234567",
    wilayaCode: 16,
    commune: "Bab Ezzouar",
    deliveryType: "DOMICILE" as const,
    items: [{ productId, quantity: 1 }],
    ...over,
  });
  const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
  const place = (over: Record<string, unknown> = {}) => createOrder(prisma, checkout(over), now, NO_LIMITS);

  beforeAll(() => {
    prisma = createPrisma(url);
  });
  afterAll(() => prisma.$disconnect());

  beforeEach(async () => {
    await prisma.store.deleteMany();
    const store = await prisma.store.create({ data: { ownerId: crypto.randomUUID(), name: "Boutique", slug: "boutique" } });
    storeId = store.id;
    productId = (await prisma.product.create({ data: { storeId, name: "Sac", priceCentimes: 250_000, stock: 5 } })).id;
    await prisma.deliveryFee.create({ data: { storeId, wilayaCode: 16, deliveryType: "DOMICILE", feeCentimes: 60_000 } });
  });

  it("lets only one of two simultaneous confirmations through, and takes stock once", async () => {
    const o = await place({ items: [{ productId, quantity: 2 }] });
    const results = await Promise.allSettled([
      changeOrderStatus(prisma, { storeId, orderId: o.id, to: "CONFIRMED" }),
      changeOrderStatus(prisma, { storeId, orderId: o.id, to: "CONFIRMED" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(OrderError);
    expect(await stock()).toBe(3);
    expect(await prisma.orderEvent.count({ where: { orderId: o.id } })).toBe(1);
  });

  it("keeps stock and history consistent when confirm and cancel race", async () => {
    const o = await place({ items: [{ productId, quantity: 2 }] });
    await Promise.allSettled([
      changeOrderStatus(prisma, { storeId, orderId: o.id, to: "CONFIRMED" }),
      changeOrderStatus(prisma, { storeId, orderId: o.id, to: "CANCELLED" }),
    ]);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(await prisma.orderEvent.count({ where: { orderId: o.id } })).toBeGreaterThanOrEqual(1);
    // Either it ended cancelled before confirming (stock untouched) or confirmed (stock taken).
    if (after.status === "CANCELLED") expect(await stock()).toBe(5);
    else expect([after.status, await stock()]).toEqual(["CONFIRMED", 3]);
  });

  it("puts stock back when a confirmed order is cancelled, and when a shipped one is returned", async () => {
    const a = await place({ items: [{ productId, quantity: 2 }] });
    await changeOrderStatus(prisma, { storeId, orderId: a.id, to: "CONFIRMED" });
    expect(await stock()).toBe(3);
    await changeOrderStatus(prisma, { storeId, orderId: a.id, to: "CANCELLED" });
    expect(await stock()).toBe(5);

    const b = await place({ items: [{ productId, quantity: 1 }] });
    await changeOrderStatus(prisma, { storeId, orderId: b.id, to: "CONFIRMED" });
    await changeOrderStatus(prisma, { storeId, orderId: b.id, to: "SHIPPED" });
    await changeOrderStatus(prisma, { storeId, orderId: b.id, to: "RETURNED" });
    expect(await stock()).toBe(5);
  });

  it("does not touch stock when an order that never took stock is cancelled", async () => {
    const o = await place();
    await changeOrderStatus(prisma, { storeId, orderId: o.id, to: "CANCELLED" });
    expect(await stock()).toBe(5);
  });

  it("reports an illegal move as an OrderError", async () => {
    const o = await place();
    await expect(changeOrderStatus(prisma, { storeId, orderId: o.id, to: "DELIVERED" })).rejects.toMatchObject({
      code: "ILLEGAL_TRANSITION",
    });
  });

  it("limits repeated orders from one phone and bursts on one store", async () => {
    for (let i = 0; i < DEFAULT_LIMITS.perPhoneMax; i++) await createOrder(prisma, checkout(), now);
    await expect(createOrder(prisma, checkout(), now)).rejects.toMatchObject({ code: "TOO_MANY_ORDERS" });
    // another phone is still fine
    await createOrder(prisma, checkout({ customerPhone: "0661234567" }), now);

    const tight = { ...DEFAULT_LIMITS, perPhoneMax: Infinity, perStoreMax: 4 };
    await expect(createOrder(prisma, checkout({ customerPhone: "0771234567" }), now, tight)).rejects.toMatchObject({
      code: "TOO_MANY_ORDERS",
    });
  });

  it("refuses a total that would overflow the money columns", async () => {
    await prisma.product.update({ where: { id: productId }, data: { priceCentimes: 900_000_000, stock: 50 } });
    await expect(place({ items: [{ productId, quantity: 2 }] })).rejects.toMatchObject({ code: "TOTAL_TOO_HIGH" });
  });

  it("allows only one store per owner, even when created at the same time", async () => {
    const owner = crypto.randomUUID();
    const results = await Promise.allSettled([
      createStore(prisma, owner, { name: "Une", slug: "une-boutique" }),
      createStore(prisma, owner, { name: "Deux", slug: "deux-boutique" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.store.count({ where: { ownerId: owner } })).toBe(1);
  });

  it("has row level security on every table and no grants for the Supabase API roles", async () => {
    const off = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`;
    expect(off).toEqual([]);
    const roles = await prisma.$queryRaw<{ rolname: string }[]>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`;
    for (const { rolname } of roles) {
      const grants = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee = ${rolname}`;
      expect(Number(grants[0].n)).toBe(0);
    }
  });
});
