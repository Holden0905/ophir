"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  refreshFundamentals,
  refreshTechnicals,
} from "@/lib/stocks/refresh";
import { blcPhaseLabel } from "@/lib/calculations/blc";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addStock(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const ticker = String(formData.get("ticker") ?? "")
    .trim()
    .toUpperCase();
  const phaseRaw = String(formData.get("blc_phase") ?? "");
  const blc = phaseRaw ? Number(phaseRaw) : null;
  const isPosition = formData.get("is_position") === "on";

  if (!ticker) return { ok: false, error: "Ticker required" };

  const supabase = await createClient();
  const { error } = await supabase.from("stocks").upsert(
    {
      user_id: user.id,
      ticker,
      blc_phase: blc,
      blc_phase_label: blc ? blcPhaseLabel(blc) : null,
      is_interested: true,
      is_position: isPosition,
      is_archived: false,
    },
    { onConflict: "user_id,ticker" },
  );
  if (error) return { ok: false, error: error.message };

  // Best-effort fetch of fresh data — non-blocking on the user's side.
  try {
    await refreshTechnicals(ticker);
    await refreshFundamentals(ticker);
  } catch {
    // We surface stale-data warnings in the UI; refresh failures are non-fatal.
  }

  revalidatePath("/matrix");
  return { ok: true };
}

export async function updateStock(
  id: string,
  fields: {
    blc_phase?: number | null;
    is_position?: boolean;
    is_interested?: boolean;
    is_archived?: boolean;
    notes?: string | null;
    company_name?: string | null;
    sector?: string | null;
  },
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const update: Record<string, unknown> = { ...fields };
  if (fields.blc_phase !== undefined) {
    update.blc_phase_label = fields.blc_phase
      ? blcPhaseLabel(fields.blc_phase)
      : null;
  }
  const { error } = await supabase.from("stocks").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/matrix");
  return { ok: true };
}

export async function removeStock(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("stocks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/matrix");
  return { ok: true };
}

export async function addStockByTicker(
  ticker: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const t = ticker.trim().toUpperCase();
  if (!t) return { ok: false, error: "Ticker required" };

  const supabase = await createClient();
  const { error } = await supabase.from("stocks").upsert(
    {
      user_id: user.id,
      ticker: t,
      is_interested: true,
      is_archived: false,
    },
    { onConflict: "user_id,ticker" },
  );
  if (error) return { ok: false, error: error.message };

  try {
    await refreshTechnicals(t);
    await refreshFundamentals(t);
  } catch {
    /* non-fatal */
  }
  revalidatePath("/matrix");
  return { ok: true };
}
