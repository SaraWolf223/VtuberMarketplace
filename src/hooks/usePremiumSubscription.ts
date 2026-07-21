import { useRef, useState, useCallback } from 'react';
import { Alert, InteractionManager } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import { PRO_SELLER_FEATURED_CREDITS_PER_MONTH } from '@/constants/pro-seller';
import { PREMIUM_CHECKOUT_REDIRECT } from '@/constants/stripe';
import {
  canUseStripePaidMonetization,
  IOS_PAID_MONETIZATION_DISABLED_MESSAGE,
  IOS_PAID_MONETIZATION_DISABLED_TITLE,
} from '@/features/monetization/platform-payments';
import {
  createProSellerCheckout,
  syncProSellerAccount,
} from '@/features/monetization/pro-seller-service';
import { queryKeys } from '@/lib/query-keys';

function waitForUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
  });
}

async function refreshProSellerQueries(
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
    const synced = await syncProSellerAccount(token, sessionId);
    if (synced.pro_seller_active || synced.premium_active) {
      await refreshProSellerQueries(queryClient, userId);
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
      Alert.alert('Sign in', 'Sign in to subscribe to Pro Seller.');
      return;
    }

    if (!requireVerification('Pro Seller subscription')) {
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

      const existing = await syncProSellerAccount(token);
      if (existing.pro_seller_active || existing.premium_active) {
        await refreshProSellerQueries(queryClient, user.id);
        Alert.alert('Already Pro Seller', 'Your Pro Seller subscription is already active.');
        return;
      }

      const checkout = await createProSellerCheckout(token);

      await WebBrowser.openAuthSessionAsync(checkout.checkout_url, PREMIUM_CHECKOUT_REDIRECT);

      const activated = await activateAfterCheckout(
        token,
        checkout.session_id,
        queryClient,
        user.id
      );

      if (activated) {
        Alert.alert(
          'Welcome to Pro Seller!',
          `You're all set — ${PRO_SELLER_FEATURED_CREDITS_PER_MONTH} Featured credits this month and the 8% fee tier are active.`
        );
      } else {
        Alert.alert(
          'Payment received?',
          'If you finished checkout, wait a moment and pull to refresh this screen. Pro Seller activates right after payment.'
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Subscription failed';
      if (message.includes('ALREADY_PRO_SELLER') || message.includes('ALREADY_PREMIUM')) {
        await refreshProSellerQueries(queryClient, user.id);
        Alert.alert('Already Pro Seller', 'Your Pro Seller subscription is already active.');
      } else {
        Alert.alert('Pro Seller', message);
      }
    } finally {
      inFlightRef.current = false;
      setSubscribing(false);
    }
  }, [session?.access_token, user?.id, requireVerification, queryClient]);

  const syncFromStripe = useCallback(async () => {
    const token = session?.access_token;
    if (!token || !user?.id) return false;

    const synced = await syncProSellerAccount(token);
    await refreshProSellerQueries(queryClient, user.id);
    return !!(synced.pro_seller_active || synced.premium_active);
  }, [session?.access_token, user?.id, queryClient]);

  return { subscribe, subscribing, syncFromStripe };
}
