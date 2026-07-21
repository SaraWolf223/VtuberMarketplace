import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import type { MyListingItem } from '@/types/my-listings';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import { myListingThumbPath } from '@/features/listings/my-listings-service';
import { categoryLabel } from '@/features/listings/category-labels';
import { formatListingPrice } from '@/utils/format-listing';
import { formatExpiresCountdown } from '@/utils/expires-countdown';
import { isListingFeatured } from '@/features/monetization/featured-service';
import { FEATURED_CHECKOUT, formatUsdFromCents } from '@/constants/stripe-fees';
import { BoostTimer } from '@/components/listing/BoostTimer';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  item: MyListingItem;
  showExpiry: boolean;
  onPress: () => void;
  onEdit?: () => void;
  onFeatureCredit?: () => void;
  onFeaturePaid?: () => void;
  onMarkSold?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  featureBusy?: boolean;
  featuredCreditsRemaining?: number;
  /** @deprecated */
  onBoostFree?: () => void;
  onBoostFounding?: () => void;
  onBoostPromo?: () => void;
  onBoostPaid?: () => void;
  boostBusy?: boolean;
  freeBoostsRemaining?: number;
};

export function MyListingRow({
  item,
  showExpiry,
  onPress,
  onEdit,
  onFeatureCredit,
  onFeaturePaid,
  onMarkSold,
  onDelete,
  busy,
  featureBusy,
  featuredCreditsRemaining = 0,
  onBoostFree,
  onBoostPaid,
  boostBusy,
  freeBoostsRemaining = 0,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const featuredUntil = item.featured_until ?? item.boosted_until;
  const featured = isListingFeatured(featuredUntil);
  const underReview = item.status === 'paused_pending_review';
  const thumb = myListingThumbPath(item);
  const thumbUri = thumb ? listingImagePublicUrl(thumb) : null;
  const creditHandler = onFeatureCredit ?? onBoostFree;
  const paidHandler = onFeaturePaid ?? onBoostPaid;
  const actionBusy = featureBusy ?? boostBusy;
  const creditsLeft = featuredCreditsRemaining || freeBoostsRemaining;

  return (
    <View style={styles.card}>
      <Pressable style={styles.main} onPress={onPress}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.price}>{formatListingPrice(item.price)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.meta}>{categoryLabel(item.category)}</Text>
          {underReview ? (
            <Text style={styles.reviewBanner}>Under review — hidden from feed</Text>
          ) : null}
          {featured ? (
            <BoostTimer
              boostedUntil={featuredUntil}
              prefix="Featured"
              style={styles.featuredLabel}
            />
          ) : null}
          {showExpiry ? (
            <Text style={styles.expiry}>{formatExpiresCountdown(item.expires_at)}</Text>
          ) : (
            <Text style={styles.metaMuted}>
              {item.status === 'sold' ? 'Sold' : 'Expired'}
            </Text>
          )}
        </View>
      </Pressable>

      {onEdit || onMarkSold || onDelete ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable style={styles.actionBtn} onPress={onEdit} disabled={busy || actionBusy}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
          ) : null}
          {onMarkSold ? (
            <Pressable style={styles.actionBtn} onPress={onMarkSold} disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionText}>Mark sold</Text>
              )}
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete} disabled={busy}>
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {creditHandler || paidHandler ? (
        <View style={[styles.actions, styles.featureActions]}>
          {creditHandler && creditsLeft > 0 ? (
            <Pressable
              style={styles.actionBtn}
              onPress={creditHandler}
              disabled={busy || actionBusy}
            >
              {actionBusy ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.featureText]} numberOfLines={1}>
                  Use Featured credit
                </Text>
              )}
            </Pressable>
          ) : null}
          {paidHandler ? (
            <Pressable
              style={styles.actionBtn}
              onPress={paidHandler}
              disabled={busy || actionBusy}
            >
              {actionBusy && !(creditHandler && creditsLeft > 0) ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.featureText]} numberOfLines={1}>
                  {featured
                    ? `Feature again (${formatUsdFromCents(FEATURED_CHECKOUT.totalCents)})`
                    : `Feature ${formatUsdFromCents(FEATURED_CHECKOUT.totalCents)}`}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  main: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  thumb: { width: 80, height: 80, borderRadius: radius.sm },
  thumbPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: { fontSize: fontSize.caption, color: colors.textMuted },
  info: { flex: 1, gap: 2 },
  price: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.price },
  title: { fontSize: fontSize.body, color: colors.text, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  metaMuted: { fontSize: fontSize.caption, color: colors.sold },
  featuredLabel: {
    fontSize: fontSize.caption,
    color: colors.boost,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  expiry: {
    fontSize: fontSize.caption,
    color: colors.warning,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  reviewBanner: {
    fontSize: fontSize.caption,
    color: colors.error,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  featureText: { color: colors.boost },
  featureActions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.billGreenMuted,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  actionText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primary },
  deleteBtn: {},
  deleteText: { color: colors.error },
}));
