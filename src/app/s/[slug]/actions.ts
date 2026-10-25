"use server";

import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { OrderError, checkoutSchema, createOrder } from "@/lib/orders";

export async function placeOrder(slug: string, formData: FormData) {
  const field = (k: string) => String(formData.get(k) ?? "");
  const parsed = checkoutSchema.safeParse({
    storeSlug: slug,
    customerName: field("customerName"),
    customerPhone: field("customerPhone"),
    wilayaCode: Number(field("wilayaCode")),
    commune: field("commune"),
    address: field("address") || undefined,
    deliveryType: field("deliveryType"),
    items: [{ productId: field("productId"), quantity: Number(field("quantity") || 1) }],
  });
  if (!parsed.success) {
    redirect(`/s/${slug}?e=INVALID`);
  }
  let number: string;
  try {
    number = (await createOrder(getPrisma(), parsed.data)).number;
  } catch (e) {
    redirect(`/s/${slug}?e=${e instanceof OrderError ? e.code : "ERROR"}`);
  }
  redirect(`/s/${slug}/merci?n=${encodeURIComponent(number)}`);
}
