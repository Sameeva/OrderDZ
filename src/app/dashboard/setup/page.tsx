import { requireUser } from "@/lib/auth";
import { createMyStore } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "Cet identifiant est déjà pris.",
  SLUG_RESERVED: "Cet identifiant est réservé.",
  ALREADY_HAS_STORE: "Vous avez déjà une boutique.",
  INVALID: "Vérifiez les champs.",
  ERROR: "Erreur.",
};

export default async function Setup({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireUser();
  const { e } = await searchParams;
  const error = e && Object.hasOwn(MESSAGES, e) ? MESSAGES[e] : undefined;
  return (
    <main style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>Votre boutique</h1>
      {error && <p role="alert">{error}</p>}
      <form action={createMyStore} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Nom de la boutique
          <input name="name" required />
        </label>
        <label>
          Identifiant (adresse : /s/identifiant)
          <input name="slug" pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]" required />
        </label>
        <label>
          Téléphone
          <input name="phone" type="tel" />
        </label>
        <button type="submit">Créer</button>
      </form>
    </main>
  );
}
