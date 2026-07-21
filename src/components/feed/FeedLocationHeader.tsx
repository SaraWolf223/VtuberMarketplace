import { Text, StyleSheet } from 'react-native';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

/** Global catalog header — no location/ZIP/radius. */
export function FeedLocationHeader(): React.JSX.Element {
  const styles = useStyles();

  return (
    <Text style={styles.text} accessibilityRole="header">
      Browse assets
    </Text>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  text: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
}));
