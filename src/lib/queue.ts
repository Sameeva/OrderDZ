import type { PrismaClient } from "@prisma/client";
import { OrderError } from "./orders";
import type { OrderStatus } from "./status";

/** Orders of one store, newest first, optionally limited to some statuses. */
export async function listOrders(prisma: PrismaClient, storeId: string, statuses?: readonly OrderStatus[]) {
  const orders = await prisma.order.findMany({
    where: { storeId, ...(statuses ? { status: { in: [...statuses] } } : {}) },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Customers with earlier returned or cancelled orders are flagged for the caller.
  const phones = [...new Set(orders.map((o) => o.customerPhone))];
  const bad = await prisma.order.groupBy({
    by: ["customerPhone"],
    where: { storeId, customerPhone: { in: phones }, status: { in: ["RETURNED", "CANCELLED"] } },
    _count: { _all: true },
  });
  const badByPhone = new Map(bad.map((b) => [b.customerPhone, b._count._all]));
  return orders.map((o) => ({ ...o, previousProblemOrders: badByPhone.get(o.customerPhone) ?? 0 }));
}

export async function countByStatus(prisma: PrismaClient, storeId: string) {
  const rows = await prisma.order.groupBy({ by: ["status"], where: { storeId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<OrderStatus, number>>;
}

export async function setCallNote(prisma: PrismaClient, storeId: string, orderId: string, note: string) {
  const r = await prisma.order.updateMany({
    where: { id: orderId, storeId },
    data: { callNotes: note.trim().slice(0, 1000) || null },
  });
  if (r.count !== 1) throw new OrderError("ORDER_NOT_FOUND", "Commande introuvable.");
}

/** WhatsApp click-to-chat link for a national mobile number (0551234567 -> wa.me/213551234567). */
export function whatsappLink(nationalMobile: string): string {
  return `https://wa.me/213${nationalMobile.slice(1)}`;
}
