import { View, StyleSheet, Platform } from 'react-native';
import { FeedGoogleVideoAd } from '@/components/ads/FeedGoogleVideoAd';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';

type Props = {
  slotPrefix?: string;
};

/** Google ad slot for secondary screens (e.g. Post Ad). */
export function PageFooterAds({ slotPrefix = 'page' }: Props): React.JSX.Element | null {
  const styles = useStyles();

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <FeedGoogleVideoAd slotKey={`${slotPrefix}-google`} placement="page" />
    </View>
  );
}

const useStyles = createThemedStyles(() =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
  })
);
