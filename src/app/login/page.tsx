import { signIn, signUp } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 400, margin: "3rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>OrderDZ</h1>
      {error && <p role="alert">{error}</p>}
      <form style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autoComplete="current-password" minLength={8} required />
        </label>
        <button formAction={signIn}>Se connecter</button>
        <button formAction={signUp}>Créer un compte</button>
      </form>
    </main>
  );
}
