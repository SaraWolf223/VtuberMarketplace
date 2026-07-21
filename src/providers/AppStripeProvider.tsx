import type { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

/** Stripe SDK requires a provider even when boosts are unused; use env key in production. */
const publishableKey =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || 'pk_test_NotConfigured';

export function AppStripeProvider({
  children,
}: {
  children: ReactElement | ReactElement[];
}): React.JSX.Element {
  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier={BUILD_APP_IDENTITY.iosMerchantIdentifier}
      urlScheme={BUILD_APP_IDENTITY.appScheme}
    >
      {children}
    </StripeProvider>
  );
}
