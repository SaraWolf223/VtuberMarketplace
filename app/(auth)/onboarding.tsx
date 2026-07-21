import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_DESKTOP_CHROME_BG } from '@/constants/web-page-layout';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'pricetag-outline', label: 'Pre-made VTuber assets from independent sellers.' },
  { icon: 'cloud-download-outline', label: 'Instant digital delivery via seller-hosted download links.' },
  { icon: 'shield-checkmark-outline', label: 'Secure checkout with Stripe — license terms shown before you buy.' },
];

export default function OnboardingScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isDesktopWeb } = useWebViewport();
  const desktop = Platform.OS === 'web' && isDesktopWeb;
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);

  return (
    <View style={[styles.screen, desktop && styles.screenDesktop]}>
      <View style={[styles.container, desktop && styles.containerDesktop]}>
        {Platform.OS === 'web' ? (
          <View style={styles.logoWrap}>
            <WebAppLogo prominent />
          </View>
        ) : (
          <Text style={styles.title}>{appDisplayName}</Text>
        )}
        <View style={styles.points}>
          {POINTS.map((point) => (
            <View key={point.label} style={styles.point}>
              <Ionicons name={point.icon} size={22} color={colors.primary} />
              <Text style={styles.slide}>{point.label}</Text>
            </View>
          ))}
        </View>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screenDesktop: {
      backgroundColor: WEB_DESKTOP_CHROME_BG,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    containerDesktop: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      alignSelf: 'center',
      width: '100%',
      maxWidth: 460,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.10)' } as object)
        : {}),
    },
    logoWrap: {
      alignItems: 'flex-start',
    },
    title: {
      fontSize: fontSize.hero,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    points: {
      gap: spacing.md,
    },
    point: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    slide: {
      flex: 1,
      fontSize: fontSize.body,
      color: colors.textSecondary,
    },
    button: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
    },
  })
);
