import { createClient } from "@/lib/supabase/server";
import { DiscoveryClient } from "./DiscoveryClient";
import type { DiscoveryScan } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery" };

export default async function DiscoveryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("discovery_scans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(7);
  const scans = (data ?? []) as DiscoveryScan[];
  return <DiscoveryClient initialScans={scans} />;
}
