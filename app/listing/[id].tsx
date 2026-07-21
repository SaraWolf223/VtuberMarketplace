import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/hooks/useAuth';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { useListingDetail } from '@/hooks/useListingDetail';
import { useEmailVerificationGate } from '@/hooks/useEmailVerificationGate';
import { ListingImageCarousel } from '@/components/listing/ListingImageCarousel';
import { getOrCreateListingConversation } from '@/features/messages/dm-service';
import { recordListingInterest } from '@/features/listings/listing-detail-service';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { StaffModerationMenu } from '@/components/moderation/StaffModerationMenu';
import { blockUser } from '@/features/moderation/moderation-service';
import { useProfile } from '@/hooks/useProfile';
import { useStaffToolsAccess } from '@/hooks/useStaffToolsAccess';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { useListingReviewStatus } from '@/hooks/useListingReviewStatus';
import { useCreateReview } from '@/hooks/useCreateReview';
import { queryKeys } from '@/lib/query-keys';
import { categoryLabel } from '@/features/listings/category-labels';
import {
  formatDistanceMiles,
  formatListingPrice,
  formatTimeAgo,
} from '@/utils/format-listing';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { isListingBoosted } from '@/features/monetization/boost-service';
import { BoostTimer } from '@/components/listing/BoostTimer';
import { CollegeStudentBadge } from '@/components/profile/CollegeStudentBadge';
import { FoundingSellerBadge } from '@/components/profile/FoundingSellerBadge';
import { AvatarRing } from '@/components/profile/AvatarRing';
import { reviewProgressHint } from '@/features/reviews/review-eligibility';
import { LEGAL_URLS } from '@/constants/legal-urls';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { showAlert } from '@/lib/cross-platform-alert';
import { useBrowseInterstitial } from '@/hooks/useBrowseInterstitial';
import { ListingSupportSection } from '@/components/support/ListingSupportSection';
import { startOrderCheckout } from '@/features/orders/order-service';

