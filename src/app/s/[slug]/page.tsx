import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { formatDA } from "@/lib/money";
import { placeOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const prisma = getPrisma();
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true, stock: { gt: 0 } }, orderBy: { name: "asc" } },
      deliveryFees: { orderBy: { wilayaCode: "asc" } },
    },
  });
  if (!store) notFound();

  const wilayas = [...new Set(store.deliveryFees.map((f) => f.wilayaCode))];
  const action = placeOrder.bind(null, slug);

  return (
    <main style={{ maxWidth: 520, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>{store.name}</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      <form action={action} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Produit
          <select name="productId" required>
            {store.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {formatDA(p.priceCentimes)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantité
          <input name="quantity" type="number" min={1} max={50} defaultValue={1} required />
        </label>
        <label>
          Nom complet
          <input name="customerName" autoComplete="name" required />
        </label>
        <label>
          Téléphone mobile
          <input name="customerPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05 51 23 45 67" required />
        </label>
        <label>
          Wilaya
          <select name="wilayaCode" required>
            {wilayas.map((w) => (
              <option key={w} value={w}>
                {String(w).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Commune
          <input name="commune" required />
        </label>
        <label>
          Adresse
          <input name="address" autoComplete="street-address" />
        </label>
        <fieldset>
          <legend>Livraison</legend>
          <label>
            <input type="radio" name="deliveryType" value="DOMICILE" defaultChecked /> À domicile
          </label>{" "}
          <label>
            <input type="radio" name="deliveryType" value="STOP_DESK" /> Point relais (stop desk)
          </label>
        </fieldset>
        <p>Paiement à la livraison. Le total, frais de livraison inclus, est confirmé par téléphone.</p>
        <button type="submit">Commander</button>
      </form>
    </main>
  );
}
