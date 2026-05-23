const SETUP_ERROR_PATTERNS = [
  "PGRST205",
  "Could not find the table",
  "Could not find the function",
  "schema cache",
  "relation",
  "does not exist"
];

export function isSupabaseSetupErrorMessage(message: string | undefined | null) {
  if (!message) {
    return false;
  }

  return SETUP_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function getSupabaseSetupHelpMessage(message?: string | null) {
  if (!isSupabaseSetupErrorMessage(message)) {
    return message ?? "Supabase request failed.";
  }

  return "Your Supabase project is connected but the Vrixo database schema is not installed yet. Run supabase/schema.sql and supabase/seed.sql in the Supabase SQL Editor, then try checkout again.";
}
