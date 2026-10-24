import { requireUser } from "@/lib/auth";
import { createMyStore } from "./actions";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
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
