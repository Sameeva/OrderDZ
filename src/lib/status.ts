export const ORDER_STATUSES = [
  "PENDING",
  "NO_ANSWER_1",
  "NO_ANSWER_2",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["NO_ANSWER_1", "CONFIRMED", "CANCELLED"],
  NO_ANSWER_1: ["NO_ANSWER_2", "CONFIRMED", "CANCELLED"],
  NO_ANSWER_2: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return NEXT[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

/** Throws on an illegal change; the caller records an OrderEvent when it succeeds. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new Error(`Illegal order status change: ${from} -> ${to}`);
}
