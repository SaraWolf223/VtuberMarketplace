import { View, StyleSheet, Platform } from 'react-native';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';

/** Logo strip on web sign-in / onboarding (before WebTopBar appears). */
export function WebAuthHeader(): React.JSX.Element | null {
  const styles = useStyles();

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.root} testID="web-auth-header">
      <WebAppLogo />
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
  })
);
