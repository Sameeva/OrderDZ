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
    const code = e instanceof StoreError ? e.code : e instanceof Error && e.name === "ZodError" ? "INVALID" : "ERROR";
    redirect(`/dashboard/setup?e=${code}`);
  }
  redirect("/dashboard");
}
