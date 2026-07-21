import { Platform } from 'react-native';

export const IOS_PAID_MONETIZATION_DISABLED_TITLE = 'Purchases unavailable on iOS';

export const IOS_PAID_MONETIZATION_DISABLED_MESSAGE =
  'Paid boosts and Premium subscriptions are disabled on iOS until Apple In-App Purchase is implemented. Free marketplace features remain available.';

export function canUseStripePaidMonetization(): boolean {
  return Platform.OS !== 'ios';
}
