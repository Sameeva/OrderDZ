import { redirect } from "next/navigation";
import { getPrisma } from "./db";
import { getOwnerStore } from "./stores";
import { createSupabase } from "./supabase/server";

/** The signed-in owner, or a redirect to /login. getUser() revalidates the token with Supabase. */
export async function requireUser() {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user;
}

/** The owner and their store; sends new owners to the store setup page. */
export async function requireOwnerStore() {
  const user = await requireUser();
  const store = await getOwnerStore(getPrisma(), user.id);
  if (!store) redirect("/dashboard/setup");
  return { user, store };
}
