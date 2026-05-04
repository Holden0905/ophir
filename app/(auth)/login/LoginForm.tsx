"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signInWithMagicLink, type AuthState } from "../actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "password" ? login : signInWithMagicLink,
    null,
  );

  return (
    <div className="card p-7">
      <h1 className="font-ui text-lg text-[var(--text-primary)]">Sign in</h1>
      <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
        Welcome back.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded bg-[var(--bg-elevated)] p-1 text-xs font-ui">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded px-3 py-1.5 transition-colors ${
            mode === "password"
              ? "bg-[var(--bg-card)] text-[var(--accent-amber)] amber-glow-soft"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`rounded px-3 py-1.5 transition-colors ${
            mode === "magic"
              ? "bg-[var(--bg-card)] text-[var(--accent-amber)] amber-glow-soft"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Magic link
        </button>
      </div>

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

        {mode === "password" && (
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
              autoComplete="current-password"
              required
              className="mt-1 w-full px-3 py-2 font-ui text-sm"
            />
          </div>
        )}

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
          className="w-full rounded bg-[var(--accent-amber)] px-3 py-2.5 font-ui text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Working…"
            : mode === "password"
              ? "Sign in"
              : "Send magic link"}
        </button>
      </form>

      <p className="mt-5 font-ui text-xs text-[var(--text-secondary)]">
        New here?{" "}
        <Link
          href="/signup"
          className="text-[var(--accent-amber)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
