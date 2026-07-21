import { usePrefsStore } from '@/stores/prefs-store';

export function useLocationPrefs() {
  const homeZip = usePrefsStore((s) => s.homeZip);
  const homeLat = usePrefsStore((s) => s.homeLat);
  const homeLng = usePrefsStore((s) => s.homeLng);
  const radiusMiles = usePrefsStore((s) => s.radiusMiles);
  const setHomeZip = usePrefsStore((s) => s.setHomeZip);
  const setHomeLocation = usePrefsStore((s) => s.setHomeLocation);
  const setRadiusMiles = usePrefsStore((s) => s.setRadiusMiles);
  return {
    homeZip,
    homeLat,
    homeLng,
    radiusMiles,
    setHomeZip,
    setHomeLocation,
    setRadiusMiles,
  };
}
