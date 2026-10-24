"use server";

import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { OrderError, checkoutSchema, createOrder } from "@/lib/orders";

const MESSAGES: Record<OrderError["code"], string> = {
  STORE_NOT_FOUND: "Boutique introuvable.",
  PRODUCT_UNAVAILABLE: "Ce produit n'est plus disponible.",
  NO_DELIVERY_FEE: "Livraison non disponible pour cette wilaya.",
  OUT_OF_STOCK: "Stock insuffisant.",
  ORDER_NOT_FOUND: "Commande introuvable.",
};

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
    redirect(`/s/${slug}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  let number: string;
  try {
    number = (await createOrder(getPrisma(), parsed.data)).number;
  } catch (e) {
    const message = e instanceof OrderError ? MESSAGES[e.code] : "Erreur, veuillez réessayer.";
    redirect(`/s/${slug}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/s/${slug}/merci?n=${encodeURIComponent(number)}`);
}
