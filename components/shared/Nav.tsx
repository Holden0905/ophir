"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/(auth)/actions";

const ITEMS = [
  { href: "/dashboard", label: "Regime" },
  { href: "/matrix", label: "Matrix" },
  { href: "/trading", label: "Trading" },
  { href: "/discovery", label: "Discovery" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-editorial text-2xl tracking-tight text-[var(--accent-amber)]"
          >
            Ophir
          </Link>
          <nav className="flex items-center gap-1">
            {ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 font-ui text-sm transition-colors ${
                    active
                      ? "text-[var(--accent-amber)] amber-glow-soft"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {email && (
            <span className="hidden font-ui text-xs text-[var(--text-muted)] md:inline">
              {email}
            </span>
          )}
          <form action={signout}>
            <button
              type="submit"
              className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
