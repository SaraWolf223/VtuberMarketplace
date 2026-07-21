import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

/** Desktop web — global catalog label beside the search bar. */
export function FeedLocationHeader(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();

  return (
    <View style={styles.row} accessibilityRole="header">
      <Ionicons name="globe-outline" size={20} color={colors.text} />
      <Text style={styles.text} numberOfLines={1}>
        Browse assets
      </Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 220,
    },
    text: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
  })
);
