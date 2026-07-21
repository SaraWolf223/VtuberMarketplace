/** Stripe boosts and Premium. Android/web use Stripe; iOS paid features stay disabled until IAP exists. */
export const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
