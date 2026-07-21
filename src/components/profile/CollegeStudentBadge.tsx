import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export function CollegeStudentBadge(): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>College student</Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  text: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
}));
