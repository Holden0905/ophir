import type { SetupType, SignalState } from "@/lib/supabase/types";
import { SETUP_SHORT } from "@/lib/signals/labels";

interface Props {
  setup: SetupType;
  state: SignalState;
  size?: "sm" | "md";
}

/**
 * Small TC / RR badge. Three visual states:
 *   - filled amber + ✦ marker for `triggered_today` (loud, "stop and look")
 *   - outlined for `qualifies` (calm)
 *   - nothing rendered for `none` (caller should not render this badge)
 */
export function SignalBadge({ setup, state, size = "md" }: Props) {
  if (state === "none") return null;
  const label = SETUP_SHORT[setup];

  const dims =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-xs";

  if (state === "triggered_today") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-data font-medium tracking-wider text-black ${dims}`}
        style={{ background: "var(--accent-amber)" }}
      >
        {label}
        <span aria-hidden>✦</span>
      </span>
    );
  }

  // qualifies
  return (
    <span
      className={`inline-flex items-center rounded border font-data font-medium tracking-wider ${dims}`}
      style={{
        borderColor: "var(--accent-amber-dim)",
        color: "var(--accent-amber)",
      }}
    >
      {label}
    </span>
  );
}
