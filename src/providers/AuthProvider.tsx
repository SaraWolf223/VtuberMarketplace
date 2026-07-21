import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  fetchUserPrefs,
  hydratePrefsStore,
  hydratePrefsLocation,
} from '@/features/profile/prefs-service';
import { geocodeZip } from '@/features/profile/geocode-zip';
import { queryKeys } from '@/lib/query-keys';
import { normalizeUsStateCode } from '@/lib/us-state';
import { syncProfileFromAuthUser } from '@/features/auth/syncProfileFromAuthUser';
import { disablePushNotifications } from '@/features/notifications/push-notifications';
import { setAnalyticsDistinctId } from '@/lib/analytics';
import {
  getCachedHomeZip,
  usePrefsStore,
  waitForPrefsStoreHydration,
} from '@/stores/prefs-store';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  hasLocationPrefs: boolean;
  markLocationPrefsSaved: () => void;
  refreshProfileMeta: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_BOOTSTRAP_MS = 10_000;
const AUTH_LOADING_MAX_MS = 12_000;

async function getSessionWithTimeout(): Promise<Session | null> {
  const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session);
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), SESSION_BOOTSTRAP_MS);
  });
  return (await Promise.race([sessionPromise, timeoutPromise])) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocationPrefs, setHasLocationPrefs] = useState(false);

  const hydrateLocationPrefs = useCallback(
    async (userId: string, accessToken: string): Promise<boolean> => {
      await waitForPrefsStoreHydration();
      const cachedZip = getCachedHomeZip();

      try {
        const prefs = await fetchUserPrefs(userId, accessToken);
        if (prefs?.home_zip?.replace(/\D/g, '').slice(0, 5).length === 5) {
          hydratePrefsStore(prefs);
          setHasLocationPrefs(true);
          try {
            const geo = await geocodeZip(prefs.home_zip, accessToken);
            hydratePrefsLocation(geo.lat, geo.lng);
            const state = normalizeUsStateCode(geo.state);
            if (state) {
              usePrefsStore.getState().setHomeState(state);
            }
          } catch {
            /* feed can geocode on demand */
          }
          return true;
        }
      } catch {
        /* fall through to cached zip */
      }

      if (cachedZip.length === 5) {
        setHasLocationPrefs(true);
        return true;
      }

      setHasLocationPrefs(false);
      return false;
    },
    []
  );

  const enrichSession = useCallback(
    async (nextSession: Session) => {
      await syncProfileFromAuthUser(nextSession.user).catch(() => {
        /* profile row optional for prefs */
      });
      await hydrateLocationPrefs(nextSession.user.id, nextSession.access_token);
    },
    [hydrateLocationPrefs]
  );

  // If prefs rehydrate after the first hydrate pass, pick up cached ZIP.
  useEffect(() => {
    if (hasLocationPrefs || !session?.user?.id) return;

    const unsub = usePrefsStore.subscribe((state) => {
      const zip = state.homeZip.replace(/\D/g, '').slice(0, 5);
      if (zip.length === 5) {
        setHasLocationPrefs(true);
      }
    });

    const zip = getCachedHomeZip();
    if (zip.length === 5) {
      setHasLocationPrefs(true);
    }

    return unsub;
  }, [hasLocationPrefs, session?.user?.id]);

  useEffect(() => {
    setAnalyticsDistinctId(session?.user?.id);
  }, [session?.user?.id]);

  const markLocationPrefsSaved = useCallback(() => {
    setHasLocationPrefs(true);
  }, []);

  const refreshProfileMeta = useCallback(async (): Promise<boolean> => {
    const userId = session?.user?.id;
    const token = session?.access_token;
    if (!userId || !token) return false;
    const has = await hydrateLocationPrefs(userId, token);
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    return has;
  }, [session?.user?.id, session?.access_token, hydrateLocationPrefs, queryClient]);

  const applySession = useCallback(
    (nextSession: Session | null, enrich: boolean) => {
      setSession(nextSession);

      if (!nextSession?.user?.id || !nextSession.access_token) {
        setHasLocationPrefs(false);
        return;
      }

      if (enrich) {
        void enrichSession(nextSession);
      }
    },
    [enrichSession]
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await waitForPrefsStoreHydration();
        const initialSession = await getSessionWithTimeout();
        if (!mounted) return;
        applySession(initialSession, !!initialSession);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void bootstrap();

    const loadingCap = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, AUTH_LOADING_MAX_MS);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Never await Supabase calls here — it deadlocks exchangeCodeForSession after OAuth.
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setHasLocationPrefs(false);
        queryClient.clear();
        return;
      }

      if (
        nextSession?.user?.id &&
        nextSession.access_token &&
        (event === 'SIGNED_IN' ||
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED')
      ) {
        const shouldEnrich = event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
        applySession(nextSession, shouldEnrich);
        if (shouldEnrich) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.session });
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingCap);
      subscription.subscription.unsubscribe();
    };
  }, [applySession, queryClient]);

  const signOut = useCallback(async () => {
    // Best-effort: stop this device from receiving push for the outgoing user
    // before the session (and the auth needed to call the RPC) goes away.
    // Never let this block/fail sign-out itself.
    try {
      await disablePushNotifications();
    } catch {
      /* not fatal — worst case this device keeps a stale token until overwritten */
    }

    setSession(null);
    setHasLocationPrefs(false);
    queryClient.clear();

    // `scope: 'local'` signs out only this device/session (still revokes this
    // session's refresh token server-side) — a `signOut()` button shouldn't
    // sign the user out of every other device, so this is intentional, not global.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isSignedIn: !!session,
      hasLocationPrefs,
      markLocationPrefsSaved,
      refreshProfileMeta,
      signOut,
    }),
    [session, isLoading, hasLocationPrefs, markLocationPrefsSaved, refreshProfileMeta, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
