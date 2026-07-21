/** Normalize Mapbox / user input to a two-letter US state code. */
export function normalizeUsStateCode(state: string | null | undefined): string | null {
  if (!state) return null;
  const code = state.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}
