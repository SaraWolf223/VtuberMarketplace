/** Strip dev-only Supabase / migration hints from errors shown to end users. */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  if (__DEV__) return raw;

  if (
    raw.includes('Supabase') ||
    raw.includes('Redirect URL') ||
    raw.includes('migration') ||
    raw.includes('db push') ||
    raw.includes('SQL Editor') ||
    raw.includes('accept_platform_terms') ||
    raw.includes('PGRST') ||
    raw.includes('functions deploy')
  ) {
    return fallback;
  }

  return raw.length > 200 ? fallback : raw;
}
