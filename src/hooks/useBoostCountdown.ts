import { useEffect, useState } from 'react';
import { formatBoostCountdown, isBoostActive } from '@/utils/boost-countdown';

/** Live-updating boost countdown label (e.g. "23h 15m left"). */
export function useBoostCountdown(boostedUntil: string | null | undefined): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isBoostActive(boostedUntil)) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [boostedUntil]);

  return formatBoostCountdown(boostedUntil, now);
}
