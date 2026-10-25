"use server";

import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { OrderError, checkoutSchema, createOrder } from "@/lib/orders";

// Faster than this between opening the form and sending it is not a person filling in a form.
const MIN_FILL_MS = 1500;

export async function placeOrder(slug: string, formData: FormData) {
  const field = (k: string) => String(formData.get(k) ?? "");
  // Bots: answer as if it worked, so they learn nothing, and store nothing.
  const elapsed = field("elapsed");
  if (field("website") !== "" || (elapsed !== "" && Number(elapsed) < MIN_FILL_MS)) {
    redirect(`/s/${slug}/merci`);
  }
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
