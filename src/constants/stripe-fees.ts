/** Matches `supabase/functions/_shared/stripe-processing-fee.ts` for UI copy. */
export const STRIPE_US_PERCENT = 0.029;
export const STRIPE_US_FIXED_CENTS = 30;

export const BOOST_BASE_CENTS = 100;
export const PREMIUM_BASE_CENTS = 500;

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

export const BOOST_CHECKOUT = grossUpForStripeFees(BOOST_BASE_CENTS);
export const PREMIUM_CHECKOUT = grossUpForStripeFees(PREMIUM_BASE_CENTS);
