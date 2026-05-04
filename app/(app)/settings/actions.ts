"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function updateDisplayName(
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const display_name = String(formData.get("display_name") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: display_name || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

function randomCode(): string {
  // Human-readable, no ambiguous characters
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () =>
    Array.from({ length: 4 })
      .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
      .join("");
  return `${pick()}-${pick()}`;
}

export async function generateInviteCode(): Promise<SettingsResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const code = randomCode();
  const { error } = await supabase.from("invite_codes").insert({
    code,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteAccount(): Promise<SettingsResult> {
  const user = await requireUser();
  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };
  redirect("/login");
}
