import { requireUser, getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";
import type { InviteCode } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <SettingsClient
      email={user.email ?? ""}
      displayName={profile?.display_name ?? ""}
      invites={(invites ?? []) as InviteCode[]}
    />
  );
}
