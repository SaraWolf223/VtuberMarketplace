import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import type { MyListingItem } from '@/types/my-listings';
import { listingImagePublicUrl } from '@/features/listings/listing-service';
import { myListingThumbPath } from '@/features/listings/my-listings-service';
import { categoryLabel } from '@/features/listings/category-labels';
import { formatListingPrice } from '@/utils/format-listing';
import { formatExpiresCountdown } from '@/utils/expires-countdown';
import { isListingBoosted } from '@/features/monetization/boost-service';
import { BOOST_CHECKOUT, formatUsdFromCents } from '@/constants/stripe-fees';
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
  onBoostFree?: () => void;
  onBoostFounding?: () => void;
  onBoostPromo?: () => void;
  onBoostPaid?: () => void;
  onMarkSold?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  boostBusy?: boolean;
  freeBoostsRemaining?: number;
};

export function MyListingRow({
  item,
  showExpiry,
  onPress,
  onEdit,
  onBoostFree,
  onBoostFounding,
  onBoostPromo,
  onBoostPaid,
  onMarkSold,
  onDelete,
  busy,
  boostBusy,
  freeBoostsRemaining = 0,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const boosted = isListingBoosted(item.boosted_until);
  const underReview = item.status === 'paused_pending_review';
  const thumb = myListingThumbPath(item);
  const thumbUri = thumb ? listingImagePublicUrl(thumb) : null;

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
          {boosted ? (
            <BoostTimer
              boostedUntil={item.boosted_until}
              prefix="Boosted"
              style={styles.boostedLabel}
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
            <Pressable style={styles.actionBtn} onPress={onEdit} disabled={busy || boostBusy}>
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
      {onBoostFree || onBoostFounding || onBoostPromo || onBoostPaid ? (
        <View style={[styles.actions, styles.boostActions]}>
          {onBoostFree && freeBoostsRemaining > 0 ? (
            <Pressable
              style={styles.actionBtn}
              onPress={onBoostFree}
              disabled={busy || boostBusy}
            >
              {boostBusy ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.boostText]} numberOfLines={1}>
                  Free boost
                </Text>
              )}
            </Pressable>
          ) : null}
          {onBoostFounding ? (
            <Pressable
              style={styles.actionBtn}
              onPress={onBoostFounding}
              disabled={busy || boostBusy}
            >
              {boostBusy && !(onBoostFree && freeBoostsRemaining > 0) ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.boostText]} numberOfLines={1}>
                  Founding boost
                </Text>
              )}
            </Pressable>
          ) : null}
          {onBoostPromo ? (
            <Pressable
              style={styles.actionBtn}
              onPress={onBoostPromo}
              disabled={busy || boostBusy}
            >
              {boostBusy && !(onBoostFree && freeBoostsRemaining > 0) ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.boostText]} numberOfLines={1}>
                  Promo boost
                </Text>
              )}
            </Pressable>
          ) : null}
          {onBoostPaid ? (
            <Pressable
              style={styles.actionBtn}
              onPress={onBoostPaid}
              disabled={busy || boostBusy}
            >
              {boostBusy && !(onBoostFree && freeBoostsRemaining > 0) && !onBoostPromo ? (
                <ActivityIndicator size="small" color={colors.boost} />
              ) : (
                <Text style={[styles.actionText, styles.boostText]} numberOfLines={1}>
                  {boosted
                    ? `Boost again (${formatUsdFromCents(BOOST_CHECKOUT.totalCents)})`
                    : `Boost ${formatUsdFromCents(BOOST_CHECKOUT.totalCents)}`}
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
  boostedLabel: {
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
  boostText: { color: colors.boost },
  boostActions: {
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
