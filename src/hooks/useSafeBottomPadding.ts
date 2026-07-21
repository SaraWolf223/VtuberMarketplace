import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme/tokens';

/**
 * Bottom padding for content pinned to the screen edge (bottom sheets, action
 * bars). Under Android edge-to-edge (targetSdk 35) and the iOS home indicator,
 * content draws behind the system navigation bar, so pinned controls must add
 * the bottom safe-area inset or they get covered. Falls back to `base` when
 * there is no inset (e.g. web, devices without a software nav bar).
 */
export function useSafeBottomPadding(base: number = spacing.lg): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + base;
}
