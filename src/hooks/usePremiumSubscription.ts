import { useRef, useState, useCallback } from 'react';
import { Alert, InteractionManager } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import { PREMIUM_CHECKOUT_REDIRECT } from '@/constants/stripe';
import {
  canUseStripePaidMonetization,
  IOS_PAID_MONETIZATION_DISABLED_MESSAGE,
  IOS_PAID_MONETIZATION_DISABLED_TITLE,
} from '@/features/monetization/platform-payments';
import { createPremiumCheckout } from '@/features/monetization/premium-service';
import { syncPremiumAccount } from '@/features/monetization/seller-benefits-service';
import { queryKeys } from '@/lib/query-keys';

function waitForUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
  });
}

async function refreshPremiumQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(userId) });
  await queryClient.refetchQueries({ queryKey: queryKeys.sellerBenefits(userId) });
}

async function activateAfterCheckout(
  token: string,
  sessionId: string,
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const synced = await syncPremiumAccount(token, sessionId);
    if (synced.premium_active) {
      await refreshPremiumQueries(queryClient, userId);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export function usePremiumSubscription() {
  const { session, user } = useAuth();
  const { requireVerification } = usePhoneVerificationGate();
  const queryClient = useQueryClient();
  const [subscribing, setSubscribing] = useState(false);
  const inFlightRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (inFlightRef.current) return;

    const token = session?.access_token;
    if (!user?.id || !token) {
      Alert.alert('Sign in', 'Sign in to subscribe to Premium.');
      return;
    }

    if (!requireVerification('Premium subscription')) {
      return;
    }

    if (!canUseStripePaidMonetization()) {
      Alert.alert(IOS_PAID_MONETIZATION_DISABLED_TITLE, IOS_PAID_MONETIZATION_DISABLED_MESSAGE);
      return;
    }

    const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
    if (!publishableKey || publishableKey.includes('pk_test_...')) {
      Alert.alert('Stripe not configured', 'Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.');
      return;
    }

    inFlightRef.current = true;
    setSubscribing(true);

    try {
      await waitForUi();

      const existing = await syncPremiumAccount(token);
      if (existing.premium_active) {
        await refreshPremiumQueries(queryClient, user.id);
        Alert.alert('Already Premium', 'Your Premium subscription is already active.');
        return;
      }

      const checkout = await createPremiumCheckout(token);

      await WebBrowser.openAuthSessionAsync(checkout.checkout_url, PREMIUM_CHECKOUT_REDIRECT);

      const activated = await activateAfterCheckout(
        token,
        checkout.session_id,
        queryClient,
        user.id
      );

      if (activated) {
        Alert.alert(
          'Welcome to Premium!',
          `You're all set — ${PREMIUM_FREE_BOOSTS_PER_MONTH} free boosts this month and Premium badge are active.`
        );
      } else {
        Alert.alert(
          'Payment received?',
          'If you finished checkout, wait a moment and pull to refresh this screen. Premium activates right after payment.'
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Subscription failed';
      if (message.includes('ALREADY_PREMIUM')) {
        await refreshPremiumQueries(queryClient, user.id);
        Alert.alert('Already Premium', 'Your Premium subscription is already active.');
      } else {
        Alert.alert('Premium', message);
      }
    } finally {
      inFlightRef.current = false;
      setSubscribing(false);
    }
  }, [session?.access_token, user?.id, requireVerification, queryClient]);

  const syncFromStripe = useCallback(async () => {
    const token = session?.access_token;
    if (!token || !user?.id) return false;

    const synced = await syncPremiumAccount(token);
    await refreshPremiumQueries(queryClient, user.id);
    return synced.premium_active;
  }, [session?.access_token, user?.id, queryClient]);

  return { subscribe, subscribing, syncFromStripe };
}
