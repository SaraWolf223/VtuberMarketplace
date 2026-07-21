import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { isEmailVerified } from '@/hooks/useEmailVerification';
import { resendSignupConfirmationEmail } from '@/lib/auth/email-auth';
import { showAlert } from '@/lib/cross-platform-alert';

/**
 * Prompts users without a confirmed email before gated actions such as sending DMs.
 */
export function useEmailVerificationGate() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const verified = isEmailVerified(user, profile);

  const requireVerification = useCallback(
    (actionLabel: string, onVerified?: () => void): boolean => {
      if (verified) {
        onVerified?.();
        return true;
      }

      const email = user?.email?.trim();
      showAlert(
        'Verify your email',
        `${actionLabel} requires a verified email address. Check your inbox for the confirmation link.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: email ? 'Resend email' : 'Open settings',
            onPress: () => {
              if (!email) {
                router.push('/settings');
                return;
              }
              void resendSignupConfirmationEmail(email)
                .then(() => {
                  showAlert('Check your inbox', 'We sent a new confirmation link.');
                })
                .catch((e) => {
                  showAlert(
                    'Could not resend',
                    e instanceof Error ? e.message : 'Try again from Settings.'
                  );
                });
            },
          },
        ]
      );
      return false;
    },
    [verified, router, user?.email]
  );

  return { verified, profile, user, requireVerification };
}
