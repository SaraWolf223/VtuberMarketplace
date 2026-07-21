import { useAuthContext } from '@/providers/AuthProvider';

export function useAuth() {
  const { isLoading, isSignedIn, user, session, hasLocationPrefs, signOut } = useAuthContext();
  return {
    isLoading,
    isSignedIn,
    user,
    session,
    hasLocationPrefs,
    signOut,
  };
}
