import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@/lib/stripe/use-stripe-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import {
  createBoostCheckout,
  applyBoost,
  applyBoostWithCredit,
  applyBoostWithFoundingCredit,
  applyBoostWithPromo,
  isBoostCheckoutCredit,
  isBoostCheckoutFounding,
  isBoostCheckoutPromo,
} from '@/features/monetization/boost-service';
import {
  canUseStripePaidMonetization,
  IOS_PAID_MONETIZATION_DISABLED_MESSAGE,
  IOS_PAID_MONETIZATION_DISABLED_TITLE,
} from '@/features/monetization/platform-payments';
import { invalidateFeedQueries } from '@/features/profile/prefs-service';
import { queryKeys } from '@/lib/query-keys';
import { formatUsdFromCents } from '@/constants/stripe-fees';
import { useAppConfigStore } from '@/stores/app-config-store';

export type BoostMode = 'free' | 'founding' | 'promo' | 'paid';

export function useBoostListing() {
  const { session, user } = useAuth();
  const { requireVerification } = usePhoneVerificationGate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const [boostingId, setBoostingId] = useState<string | null>(null);

  const boostListing = useCallback(
    async (listingId: string, listingTitle: string, mode: BoostMode = 'paid') => {
      const token = session?.access_token;
      if (!token || !user?.id) {
        Alert.alert('Sign in', 'Sign in to boost a listing.');
        return;
      }

      if (!requireVerification('Boosting a listing')) {
        return;
      }

      setBoostingId(listingId);
      try {
        if (mode === 'free') {
          await applyBoostWithCredit(token, listingId);
          invalidateFeedQueries(queryClient, user.id);
          queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

          Alert.alert(
            'Boosted!',
            `"${listingTitle}" is boosted for 24 hours using a Premium free boost. Listings expiring within a week also get 14 more days in the feed.`
          );
          return;
        }

        if (mode === 'founding') {
          await applyBoostWithFoundingCredit(token, listingId);
          invalidateFeedQueries(queryClient, user.id);
          queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

          Alert.alert(
            'Boosted!',
            `"${listingTitle}" is boosted for 24 hours using a Founding Seller free boost.`
          );
          return;
        }

        if (mode === 'promo') {
          await applyBoostWithPromo(token, listingId);
          invalidateFeedQueries(queryClient, user.id);
          queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

          Alert.alert(
            'Boosted!',
            `"${listingTitle}" is boosted for 24 hours using a promo boost credit.`
          );
          return;
        }

        if (!canUseStripePaidMonetization()) {
          Alert.alert(IOS_PAID_MONETIZATION_DISABLED_TITLE, IOS_PAID_MONETIZATION_DISABLED_MESSAGE);
          return;
        }

        const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
        if (!publishableKey || publishableKey.includes('pk_test_...')) {
          Alert.alert(
            'Stripe not configured',
            'Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env and set STRIPE_SECRET_KEY on Supabase.'
          );
          return;
        }

        const checkout = await createBoostCheckout(token, listingId, { forcePaid: true });
        if (isBoostCheckoutCredit(checkout)) {
          throw new Error('Unexpected free boost response for paid boost');
        }
        if (isBoostCheckoutPromo(checkout)) {
          throw new Error('Unexpected promo boost response for paid boost');
        }
        if (isBoostCheckoutFounding(checkout)) {
          throw new Error('Unexpected founding boost response for paid boost');
        }

        const payConfirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm payment',
            `Boost: ${formatUsdFromCents(checkout.base_amount_cents)}\n` +
              `Card processing: ${formatUsdFromCents(checkout.processing_fee_cents)}\n` +
              `Total: ${formatUsdFromCents(checkout.amount_cents)}\n\n` +
              `The processing fee covers Stripe — ${appDisplayName} does not keep it.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Pay now', onPress: () => resolve(true) },
            ]
          );
        });
        if (!payConfirmed) return;

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: appDisplayName,
          paymentIntentClientSecret: checkout.payment_intent_client_secret,
          customerId: checkout.customer_id,
          customerEphemeralKeySecret: checkout.ephemeral_key,
          allowsDelayedPaymentMethods: false,
        });

        if (initError) {
          throw new Error(initError.message);
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') return;
          throw new Error(presentError.message);
        }

        await applyBoost(token, listingId, checkout.payment_intent_id);

        invalidateFeedQueries(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ['my-listings'] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

        Alert.alert(
          'Boosted!',
          `"${listingTitle}" is boosted for 24 hours and ranks higher in the feed. Listings expiring within a week also get 14 more days active.`
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Boost failed';
        if (message.includes('Native module') || message.includes('StripeProvider')) {
          Alert.alert(
            'Development build required',
            'Stripe PaymentSheet needs a dev build (not Expo Go). Run: npx expo run:android'
          );
        } else {
          Alert.alert('Boost failed', message);
        }
      } finally {
        setBoostingId(null);
      }
    },
    [session?.access_token, user?.id, requireVerification, initPaymentSheet, presentPaymentSheet, queryClient, appDisplayName]
  );

  return { boostListing, boostingId, isBoosting: boostingId !== null };
}
