import Link from "next/link";
import { requireOwnerStore } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { formatDA } from "@/lib/money";
import { wilayaLabel } from "@/lib/wilaya";
import { countByStatus, listOrders, whatsappLink } from "@/lib/queue";
import { ORDER_STATUSES, allowedTransitions, type OrderStatus } from "@/lib/status";
import { signOut } from "../login/actions";
import { moveOrder, saveNote } from "./actions";

export const dynamic = "force-dynamic";

const LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  NO_ANSWER_1: "Pas de réponse 1",
  NO_ANSWER_2: "Pas de réponse 2",
  CONFIRMED: "Confirmée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  RETURNED: "Retour",
  CANCELLED: "Annulée",
};
const TO_CALL: OrderStatus[] = ["PENDING", "NO_ANSWER_1", "NO_ANSWER_2"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { store } = await requireOwnerStore();
  const { s } = await searchParams;
  const current = (ORDER_STATUSES as readonly string[]).includes(s ?? "") ? (s as OrderStatus) : undefined;
  const prisma = getPrisma();
  const [orders, counts] = await Promise.all([
    listOrders(prisma, store.id, current ? [current] : TO_CALL),
    countByStatus(prisma, store.id),
  ]);

  return (
    <main style={{ maxWidth: 900, margin: "1.5rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{store.name}</h1>
        <form action={signOut}>
          <button>Déconnexion</button>
        </form>
      </header>
      <p>
        Page de commande : <code>/s/{store.slug}</code>
      </p>
      <nav style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <Link href="/dashboard">À appeler ({TO_CALL.reduce((n, k) => n + (counts[k] ?? 0), 0)})</Link>
        {ORDER_STATUSES.map((k) => (
          <Link key={k} href={`/dashboard?s=${k}`}>
            {LABELS[k]} ({counts[k] ?? 0})
          </Link>
        ))}
      </nav>
      {orders.length === 0 && <p>Aucune commande.</p>}
      {orders.map((o) => (
        <section key={o.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}>
          <strong>{o.number}</strong> - {LABELS[o.status]} - à encaisser <strong>{formatDA(o.totalCodCentimes)}</strong>
          {o.previousProblemOrders > 0 && (
            <span role="note"> - Attention : {o.previousProblemOrders} commande(s) précédente(s) annulée(s) ou retournée(s)</span>
          )}
          <p>
            {o.customerName} - <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a> -{" "}
            <a href={whatsappLink(o.customerPhone)} target="_blank" rel="noreferrer noopener">
              WhatsApp
            </a>
            <br />
            {wilayaLabel(o.wilayaCode)}, {o.commune}
            {o.address ? `, ${o.address}` : ""} ({o.deliveryType === "DOMICILE" ? "domicile" : "stop desk"})
          </p>
          <ul>
            {o.items.map((i) => (
              <li key={i.id}>
                {i.quantity} x {i.productName} ({formatDA(i.unitPriceCentimes)})
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {allowedTransitions(o.status).map((to) => (
              <form key={to} action={moveOrder.bind(null, o.id, to)}>
                <button>{LABELS[to]}</button>
              </form>
            ))}
          </div>
          <form action={saveNote.bind(null, o.id)} style={{ marginTop: "0.5rem" }}>
            <input name="note" defaultValue={o.callNotes ?? ""} placeholder="Note d'appel" maxLength={1000} />
            <button>Enregistrer</button>
          </form>
        </section>
      ))}
    </main>
  );
}
