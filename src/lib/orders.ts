import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { computeTotals } from "./money";
import { normalizeMobile } from "./phone";
import { canTransition, type OrderStatus } from "./status";
import { isWilayaCode } from "./wilaya";

export class OrderError extends Error {
  constructor(
    public code:
      | "STORE_NOT_FOUND"
      | "PRODUCT_UNAVAILABLE"
      | "NO_DELIVERY_FEE"
      | "OUT_OF_STOCK"
      | "ORDER_NOT_FOUND"
      | "TOO_MANY_ORDERS"
      | "TOTAL_TOO_HIGH"
      | "ILLEGAL_TRANSITION"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

export const checkoutSchema = z.object({
  storeSlug: z.string().min(1).max(100),
  customerName: z.string().trim().min(2, "Nom obligatoire.").max(255),
  customerPhone: z.string().transform((v, ctx) => {
    const n = normalizeMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Numéro mobile invalide (05, 06 ou 07)." });
    return n ?? "";
  }),
  wilayaCode: z.number().int().refine(isWilayaCode, "Wilaya invalide (01 à 69)."),
  commune: z.string().trim().min(1, "Commune obligatoire.").max(150),
  address: z.string().trim().max(500).optional(),
  deliveryType: z.enum(["DOMICILE", "STOP_DESK"]),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1).max(50),
        variant: z.string().trim().max(100).optional(),
      }),
    )
    .min(1, "Panier vide.")
    .max(30),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

/** Largest order total accepted (10 million DA); keeps every money column far from the 32-bit limit. */
export const MAX_ORDER_CENTIMES = 1_000_000_000;

/**
 * Public-checkout flood limits, checked in the database so they hold across server instances.
 * A real customer rarely orders twice in ten minutes; a script floods a store in seconds.
 */
export type OrderLimits = { perPhoneWindowMs: number; perPhoneMax: number; perStoreWindowMs: number; perStoreMax: number };
export const DEFAULT_LIMITS: OrderLimits = {
  perPhoneWindowMs: 10 * 60_000,
  perPhoneMax: 3,
  perStoreWindowMs: 60_000,
  perStoreMax: 40,
};
export const NO_LIMITS: OrderLimits = {
  perPhoneWindowMs: 0,
  perPhoneMax: Infinity,
  perStoreWindowMs: 0,
  perStoreMax: Infinity,
};

// Every order of a store updates the same counter row, so a burst queues up; give it room to wait.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Statuses in which the order's items are already out of stock (taken at CONFIRMED). */
const STOCK_TAKEN: readonly OrderStatus[] = ["CONFIRMED", "SHIPPED"];

/**
 * Create an order from a public checkout. Prices and fees always come from the database, never
 * from the client. The number comes from OrderCounter inside the same transaction (no gaps, no
 * duplicates under concurrency).
 */
export async function createOrder(
  prisma: PrismaClient,
  raw: CheckoutInput,
  now = new Date(),
  limits: OrderLimits = DEFAULT_LIMITS,
) {
  const input = checkoutSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { slug: input.storeSlug } });
    if (!store) throw new OrderError("STORE_NOT_FOUND", "Boutique introuvable.");

    const since = (ms: number) => new Date(Date.now() - ms);
    if (Number.isFinite(limits.perPhoneMax)) {
      const recent = await tx.order.count({
        where: { storeId: store.id, customerPhone: input.customerPhone, createdAt: { gte: since(limits.perPhoneWindowMs) } },
      });
      if (recent >= limits.perPhoneMax) throw new OrderError("TOO_MANY_ORDERS", "Trop de commandes récentes.");
    }
    if (Number.isFinite(limits.perStoreMax)) {
      const burst = await tx.order.count({
        where: { storeId: store.id, createdAt: { gte: since(limits.perStoreWindowMs) } },
      });
      if (burst >= limits.perStoreMax) throw new OrderError("TOO_MANY_ORDERS", "Trop de commandes récentes.");
    }

    const ids = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({ where: { id: { in: ids }, storeId: store.id, active: true } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new OrderError("PRODUCT_UNAVAILABLE", "Produit indisponible.");
      return { product: p, quantity: i.quantity, variant: i.variant };
    });
    for (const id of ids) {
      const wanted = lines.filter((l) => l.product.id === id).reduce((n, l) => n + l.quantity, 0);
      if (byId.get(id)!.stock < wanted) throw new OrderError("OUT_OF_STOCK", "Stock insuffisant.");
    }

    const fee = await tx.deliveryFee.findUnique({
      where: {
        storeId_wilayaCode_deliveryType: {
          storeId: store.id,
          wilayaCode: input.wilayaCode,
          deliveryType: input.deliveryType,
        },
      },
    });
    if (!fee) throw new OrderError("NO_DELIVERY_FEE", "Livraison non disponible pour cette wilaya.");

    const totals = computeTotals(
      lines.map((l) => ({ quantity: l.quantity, unitPriceCentimes: l.product.priceCentimes })),
      fee.feeCentimes,
    );
    if (totals.totalCodCentimes > MAX_ORDER_CENTIMES) throw new OrderError("TOTAL_TOO_HIGH", "Montant trop élevé.");

    const year = now.getUTCFullYear();
    const counter = await tx.orderCounter.upsert({
      where: { storeId_year: { storeId: store.id, year } },
      create: { storeId: store.id, year, last: 1 },
      update: { last: { increment: 1 } },
    });
    const number = `CMD-${year}-${String(counter.last).padStart(4, "0")}`;

    return tx.order.create({
      data: {
        storeId: store.id,
        number,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        wilayaCode: input.wilayaCode,
        commune: input.commune,
        address: input.address,
        deliveryType: input.deliveryType,
        ...totals,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            variant: l.variant,
            quantity: l.quantity,
            unitPriceCentimes: l.product.priceCentimes,
          })),
        },
      },
      include: { items: true },
    });
  }, TX_OPTIONS);
}

/**
 * Move an order to a new status for one store. Illegal changes throw. The status is switched with a
 * compare-and-set first, so two simultaneous changes cannot both win (the loser gets CONFLICT).
 * Confirming takes the items out of stock (all or nothing); cancelling or returning a confirmed or
 * shipped order puts them back; every change appends an OrderEvent.
 */
export async function changeOrderStatus(
  prisma: PrismaClient,
  args: { storeId: string; orderId: string; to: OrderStatus; actorId?: string; note?: string },
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: args.orderId, storeId: args.storeId },
      include: { items: true },
    });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Commande introuvable.");
    if (!canTransition(order.status, args.to)) {
      throw new OrderError("ILLEGAL_TRANSITION", `Illegal order status change: ${order.status} -> ${args.to}`);
    }

    const moved = await tx.order.updateMany({
      where: { id: order.id, storeId: args.storeId, status: order.status },
      data: { status: args.to },
    });
    if (moved.count !== 1) throw new OrderError("CONFLICT", "La commande vient d'être modifiée.");

    if (args.to === "CONFIRMED") {
      for (const item of order.items) {
        if (!item.productId) continue;
        const r = await tx.product.updateMany({
          where: { id: item.productId, storeId: args.storeId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (r.count !== 1) throw new OrderError("OUT_OF_STOCK", `Stock insuffisant : ${item.productName}.`);
      }
    } else if ((args.to === "CANCELLED" || args.to === "RETURNED") && STOCK_TAKEN.includes(order.status)) {
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.updateMany({
          where: { id: item.productId, storeId: args.storeId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await tx.orderEvent.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: args.to, actorId: args.actorId, note: args.note },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  }, TX_OPTIONS);
}
