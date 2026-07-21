/** Matches `supabase/functions/_shared/stripe-processing-fee.ts` for UI copy. */
export const STRIPE_US_PERCENT = 0.029;
export const STRIPE_US_FIXED_CENTS = 30;

import {
  FEATURED_PLACEMENT_BASE_CENTS,
  PRO_SELLER_BASE_CENTS,
} from '@/constants/pro-seller';

/** @deprecated use FEATURED_PLACEMENT_BASE_CENTS */
export const BOOST_BASE_CENTS = FEATURED_PLACEMENT_BASE_CENTS;
/** @deprecated use PRO_SELLER_BASE_CENTS */
export const PREMIUM_BASE_CENTS = PRO_SELLER_BASE_CENTS;
export const FEATURED_BASE_CENTS = FEATURED_PLACEMENT_BASE_CENTS;
export const PRO_SELLER_SUBSCRIPTION_BASE_CENTS = PRO_SELLER_BASE_CENTS;

export type ChargeBreakdown = {
  baseCents: number;
  processingFeeCents: number;
  totalCents: number;
};

export function grossUpForStripeFees(baseCents: number): ChargeBreakdown {
  const totalCents = Math.ceil(
    (baseCents + STRIPE_US_FIXED_CENTS) / (1 - STRIPE_US_PERCENT)
  );
  return {
    baseCents,
    processingFeeCents: totalCents - baseCents,
    totalCents,
  };
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const FEATURED_CHECKOUT = grossUpForStripeFees(FEATURED_BASE_CENTS);
export const PRO_SELLER_CHECKOUT = grossUpForStripeFees(PRO_SELLER_SUBSCRIPTION_BASE_CENTS);
/** @deprecated use FEATURED_CHECKOUT */
export const BOOST_CHECKOUT = FEATURED_CHECKOUT;
/** @deprecated use PRO_SELLER_CHECKOUT */
export const PREMIUM_CHECKOUT = PRO_SELLER_CHECKOUT;
