"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerStore } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { changeOrderStatus } from "@/lib/orders";
import { setCallNote } from "@/lib/queue";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";

export async function moveOrder(orderId: string, to: string) {
  const { user, store } = await requireOwnerStore();
  if (!(ORDER_STATUSES as readonly string[]).includes(to)) return;
  await changeOrderStatus(getPrisma(), { storeId: store.id, orderId, to: to as OrderStatus, actorId: user.id });
  revalidatePath("/dashboard");
}

export async function saveNote(orderId: string, formData: FormData) {
  const { store } = await requireOwnerStore();
  await setCallNote(getPrisma(), store.id, orderId, String(formData.get("note") ?? ""));
  revalidatePath("/dashboard");
}
