import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getPrisma } from "@/lib/db";
import { placeOrder } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID: "Vérifiez les champs du formulaire.",
  STORE_NOT_FOUND: "Boutique introuvable.",
  PRODUCT_UNAVAILABLE: "Ce produit n'est plus disponible.",
  NO_DELIVERY_FEE: "Livraison non disponible pour cette wilaya.",
  OUT_OF_STOCK: "Stock insuffisant.",
  ERROR: "Une erreur est survenue, veuillez réessayer.",
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commander",
  robots: { index: false },
};

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { slug } = await params;
  const { e } = await searchParams;
  // Only fixed messages are ever shown: the query string is attacker-controlled.
  const error = e ? (ERROR_MESSAGES[e] ?? ERROR_MESSAGES.ERROR) : undefined;
  const prisma = getPrisma();
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true, stock: { gt: 0 } }, orderBy: { name: "asc" } },
      deliveryFees: { orderBy: { wilayaCode: "asc" } },
    },
  });
  if (!store) notFound();

  // Display only: the server action recomputes the real price and fee from the database.
  const products = store.products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCentimes: p.priceCentimes,
    stock: p.stock,
  }));
  const fees = store.deliveryFees.map((f) => ({
    wilayaCode: f.wilayaCode,
    deliveryType: f.deliveryType,
    feeCentimes: f.feeCentimes,
  }));

  return (
    <main className="co-page">
      <header className="co-top">
        <span className="co-mark" aria-hidden="true" />
        <div>
          <p className="co-eyebrow">Commande à la livraison</p>
          <h1 className="co-store">{store.name}</h1>
        </div>
      </header>
      <CheckoutForm action={placeOrder.bind(null, slug)} products={products} fees={fees} serverError={error} />
    </main>
  );
}