export default function ListingDetailScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { requireVerification } = useEmailVerificationGate();
  useBrowseInterstitial(id);
  const [buying, setBuying] = useState(false);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    toggleFavorite,
    isFavoriteLoading,
  } = useListingDetail(id);

  const [openingMessage, setOpeningMessage] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const { data: viewerProfile } = useProfile();
  const staffTools = useStaffToolsAccess(viewerProfile?.role);
  const isStaff = staffTools.isStaff;

  const { data: reviewStatus } = useListingReviewStatus(id);
  const createReview = useCreateReview();
  const { isDesktopWeb } = useWebViewport();
  const desktopLayout = Platform.OS === 'web' && isDesktopWeb;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Listing not found'}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const { listing, seller, images, distance_miles, is_favorited } = data;
  const active = listing.status === 'active';
  const underReview = listing.status === 'paused_pending_review';
  const boosted = isListingBoosted(listing.boosted_until);
  const token = session?.access_token ?? '';

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

  const onFavorite = () => {
    if (listing.is_own) {
      showAlert('Your listing', "You can't favorite your own listing.");
      return;
    }
    toggleFavorite(!is_favorited);
  };

  return (
    <>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, desktopLayout && styles.contentDesktop]}
      >
        <View style={[styles.layout, desktopLayout && styles.layoutDesktop]}>
          <View style={desktopLayout ? styles.mediaColumn : undefined}>
            <ListingImageCarousel
              images={images}
              status={listing.status}
              boostedUntil={listing.boosted_until}
            />
          </View>

          <View style={[styles.body, desktopLayout && styles.bodyDesktop]}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatListingPrice(listing.price)}</Text>
            {distance_miles != null ? (
              <Text style={styles.distance}>{formatDistanceMiles(distance_miles)}</Text>
            ) : null}
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{categoryLabel(listing.category)}</Text>
            </View>
            <Text style={styles.meta}>
              {formatTimeAgo(listing.published_at)} · ZIP {listing.zip_code}
            </Text>
          </View>

          {listing.is_own && boosted ? (
            <BoostTimer
              boostedUntil={listing.boosted_until}
              prefix="Featured"
              style={styles.boostTimer}
            />
          ) : null}

          {listing.description ? (
            <Text style={styles.description}>{listing.description}</Text>
          ) : null}

          <Pressable
            style={styles.sellerRow}
            onPress={() => router.push(`/profile/${seller.id}`)}
            accessibilityRole="button"
          >
            <AvatarRing size={48} isAdmin={seller.is_admin} isPremium={seller.is_premium}>
              {seller.avatar_url ? (
                <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {(seller.display_name || seller.username).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </AvatarRing>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{seller.display_name}</Text>
                {seller.college_badge_active ? <CollegeStudentBadge /> : null}
                {seller.is_founding_seller ? <FoundingSellerBadge /> : null}
              </View>
              <Text style={styles.sellerSub}>
                @{seller.username}
                {seller.rating_count > 0
                  ? ` · ★ ${seller.rating_avg.toFixed(1)} (${seller.rating_count} reviews)`
                  : ''}
              </Text>
              <Text style={styles.viewProfile}>View profile & reviews →</Text>
            </View>
          </Pressable>

          <ListingSupportSection
            listingId={listing.id}
            isOwner={!!listing.is_own}
            assetType={(listing as { asset_type?: string | null }).asset_type}
            category={listing.category}
          />

          {!listing.is_own && active ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnOutline, is_favorited && styles.btnFavorited]}
                onPress={onFavorite}
                disabled={isFavoriteLoading}
              >
                <Text
                  style={[
                    styles.btnOutlineText,
                    is_favorited && styles.btnFavoritedText,
                  ]}
                >
                  {is_favorited ? '♥ Saved' : '♡ Save'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                disabled={buying}
                onPress={() => {
                  showAlert(
                    'Confirm purchase',
                    'You agree to the seller’s license terms for this listing. Checkout opens in Stripe.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        onPress: async () => {
                          setBuying(true);
                          try {
                            await startOrderCheckout({
                              listing_id: listing.id,
                              license_acknowledged: true,
                            });
                          } catch (e) {
                            showAlert(
                              'Checkout',
                              e instanceof Error ? e.message : 'Could not start checkout'
                            );
                          } finally {
                            setBuying(false);
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.btnPrimaryText}>{buying ? 'Opening…' : 'Buy'}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnOutline]}
                disabled={openingMessage}
                onPress={async () => {
                  if (!requireVerification('Messaging a seller')) return;
                  setOpeningMessage(true);
                  try {
                    trackEvent(AnalyticsEvents.contactTapped, {
                      listing_id: listing.id,
                      seller_id: seller.id,
                    });
                    const convId = await getOrCreateListingConversation(token, listing.id);
                    void recordListingInterest(token, listing.id).catch(() => {});
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.listingReviewStatus(listing.id),
                    });
                    router.push(`/messages/${convId}`);
                  } catch (e) {
                    showAlert(
                      'Could not open chat',
                      e instanceof Error ? e.message : 'Try again'
                    );
                  } finally {
                    setOpeningMessage(false);
                  }
                }}
              >
                <Text style={styles.btnOutlineText}>
                  {openingMessage ? 'Opening…' : 'Message'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!listing.is_own && reviewStatus?.can_review ? (
            <Pressable style={styles.reviewButton} onPress={() => setReviewOpen(true)}>
              <Text style={styles.reviewButtonText}>Leave a review</Text>
            </Pressable>
          ) : null}

          {!listing.is_own && reviewStatus?.has_review ? (
            <Text style={styles.reviewedHint}>You reviewed this seller for this listing.</Text>
          ) : null}

          {!listing.is_own && reviewStatus && !reviewStatus.can_review && !reviewStatus.has_review ? (
            <Text style={styles.reviewedHint}>{reviewProgressHint(reviewStatus)}</Text>
          ) : null}

          {listing.is_own && underReview ? (
            <Text style={styles.reviewBanner}>
              This listing is under review and hidden from the feed after multiple reports.
              You will be notified when moderation completes.
            </Text>
          ) : null}

          {listing.is_own ? (
            <Text style={styles.ownHint}>This is your listing.</Text>
          ) : null}

          {!listing.is_own ? (
            <View style={styles.safetyRow}>
              <Pressable
                style={styles.reportLink}
                onPress={() => void Linking.openURL(LEGAL_URLS.community)}
              >
                <Text style={styles.reportText}>Community guidelines</Text>
              </Pressable>
              <Text style={styles.safetyDot}>·</Text>
              <Pressable style={styles.reportLink} onPress={() => setReportOpen(true)}>
                <Text style={styles.reportText}>Report listing</Text>
              </Pressable>
              {!seller.is_admin ? (
                <>
                  <Text style={styles.safetyDot}>·</Text>
                  <Pressable style={styles.reportLink} onPress={() => setReportUserOpen(true)}>
                    <Text style={styles.reportText}>Report seller</Text>
                  </Pressable>
                  <Text style={styles.safetyDot}>·</Text>
                  <Pressable
                    style={styles.reportLink}
                    onPress={() => {
                      showAlert(
                        'Block seller?',
                        `Hide all listings from ${seller.display_name} and stop contact.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Block',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await blockUser(token, user!.id, seller.id);
                                showAlert('Blocked', 'You will not see this seller anymore.');
                                router.back();
                              } catch (e) {
                                showAlert(
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
                    <Text style={styles.reportText}>Block</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {isStaff && !listing.is_own ? (
            <Pressable
              style={styles.staffToolsBtn}
              onPress={openStaffTools}
              accessibilityRole="button"
              accessibilityLabel="Open staff moderation tools"
            >
              <Text style={styles.staffToolsText}>Staff tools</Text>
            </Pressable>
          ) : null}

          {!active && !underReview ? (
            <Text style={styles.inactiveHint}>
              This listing is no longer available for contact.
            </Text>
          ) : null}

          {underReview && !listing.is_own ? (
            <Text style={styles.inactiveHint}>This listing is under moderation review.</Text>
          ) : null}
          </View>
        </View>
      </ScrollView>

      {user && token ? (
        <>
          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            accessToken={token}
            targetType="listing"
            listingId={listing.id}
          />
          <ReportSheet
            visible={reportUserOpen}
            onClose={() => setReportUserOpen(false)}
            accessToken={token}
            targetType="user"
            reportedUserId={seller.id}
            title="Report seller"
          />
          {staffTools.canUseStaffTools ? (
            <StaffModerationMenu
              visible={staffMenuOpen}
              onClose={() => setStaffMenuOpen(false)}
              accessToken={token}
              adminUserId={user.id}
              target={{
                userId: seller.id,
                username: seller.username,
                displayName: seller.display_name,
              }}
              listing={{ id: listing.id, status: listing.status, title: listing.title }}
              onListingDeleted={() => router.back()}
            />
          ) : null}
          <ReviewModal
            visible={reviewOpen}
            onClose={() => setReviewOpen(false)}
            sellerName={seller.display_name}
            onSubmit={async (rating, body) => {
              if (!reviewStatus?.order_id) {
                throw new Error('Complete a fulfilled purchase before leaving a review.');
              }
              await createReview.mutateAsync({
                orderId: reviewStatus.order_id,
                listingId: listing.id,
                sellerId: seller.id,
                rating,
                body,
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  contentDesktop: {
    width: '100%',
    maxWidth: WEB_APP_MAX_WIDTH,
    alignSelf: 'center',
  },
  layout: {},
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  mediaColumn: {
    flex: 1.6,
    minWidth: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: { color: colors.error, textAlign: 'center' },
  body: { padding: spacing.lg, gap: spacing.md },
  bodyDesktop: {
    flexBasis: 380,
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 400,
    minWidth: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.price,
  },
  distance: { fontSize: fontSize.body, color: colors.textSecondary },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.priceBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  chipText: { color: colors.primary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  boostTimer: {
    fontSize: fontSize.caption,
    color: colors.boost,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  description: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 22,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: { width: '100%', height: '100%', borderRadius: radius.full },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textMuted },
  sellerInfo: { flex: 1 },
  sellerNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  sellerName: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  sellerSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  viewProfile: {
    fontSize: fontSize.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: fontWeight.semibold,
  },
  reviewButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  reviewButtonText: { color: colors.primary, fontWeight: fontWeight.semibold },
  reviewedHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  btnOutline: { borderWidth: 1, borderColor: colors.primary },
  btnOutlineText: { color: colors.primary, fontWeight: fontWeight.semibold },
  btnFavorited: { backgroundColor: colors.priceBackground },
  btnFavoritedText: { color: colors.primary },
  safetyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  safetyDot: { color: colors.textMuted, fontSize: fontSize.caption },
  reportLink: { paddingVertical: spacing.xs },
  reportText: { color: colors.textMuted, fontSize: fontSize.caption },
  staffToolsBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  staffToolsText: { color: colors.warning, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
  reviewBanner: {
    textAlign: 'center',
    color: colors.error,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    backgroundColor: colors.priceBackground,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  ownHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  inactiveHint: {
    textAlign: 'center',
    color: colors.sold,
    fontSize: fontSize.caption,
  },
}));
