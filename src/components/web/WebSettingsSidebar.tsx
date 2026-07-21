import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  WEB_SETTINGS_NAV,
  WEB_SETTINGS_SIDEBAR_WIDTH,
} from '@/constants/web-page-layout';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function isActive(pathname: string, href: string): boolean {
  if (href === '/settings') {
    return pathname === '/settings' || pathname === '/settings/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop web settings navigation — Marketplace-style left sidebar. */
export function WebSettingsSidebar(): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname() || '/settings';

  return (
    <View style={styles.root} testID="web-settings-sidebar">
      <Text style={styles.heading}>Settings</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {WEB_SETTINGS_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              style={[styles.link, active && styles.linkActive]}
              onPress={() => router.push(item.href)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.linkText, active && styles.linkTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: {
      width: WEB_SETTINGS_SIDEBAR_WIDTH,
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    heading: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    list: {
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
    },
    link: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    linkActive: {
      backgroundColor: colors.priceBackground,
    },
    linkText: {
      fontSize: fontSize.body,
      color: colors.textSecondary,
    },
    linkTextActive: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
  })
);
