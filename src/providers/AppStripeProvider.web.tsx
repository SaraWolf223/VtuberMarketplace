import type { ReactNode } from 'react';

/** Stripe PaymentSheet is native-only; web uses the same screens without in-app payments for now. */
export function AppStripeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  return <>{children}</>;
}