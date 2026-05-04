"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAccount,
  generateInviteCode,
  updateDisplayName,
} from "./actions";
import { relativeTime } from "@/lib/format";
import type { InviteCode } from "@/lib/supabase/types";

export function SettingsClient({
  email,
  displayName,
  invites,
}: {
  email: string;
  displayName: string;
  invites: InviteCode[];
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [savingName, startSaveName] = useTransition();
  const [savingInvite, startInvite] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveName(formData: FormData) {
    setError(null);
    startSaveName(async () => {
      const r = await updateDisplayName(formData);
      if (!r.ok) setError(r.error);
    });
  }

  function newInvite() {
    setError(null);
    startInvite(async () => {
      const r = await generateInviteCode();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function destroy() {
    if (
      !confirm(
        "Delete your account and all your stocks/notes? This cannot be undone.",
      )
    )
      return;
    void deleteAccount();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-editorial text-3xl tracking-tight text-[var(--text-primary)]">
        Settings
      </h1>

      <div className="card p-5">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Account
        </div>
        <form action={saveName} className="mt-4 space-y-3">
          <div>
            <label className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Email
            </label>
            <div className="mt-1 font-data text-sm text-[var(--text-primary)]">
              {email}
            </div>
          </div>
          <div>
            <label className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Display name
            </label>
            <input
              name="display_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full max-w-sm px-3 py-2 font-ui text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Invite codes
            </div>
            <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
              Generate a code to bring someone into Ophir.
            </p>
          </div>
          <button
            type="button"
            onClick={newInvite}
            disabled={savingInvite}
            className="rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50"
          >
            {savingInvite ? "…" : "Generate"}
          </button>
        </div>

        <div className="mt-4 divide-y divide-[var(--border-subtle)]">
          {invites.length === 0 ? (
            <p className="py-3 font-ui text-sm italic text-[var(--text-muted)]">
              No codes yet.
            </p>
          ) : (
            invites.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-data text-sm tracking-widest text-[var(--accent-amber)]">
                    {c.code}
                  </span>
                  <span
                    className={`font-ui text-[10px] uppercase tracking-wider ${
                      c.used_by ? "text-[var(--text-muted)]" : "text-[var(--accent-green)]"
                    }`}
                  >
                    {c.used_by ? "redeemed" : "open"}
                  </span>
                </div>
                <div className="font-ui text-[11px] text-[var(--text-muted)]">
                  {c.used_at
                    ? `used ${relativeTime(c.used_at)}`
                    : `created ${relativeTime(c.created_at)}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="card border-[var(--accent-red)]/40 p-4 font-ui text-sm text-[var(--accent-red)]">
          {error}
        </div>
      )}

      <div className="card p-5">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--accent-red)]">
          Danger zone
        </div>
        <p className="mt-2 font-ui text-sm text-[var(--text-secondary)]">
          Deleting your account is permanent — your watchlist, notes, and
          invite codes are removed.
        </p>
        <button
          type="button"
          onClick={destroy}
          className="mt-3 rounded border border-[var(--accent-red)]/50 px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
