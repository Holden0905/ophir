"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string } | null;

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const inviteCode = String(formData.get("invite_code") ?? "").trim();
  if (!email || !password) return { error: "Email and password required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  // Validate invite code (if provided) using the service-role client so RLS
  // doesn't hide unused codes from the unauthenticated visitor.
  let validatedCode: string | null = null;
  if (inviteCode) {
    const svc = createServiceClient();
    const { data: code } = await svc
      .from("invite_codes")
      .select("id, code, used_by")
      .eq("code", inviteCode)
      .maybeSingle();
    if (!code) return { error: "Invite code not found." };
    if (code.used_by) return { error: "Invite code already redeemed." };
    validatedCode = code.code;
  }

  const supabase = await createClient();
  const hdr = await headers();
  const origin =
    hdr.get("origin") ??
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };

  // Mark the invite as used + record on profile (the profile row was just
  // created by the auth trigger, but only once email confirmation completes
  // for confirmation-required projects). Touch service-side to be safe.
  if (validatedCode && data.user) {
    const svc = createServiceClient();
    await svc
      .from("invite_codes")
      .update({ used_by: data.user.id, used_at: new Date().toISOString() })
      .eq("code", validatedCode);
    await svc
      .from("profiles")
      .update({ invite_code_used: validatedCode })
      .eq("id", data.user.id);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return {
    success:
      "Check your email — we sent a confirmation link to finish signup.",
  };
}

export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email required." };

  const supabase = await createClient();
  const hdr = await headers();
  const origin =
    hdr.get("origin") ??
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { success: "Magic link sent — check your inbox." };
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
