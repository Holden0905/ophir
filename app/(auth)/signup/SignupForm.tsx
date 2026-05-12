"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { signup, type AuthState } from "../actions";

export default function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    null,
  );

  return (
    <div className="card p-7">
      <h1 className="font-ui text-lg text-[var(--text-primary)]">
        Create account
      </h1>
      <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
        Invite-only during private beta.
      </p>

      <form action={action} className="mt-5 space-y-3">
        <div>
          <label
            htmlFor="email"
            className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full px-3 py-2 font-ui text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1 w-full px-3 py-2 font-ui text-sm"
          />
          <p className="mt-1 font-ui text-[10px] text-[var(--text-muted)]">
            Minimum 8 characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="invite_code"
            className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]"
          >
            Invite code (optional)
          </label>
          <input
            id="invite_code"
            name="invite_code"
            type="text"
            autoComplete="off"
            className="mt-1 w-full px-3 py-2 font-data text-sm uppercase tracking-wider"
          />
        </div>

        {state?.error && (
          <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 font-ui text-xs text-[var(--accent-red)]">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 px-3 py-2 font-ui text-xs text-[var(--accent-amber)]">
            {state.success}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={`inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--accent-amber)] px-3 py-2.5 font-ui text-sm font-medium text-black transition-shadow hover:opacity-90 active:scale-[0.98] ${
            pending
              ? "shadow-[0_0_0_2px_var(--accent-amber-dim)] cursor-progress"
              : "disabled:opacity-50"
          }`}
        >
          {pending && <Spinner size={14} className="text-black" />}
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 font-ui text-xs text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[var(--accent-amber)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
