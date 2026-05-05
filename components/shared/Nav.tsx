"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/(auth)/actions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Inline SVGs keep the bundle small and avoid pulling in an icon library
// just for five glyphs. All use stroke="currentColor" so they pick up text
// color on hover/active.
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const RegimeIcon = () => (
  <svg {...ICON_PROPS} aria-hidden>
    <path d="M3 17l4-6 4 4 4-8 6 10" />
  </svg>
);
const MatrixIcon = () => (
  <svg {...ICON_PROPS} aria-hidden>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
  </svg>
);
const TradingIcon = () => (
  <svg {...ICON_PROPS} aria-hidden>
    <path d="M13 3l-5 9h4l-1 9 6-10h-4l1-8z" />
  </svg>
);
const DiscoveryIcon = () => (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);
const GearIcon = () => (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Regime", icon: <RegimeIcon /> },
  { href: "/matrix", label: "Matrix", icon: <MatrixIcon /> },
  { href: "/trading", label: "Trading", icon: <TradingIcon /> },
  { href: "/discovery", label: "Discovery", icon: <DiscoveryIcon /> },
];

export function Nav({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-editorial text-2xl tracking-tight text-[var(--accent-amber)]"
            >
              Ophir
            </Link>
            {/* Primary tabs — desktop only. Mobile uses the bottom tab bar. */}
            <nav className="hidden items-center gap-1 md:flex">
              {PRIMARY.map((item) => {
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

          <div className="flex items-center gap-3 md:gap-4">
            {email && (
              <span className="hidden font-ui text-xs text-[var(--text-muted)] md:inline">
                {email}
              </span>
            )}
            <Link
              href="/settings"
              aria-label="Settings"
              className={`rounded p-1.5 transition-colors ${
                pathname.startsWith("/settings")
                  ? "text-[var(--accent-amber)] amber-glow-soft"
                  : "text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
              }`}
            >
              <GearIcon />
            </Link>
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

      {/* Bottom tab bar — mobile only. Sits above the body grain overlay,
          beneath modal-level content (z-30). The layout adds bottom padding
          on mobile so page content doesn't hide behind it. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[var(--border)] bg-[var(--bg-primary)]/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur md:hidden"
        aria-label="Primary"
      >
        {PRIMARY.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 pt-2 pb-1 font-ui text-[10px] uppercase tracking-wider transition-colors ${
                active
                  ? "text-[var(--accent-amber)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
