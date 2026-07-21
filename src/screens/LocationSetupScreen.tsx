import { Redirect, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type LocationSetupScreenProps = {
  /** @deprecated geo onboarding removed — screen is a stub/redirect only */
  isOnboarding?: boolean;
};

/** Legacy ZIP/radius screen — VTuber catalog is global; settings link redirects home. */
export function LocationSetupScreen({
  isOnboarding = false,
}: LocationSetupScreenProps): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  if (isOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location settings retired</Text>
      <Text style={styles.body}>
        This marketplace is global — listings are no longer filtered by ZIP or radius. Your feed uses
        category, license, and asset filters instead.
      </Text>
      <Pressable style={styles.btn} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.btnText}>Back to catalog</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  body: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
}));
