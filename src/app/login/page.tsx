import { signIn, signUp } from "./actions";

const MESSAGES: Record<string, string> = {
  FIELDS: "E-mail et mot de passe (8 caractères minimum) obligatoires.",
  BAD_LOGIN: "E-mail ou mot de passe incorrect.",
  SIGNUP_FAILED: "Inscription impossible. Vérifiez l'e-mail et le mot de passe.",
  CHECK_EMAIL: "Compte créé. Confirmez votre e-mail puis connectez-vous.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const error = e && Object.hasOwn(MESSAGES, e) ? MESSAGES[e] : undefined;
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
