type StripeSheetResult = { error?: { code?: string; message: string } };

const webStripeError = (): StripeSheetResult => ({
  error: {
    code: 'Failed',
    message: 'In-app payments are not available on web yet. Use the Android app for boosts and premium.',
  },
});

/** Web stub — keeps screens bundling without @stripe/stripe-react-native. */
export function useStripe() {
  return {
    initPaymentSheet: async () => webStripeError(),
    presentPaymentSheet: async () => webStripeError(),
  };
}
