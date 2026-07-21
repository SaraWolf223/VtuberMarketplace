/**
 * Constant-time string equality to avoid timing side-channels when comparing
 * secrets / hashes (e.g. CRON_SECRET, OTP hashes). Iterates the full length
 * regardless of where the first difference is, and folds the length difference
 * into the result so a length mismatch does not short-circuit.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}
