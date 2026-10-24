export default async function Thanks({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  return (
    <main style={{ maxWidth: 520, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>Merci !</h1>
      <p>Votre commande {n ? <strong>{n}</strong> : ""} est enregistrée. Nous vous appellerons pour la confirmer.</p>
    </main>
  );
}
