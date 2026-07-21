import { BUILD_APP_IDENTITY } from '@/config/app-identity';

/** Must match app.config `scheme` and Stripe Checkout success/cancel URLs. */
export const PREMIUM_CHECKOUT_REDIRECT = `${BUILD_APP_IDENTITY.appScheme}://settings/premium`;
