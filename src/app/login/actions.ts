"use server";

import { redirect } from "next/navigation";
import { createSupabase } from "@/lib/supabase/server";

const back = (message: string): never => redirect(`/login?error=${encodeURIComponent(message)}`);

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) back("E-mail et mot de passe (8 caractères minimum) obligatoires.");
  return { email, password };
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) back("E-mail ou mot de passe incorrect.");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signUp(credentials(formData));
  if (error) back("Inscription impossible. Vérifiez l'e-mail et le mot de passe.");
  // With e-mail confirmation on, there is no session yet.
  if (!data.session) back("Compte créé. Confirmez votre e-mail puis connectez-vous.");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
