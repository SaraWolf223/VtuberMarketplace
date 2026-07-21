import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { ScreenScrollView } from '@/components/layout/ScreenScrollView';
import { useWebViewport } from '@/hooks/useWebViewport';
import { useWebSlidePanelStore } from '@/stores/web-slide-panel-store';
import { openActivityTab } from '@/lib/open-activity-tab';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUpdateAvatar } from '@/hooks/useUpdateAvatar';
import { AVATAR_LIMITS_LABEL } from '@/features/profile/avatar-service';
import { PremiumBadge } from '@/components/profile/PremiumBadge';
import { FoundingSellerBadge } from '@/components/profile/FoundingSellerBadge';
import { AvatarRing } from '@/components/profile/AvatarRing';
import { isPremiumActive } from '@/features/monetization/premium-service';
import { AccountStatusCard } from '@/components/account/AccountStatusCard';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function ProfileScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { isDesktopWeb } = useWebViewport();
  const openPanel = useWebSlidePanelStore((s) => s.open);
  const closePanel = useWebSlidePanelStore((s) => s.close);
  const { isSignedIn, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDesktopWeb) return;
    if (pathname.includes('/profile')) {
      openPanel('profile');
      router.replace('/(tabs)');
    }
  }, [isDesktopWeb, pathname, openPanel, router]);
  const { data: profile, isPending, isFetching, error, refetch } = useProfile();
  const { changeAvatar, uploading: uploadingAvatar } = useUpdateAvatar();

  const loading = authLoading || ((isPending || isFetching) && !profile);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Sign in to view your profile.</Text>
        <Pressable
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="button"
        >
          <Text style={styles.signInButtonText}>Sign in with Google</Text>
        </Pressable>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          {error instanceof Error ? error.message : 'Could not load profile.'}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.scrollContent}>
      <Pressable
        onPress={changeAvatar}
        disabled={uploadingAvatar}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        style={styles.avatarTap}
      >
        <AvatarRing
          size={96}
          isAdmin={profile.role === 'admin'}
          isPremium={isPremiumActive(profile.is_premium, profile.premium_until)}
        >
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {profile.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </AvatarRing>
        {uploadingAvatar ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : (
          <Text style={styles.avatarEditHint}>Tap to change photo ({AVATAR_LIMITS_LABEL})</Text>
        )}
      </Pressable>
      <Text style={styles.name}>{profile.display_name}</Text>
      <Text style={styles.username}>@{profile.username}</Text>
      <Text style={styles.meta}>
        {profile.listing_count} listing{profile.listing_count === 1 ? '' : 's'} ·{' '}
        {profile.rating_count > 0
          ? `${profile.rating_avg.toFixed(1)} ★ (${profile.rating_count} reviews)`
          : 'No reviews yet'}
      </Text>
      {(profile.is_founding_seller ||
        isPremiumActive(profile.is_premium, profile.premium_until)) ? (
        <View style={styles.badgeRow}>
          {profile.is_founding_seller ? <FoundingSellerBadge /> : null}
          {isPremiumActive(profile.is_premium, profile.premium_until) ? (
            <PremiumBadge />
          ) : null}
        </View>
      ) : null}
      <View style={styles.fullWidth}>
        <AccountStatusCard />
      </View>

      <View style={styles.fullWidth}>
        <SettingsSection title="Quick links">
          <SettingsRow
            title="Messages"
            subtitle="Buyer and seller chats"
            onPress={() => {
              closePanel();
              router.push('/messages');
            }}
          />
          <SettingsRow
            title="My listings"
            subtitle="Active, sold, and expired"
            onPress={() => {
              closePanel();
              router.push('/my-listings');
            }}
          />
          <SettingsRow
            title="Activity & notifications"
            onPress={openActivityTab}
            isLast
          />
        </SettingsSection>
      </View>

      <Pressable
        style={styles.settingsButton}
        onPress={() => {
          closePanel();
          router.push('/settings');
        }}
      >
        <Text style={styles.settingsText}>Account settings</Text>
      </Pressable>
      <Text style={styles.settingsHint}>Profile, location, Premium, ads, and safety</Text>
    </ScreenScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  avatarTap: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditHint: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  avatarPlaceholder: {
    backgroundColor: colors.priceBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  name: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  username: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  settingsButton: {
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  settingsText: {
    color: colors.onPrimary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  settingsHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  error: { color: colors.error, textAlign: 'center' },
  signInButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  signInButtonText: {
    color: colors.onPrimary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.body,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
