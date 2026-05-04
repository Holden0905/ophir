"use client";

import { useEffect, useState } from "react";

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !("MSStream" in window),
    );
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches,
    );
    setDismissed(localStorage.getItem("ophir.installPromptDismissed") === "1");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (isStandalone || dismissed || !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-md card-elevated p-4 amber-glow-soft">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--accent-amber)]">
        Install Ophir
      </div>
      <p className="mt-2 font-ui text-sm text-[var(--text-secondary)]">
        Tap the share button and choose &ldquo;Add to Home Screen&rdquo; to use
        Ophir as a native app.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("ophir.installPromptDismissed", "1");
          setDismissed(true);
        }}
        className="mt-3 font-ui text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        dismiss
      </button>
    </div>
  );
}
