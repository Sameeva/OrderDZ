import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyNumber } from "@/components/checkout/CopyNumber";
import "@/components/checkout/checkout.css";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commande reçue",
  robots: { index: false },
};

const STEPS = [
  { t: "Commande reçue", d: "Elle est enregistrée chez le vendeur.", done: true },
  { t: "Appel de confirmation", d: "Gardez votre téléphone à portée : le vendeur vous appelle pour confirmer.", now: true },
  { t: "Expédition", d: "Le colis part vers votre wilaya une fois la commande confirmée." },
  { t: "Paiement à la réception", d: "Vous réglez en espèces au livreur, après avoir vu le colis." },
];

export default async function Thanks({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { slug } = await params;
  const { n } = await searchParams;
  const store = await getPrisma().store.findUnique({ where: { slug }, select: { name: true, phone: true } });
  if (!store) notFound();
  const number = n && /^CMD-\d{4}-\d{4,}$/.test(n) ? n : undefined;
  const tel = store.phone?.replace(/[^\d+]/g, "");

  return (
    <main className="ty">
      <div className="ty-stage">
        <article className="ty-ticket">
          <div className="ticket-stripe" aria-hidden="true" />
          <div className="ty-stamp" aria-hidden="true">
            <div className="ty-stamp-in">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
              Reçue
            </div>
          </div>
          <p className="co-eyebrow">{store.name}</p>
          <h1 className="ty-title">Merci, c&apos;est noté !</h1>
          <p className="ty-lead">Votre commande est bien enregistrée. Rien à payer maintenant.</p>

          <div className="t-perf" aria-hidden="true" />

          {number && (
            <div className="ty-num">
              <div>
                <span className="ty-num-label">Numéro de commande</span>
                <strong className="ty-num-val">{number}</strong>
              </div>
              <CopyNumber value={number} />
            </div>
          )}

          <div className="t-perf" aria-hidden="true" />

          <h2 className="sr-only">Et maintenant ?</h2>
          <ol className="ty-steps">
            {STEPS.map((s, i) => (
              <li key={s.t} className="ty-step" data-done={s.done || undefined} data-now={s.now || undefined} aria-current={s.now ? "step" : undefined}>
                <span className="ty-dot" aria-hidden="true">
                  {s.done ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <div className="ty-actions">
          {tel && (
            <a className="ty-link ty-link--primary pressable" href={`tel:${tel}`}>
              Appeler la boutique
            </a>
          )}
          <Link className={`ty-link pressable`} href={`/s/${slug}`}>
            Retour à la boutique
          </Link>
        </div>
        <p className="ty-foot">Un doute sur votre commande ? Gardez ce numéro et citez-le au vendeur.</p>
      </div>
    </main>
  );
}
