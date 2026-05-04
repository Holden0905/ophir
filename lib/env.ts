import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseAnon = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabaseSecret = required("SUPABASE_SERVICE_ROLE_KEY");

// Guardrail: the new-format Supabase keys are easy to swap by mistake.
// A `sb_secret_*` value in the public anon slot leaks the service-role key
// to every browser; a `sb_publishable_*` in the service-role slot can't bypass
// RLS and shows up as "permission denied for table ..." errors.
if (supabaseAnon.startsWith("sb_secret_")) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY is a secret key — this would expose the service-role key to the browser. Use the sb_publishable_* key here.",
  );
}
if (supabaseSecret.startsWith("sb_publishable_")) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is a publishable key — RLS-bypassing writes will fail. Use the sb_secret_* key here.",
  );
}

export const env = {
  SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: supabaseAnon,
  SUPABASE_SERVICE_ROLE_KEY: supabaseSecret,
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  ALPHA_VANTAGE_KEY: required("ALPHA_VANTAGE_KEY"),
  FMP_API_KEY: required("FMP_API_KEY"),
};
