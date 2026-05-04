import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

// Brief specifies "claude-sonnet-4-20250514" (an older snapshot).
// We use the latest 4.x Sonnet for better narrative quality.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
