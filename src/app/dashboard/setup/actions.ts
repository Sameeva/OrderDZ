"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { StoreError, createStore } from "@/lib/stores";

export async function createMyStore(formData: FormData) {
  const user = await requireUser();
  try {
    await createStore(getPrisma(), user.id, {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
    });
  } catch (e) {
    const message =
      e instanceof StoreError ? e.message : e instanceof Error && e.name === "ZodError" ? "Vérifiez les champs." : "Erreur.";
    redirect(`/dashboard/setup?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard");
}
