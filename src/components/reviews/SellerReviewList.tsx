import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import type { SellerReview } from '@/types/reviews';
import { formatTimeAgo } from '@/utils/format-listing';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  reviews: SellerReview[];
};

function Stars({ rating }: { rating: number }): React.JSX.Element {
  const styles = useStyles();
  return (
    <Text style={styles.stars}>
      {'★'.repeat(rating)}
      <Text style={styles.starsOff}>{'★'.repeat(5 - rating)}</Text>
    </Text>
  );
}

export function SellerReviewList({ reviews }: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();

  if (!reviews.length) {
    return <Text style={styles.empty}>No reviews yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <Pressable
            style={styles.header}
            onPress={() => router.push(`/profile/${review.buyer_id}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${review.buyer_display_name}'s profile`}
          >
            {review.buyer_avatar_url ? (
              <Image source={{ uri: review.buyer_avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {review.buyer_display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={2}>
                {review.buyer_display_name}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{review.buyer_username}
              </Text>
              <Text style={styles.time}>{formatTimeAgo(review.created_at)}</Text>
            </View>
          </Pressable>
          <Stars rating={review.rating} />
          {review.body ? <Text style={styles.body}>{review.body}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  list: { gap: spacing.md, width: '100%' },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
  },
  avatar: { width: 40, height: 40, borderRadius: radius.full, flexShrink: 0 },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontWeight: fontWeight.bold, color: colors.textMuted },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    fontSize: fontSize.body,
  },
  username: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  stars: { color: colors.warning, fontSize: fontSize.body, letterSpacing: 1 },
  starsOff: { color: colors.border },
  body: { fontSize: fontSize.body, color: colors.text, lineHeight: 20 },
}));
