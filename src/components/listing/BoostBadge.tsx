import { View, Text, StyleSheet } from 'react-native';
import { useBoostCountdown } from '@/hooks/useBoostCountdown';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  boostedUntil: string | null | undefined;
  accentColor?: string;
};

export function BoostBadge({ boostedUntil, accentColor }: Props): React.JSX.Element | null {
  const styles = useStyles();
  const countdown = useBoostCountdown(boostedUntil);
  if (!countdown) return null;

  const badgeStyle = accentColor ? { backgroundColor: accentColor } : null;

  return (
    <View style={[styles.badge, badgeStyle]}>
      <Text style={styles.title}>BOOSTED</Text>
      <Text style={styles.timer}>{countdown}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  badge: {
    backgroundColor: colors.boost,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    gap: 1,
  },
  title: {
    color: colors.onPrimary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  timer: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
}));
