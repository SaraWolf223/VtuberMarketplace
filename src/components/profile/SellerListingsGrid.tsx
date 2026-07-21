import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import type { SellerProfileListingItem } from '@/types/seller-profile-listings';
import { SellerProfileListingCard } from '@/components/profile/SellerProfileListingCard';
import { SellerListingsGridSkeleton } from '@/components/profile/SellerListingsGridSkeleton';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { spacing } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  listings: SellerProfileListingItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
};

function buildPairs(
  listings: SellerProfileListingItem[]
): { left: SellerProfileListingItem; right?: SellerProfileListingItem }[] {
  const pairs: { left: SellerProfileListingItem; right?: SellerProfileListingItem }[] = [];
  for (let i = 0; i < listings.length; i += 2) {
    pairs.push({ left: listings[i], right: listings[i + 1] });
  }
  return pairs;
}

export function SellerListingsGrid({
  listings,
  isLoading,
  error,
  onRetry,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const { height: windowHeight } = useWindowDimensions();
  const boxHeight = Math.max(280, Math.min(windowHeight * 0.45, 520));
  const pairs = listings ? buildPairs(listings) : [];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Listings by this seller</Text>
      <View style={[styles.scrollFrame, { height: boxHeight }]}>
        {isLoading ? (
          <SellerListingsGridSkeleton />
        ) : error ? (
          <ErrorRetry
            message={error instanceof Error ? error.message : 'Could not load listings'}
            onRetry={() => onRetry?.()}
          />
        ) : pairs.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.empty}>No active or sold listings to show.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {pairs.map((pair) => (
              <View key={pair.left.id} style={styles.row}>
                <View style={styles.cell}>
                  <SellerProfileListingCard listing={pair.left} />
                </View>
                <View style={styles.cell}>
                  {pair.right ? (
                    <SellerProfileListingCard listing={pair.right} />
                  ) : (
                    <View style={styles.placeholder} />
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  section: { width: '100%', marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  scrollFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.sm, paddingBottom: spacing.md },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  error: {
    fontSize: fontSize.body,
    color: colors.error,
    textAlign: 'center',
  },
  empty: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cell: { flex: 1 },
  placeholder: { flex: 1 },
}));
