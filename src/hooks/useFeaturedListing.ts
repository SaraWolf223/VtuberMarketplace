import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@/lib/stripe/use-stripe-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import {
  createFeaturedCheckout,
  applyFeaturedPlacement,
  applyFeaturedWithCredit,
  isFeaturedCheckoutCredit,
} from '@/features/monetization/featured-service';
import {
  canUseStripePaidMonetization,
  IOS_PAID_MONETIZATION_DISABLED_MESSAGE,
  IOS_PAID_MONETIZATION_DISABLED_TITLE,
} from '@/features/monetization/platform-payments';
import { invalidateFeedQueries } from '@/features/profile/prefs-service';
import { queryKeys } from '@/lib/query-keys';
import { FEATURED_CHECKOUT, formatUsdFromCents } from '@/constants/stripe-fees';
import { FEATURED_PLACEMENT_DURATION_DAYS } from '@/constants/pro-seller';
import { useAppConfigStore } from '@/stores/app-config-store';

export type FeaturedMode = 'credit' | 'paid';

export function useFeaturedListing() {
  const { session, user } = useAuth();
  const { requireVerification } = usePhoneVerificationGate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const [featuringId, setFeaturingId] = useState<string | null>(null);

  const featureListing = useCallback(
    async (listingId: string, listingTitle: string, mode: FeaturedMode = 'paid') => {
      const token = session?.access_token;
      if (!token || !user?.id) {
        Alert.alert('Sign in', 'Sign in to feature a listing.');
        return;
      }

      if (!requireVerification('Featuring a listing')) {
        return;
      }

      setFeaturingId(listingId);
      try {
        if (mode === 'credit') {
          await applyFeaturedWithCredit(token, listingId);
          invalidateFeedQueries(queryClient, user.id);
          queryClient.invalidateQueries({ queryKey: ['my-listings'] });
          await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

          Alert.alert(
            'Featured!',
            `"${listingTitle}" is featured for ${FEATURED_PLACEMENT_DURATION_DAYS} days using a Pro Seller credit.`
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

        const checkout = await createFeaturedCheckout(token, listingId, { forcePaid: true });
        if (isFeaturedCheckoutCredit(checkout)) {
          throw new Error('Unexpected credit response for paid Featured placement');
        }

        const payConfirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Confirm payment',
            `Featured placement: ${formatUsdFromCents(checkout.base_amount_cents)}\n` +
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

        await applyFeaturedPlacement(token, listingId, checkout.payment_intent_id);

        invalidateFeedQueries(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ['my-listings'] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.sellerBenefits(user.id) });

        const days = checkout.duration_days ?? FEATURED_PLACEMENT_DURATION_DAYS;
        Alert.alert(
          'Featured!',
          `"${listingTitle}" is featured for ${days} days and ranks higher in the catalog.`
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Featured placement failed';
        if (message.includes('Native module') || message.includes('StripeProvider')) {
          Alert.alert(
            'Development build required',
            'Stripe PaymentSheet needs a dev build (not Expo Go). Run: npx expo run:android'
          );
        } else {
          Alert.alert('Featured placement failed', message);
        }
      } finally {
        setFeaturingId(null);
      }
    },
    [session?.access_token, user?.id, requireVerification, initPaymentSheet, presentPaymentSheet, queryClient, appDisplayName]
  );

  return {
    featureListing,
    featuringId,
    isFeaturing: featuringId !== null,
    /** @deprecated */
    boostListing: featureListing,
    boostingId: featuringId,
    isBoosting: featuringId !== null,
  };
}
