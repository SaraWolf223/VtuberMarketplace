import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { StaffModerationMenu } from '@/components/moderation/StaffModerationMenu';
import { blockUser } from '@/features/moderation/moderation-service';
import { useProfile } from '@/hooks/useProfile';
import { useStaffToolsAccess } from '@/hooks/useStaffToolsAccess';
import { showAlert } from '@/lib/cross-platform-alert';
import { Image } from 'expo-image';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useSellerProfileListings } from '@/hooks/useSellerProfileListings';
import { SellerListingsGrid } from '@/components/profile/SellerListingsGrid';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { Skeleton } from '@/components/ui/Skeleton';
import { SellerReviewList } from '@/components/reviews/SellerReviewList';
import { PremiumBadge } from '@/components/profile/PremiumBadge';
import { AvatarRing } from '@/components/profile/AvatarRing';
import { ProfileBulletinCard } from '@/components/profile/ProfileBulletinCard';
import { SellerPortfolioSection } from '@/components/profile/SellerPortfolioSection';
import { SellerSocialLinks } from '@/components/profile/SellerSocialLinks';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function PublicProfileScreen(): React.JSX.Element {
  const styles = useStyles();
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const userId = useMemo(
    () => (typeof params.userId === 'string' ? params.userId : params.userId?.[0]),
    [params.userId]
  );
  const router = useRouter();
  const { user, session } = useAuth();
  const { profile, reviews, isLoading, isRefetching, error, refetch } = usePublicProfile(userId);
  const {
    data: sellerListings,
    isPending: listingsLoading,
    isRefetching: listingsRefetching,
    error: listingsError,
    refetch: refetchListings,
  } = useSellerProfileListings(userId);
  const [reportOpen, setReportOpen] = useState(false);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const { data: viewerProfile } = useProfile();
  const staffTools = useStaffToolsAccess(viewerProfile?.role);
  const isStaff = staffTools.isStaff;
  const isSelf = user?.id === userId;

  const openStaffTools = () => {
    if (staffTools.canUseStaffTools) {
      setStaffMenuOpen(true);
      return;
    }
    if (staffTools.mfaLoading) {
      showAlert('Staff tools', 'Checking your two-factor session. Try again in a moment.');
      return;
    }
    if (staffTools.needsStepUp) {
      showAlert(
        'Two-factor check required',
        'Enter your authenticator code before using staff moderation tools.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify', onPress: () => router.push('/(auth)/verify-mfa') },
        ]
      );
      return;
    }
    if (staffTools.needsEnrollment) {
      showAlert(
        'Two-factor setup required',
        'Admin and manager accounts must set up two-factor authentication before using staff tools.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open security', onPress: () => router.push('/admin/security') },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <Skeleton height={80} width={80} borderRadius={40} style={styles.avatarSkel} />
        <Skeleton height={22} width="50%" />
        <Skeleton height={16} width="35%" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Seller not found'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: profile.display_name }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || listingsRefetching}
            onRefresh={() => {
              refetch();
              refetchListings();
            }}
          />
        }
      >
        <View style={styles.profileHeader}>
          <AvatarRing
            size={96}
            isAdmin={profile.is_admin}
            isPremium={Boolean(profile.is_pro_seller ?? profile.is_premium)}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {profile.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </AvatarRing>
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.meta}>
            {profile.listing_count} listing{profile.listing_count === 1 ? '' : 's'}
            {profile.rating_count > 0
              ? ` · ★ ${profile.rating_avg.toFixed(1)} (${profile.rating_count} reviews)`
              : ' · No reviews yet'}
          </Text>
          {profile.is_pro_seller || profile.is_premium ? (
            <View style={styles.badgeRow}>
              <PremiumBadge />
            </View>
          ) : null}

          <SellerSocialLinks
            websiteUrl={profile.website_url}
            portfolioUrl={profile.portfolio_url}
            socialLinks={profile.social_links}
          />

          {!isSelf && user && session?.access_token && !profile.is_admin ? (
            <View style={styles.safetyRow}>
              <Pressable onPress={() => setReportOpen(true)}>
                <Text style={styles.safetyLink}>Report user</Text>
              </Pressable>
              {!profile.is_admin ? (
                <>
                  <Text style={styles.safetyDot}>·</Text>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Block user?',
                        `Hide all listings from ${profile.display_name} and stop new messages.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Block',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await blockUser(session.access_token, user.id, userId!);
                                Alert.alert('Blocked', 'You will not see this user in your feed or messages.');
                                router.back();
                              } catch (e) {
                                Alert.alert(
                                  'Error',
                                  e instanceof Error ? e.message : 'Could not block'
                                );
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.safetyLink}>Block</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {isStaff && !isSelf && session?.access_token ? (
            <Pressable
              style={styles.staffToolsBtn}
              onPress={openStaffTools}
              accessibilityRole="button"
              accessibilityLabel="Open staff moderation tools"
            >
              <Text style={styles.staffToolsText}>Staff tools</Text>
            </Pressable>
          ) : null}
        </View>

        <ProfileBulletinCard userId={userId!} isSelf={isSelf} />
        <SellerPortfolioSection sellerId={userId!} />

        <SellerListingsGrid
          listings={sellerListings}
          isLoading={listingsLoading}
          error={listingsError}
          onRetry={() => refetchListings()}
        />

        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <SellerReviewList reviews={reviews} />
        </View>
      </ScrollView>

      {session?.access_token && userId && !isSelf ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          accessToken={session.access_token}
          targetType="user"
          reportedUserId={userId}
        />
      ) : null}

      {staffTools.canUseStaffTools && session?.access_token && user && userId && !isSelf ? (
        <StaffModerationMenu
          visible={staffMenuOpen}
          onClose={() => setStaffMenuOpen(false)}
          accessToken={session.access_token}
          adminUserId={user.id}
          target={{
            userId,
            username: profile.username,
            displayName: profile.display_name,
          }}
        />
      ) : null}
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewsSection: {
    width: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  avatarSkel: { marginBottom: spacing.sm },
  error: { color: colors.error, textAlign: 'center' },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.priceBackground,
    alignItems: 'center',
    justifyContent: 'center',
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
  username: { fontSize: fontSize.body, color: colors.textSecondary },
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
  sectionTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  safetyDot: { color: colors.textMuted },
  safetyLink: { color: colors.textMuted, fontSize: fontSize.caption },
  staffToolsBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  staffToolsText: {
    color: colors.warning,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.caption,
  },
}));
