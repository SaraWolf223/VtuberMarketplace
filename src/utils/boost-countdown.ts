/** Remaining boost time label, or null if not boosted. */
export function formatBoostCountdown(
  boostedUntil: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!boostedUntil) return null;

  const ms = new Date(boostedUntil).getTime() - nowMs;
  if (ms <= 0) return null;

  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const mins = Math.floor((totalSec % 3_600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

export function isBoostActive(
  boostedUntil: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!boostedUntil) return false;
  return new Date(boostedUntil).getTime() > nowMs;
}
