"use server";

import { redirect } from "next/navigation";
import { createSupabase } from "@/lib/supabase/server";

const back = (code: "FIELDS" | "BAD_LOGIN" | "SIGNUP_FAILED" | "CHECK_EMAIL"): never => redirect(`/login?e=${code}`);

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) back("FIELDS");
  return { email, password };
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) back("BAD_LOGIN");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signUp(credentials(formData));
  if (error) back("SIGNUP_FAILED");
  // With e-mail confirmation on, there is no session yet.
  if (!data.session) back("CHECK_EMAIL");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
