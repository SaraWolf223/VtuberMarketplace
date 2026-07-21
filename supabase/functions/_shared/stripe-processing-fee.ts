/** US card estimate (2.9% + $0.30) — gross up so the platform nets `baseCents`. */
export const STRIPE_US_PERCENT = 0.029;
export const STRIPE_US_FIXED_CENTS = 30;

export type StripeChargeBreakdown = {
  base_cents: number;
  processing_fee_cents: number;
  total_cents: number;
};

export function grossUpForStripeFees(baseCents: number): StripeChargeBreakdown {
  const total_cents = Math.ceil(
    (baseCents + STRIPE_US_FIXED_CENTS) / (1 - STRIPE_US_PERCENT)
  );
  return {
    base_cents: baseCents,
    processing_fee_cents: total_cents - baseCents,
    total_cents,
  };
}
