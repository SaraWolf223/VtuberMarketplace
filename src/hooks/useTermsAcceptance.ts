import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { needsTermsAcceptance } from '@/lib/legal-acceptance';

export function useTermsAcceptance(): {
  isLoading: boolean;
  needsAcceptance: boolean;
} {
  const { isSignedIn, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isLoading = authLoading || (isSignedIn && profileLoading);

  return {
    isLoading,
    needsAcceptance: isSignedIn && needsTermsAcceptance(profile),
  };
}
