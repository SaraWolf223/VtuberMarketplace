import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { isPhoneVerified } from '@/hooks/usePhoneVerification';
import { showAlert } from '@/lib/cross-platform-alert';

/**
 * Prompts unverified users to complete phone OTP before gated actions.
 */
export function usePhoneVerificationGate() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const verified = isPhoneVerified(profile);

  const requireVerification = useCallback(
    (actionLabel: string, onVerified?: () => void): boolean => {
      if (verified) {
        onVerified?.();
        return true;
      }

      showAlert(
        'Verify your phone',
        `${actionLabel} requires a verified phone number.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify phone', onPress: () => router.push('/settings/verify-phone') },
        ]
      );
      return false;
    },
    [verified, router]
  );

  return { verified, profile, requireVerification };
}
