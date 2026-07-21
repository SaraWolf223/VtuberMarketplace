import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  compact?: boolean;
};

export function FoundingSellerBadge({ compact }: Props): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={[styles.badge, compact && styles.compact]}>
      <Text style={[styles.text, compact && styles.textCompact]}>FOUNDING SELLER</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    badge: {
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    compact: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    text: {
      color: '#1a1a1a',
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.4,
    },
    textCompact: {
      fontSize: 8,
    },
  })
);
