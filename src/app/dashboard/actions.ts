"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerStore } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { OrderError, changeOrderStatus } from "@/lib/orders";
import { setCallNote } from "@/lib/queue";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";

const isId = (v: string) => z.uuid().safeParse(v).success;

export async function moveOrder(orderId: string, to: string) {
  const { user, store } = await requireOwnerStore();
  if (!isId(orderId) || !(ORDER_STATUSES as readonly string[]).includes(to)) return;
  try {
    await changeOrderStatus(getPrisma(), { storeId: store.id, orderId, to: to as OrderStatus, actorId: user.id });
  } catch (e) {
    // Someone else changed it first, or the move is no longer allowed: show the fresh state instead.
    if (!(e instanceof OrderError)) throw e;
  }
  revalidatePath("/dashboard");
}

export async function saveNote(orderId: string, formData: FormData) {
  const { store } = await requireOwnerStore();
  if (!isId(orderId)) return;
  await setCallNote(getPrisma(), store.id, orderId, String(formData.get("note") ?? ""));
  revalidatePath("/dashboard");
}
