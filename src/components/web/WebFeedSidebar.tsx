import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WebVerticalScroll } from '@/components/web/WebVerticalScroll';
import type { ListingCategory } from '@/types/enums';
import { useListingCategories } from '@/hooks/useListingCategories';
import {
  useFeedFiltersStore,
  type FeedMaxPrice,
  type FeedListingStatus,
} from '@/stores/feed-filters-store';
import { countActiveFeedFilters } from '@/components/feed/FeedFiltersSheet';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const PRICE_OPTIONS: { id: FeedMaxPrice; label: string }[] = [
  { id: null, label: 'Any' },
  { id: 20, label: '$20' },
  { id: 50, label: '$50' },
  { id: 100, label: '$100' },
  { id: 250, label: '$250' },
];

const AVAILABILITY_OPTIONS: { id: FeedListingStatus; label: string }[] = [
  { id: 'active', label: 'Available' },
  { id: 'sold', label: 'Sold' },
];

const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 4.5, label: '4.5★+' },
];

/** Persistent left filter sidebar for the desktop web feed. */
export function WebFeedSidebar(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const listingCategories = useListingCategories();
  const {
    category,
    maxPrice,
    listingStatus,
    minSellerRating,
    sort,
    publishedAfter,
    setCategory,
    setMaxPrice,
    setListingStatus,
    setMinSellerRating,
    reset,
  } = useFeedFiltersStore();

  const activeCount = countActiveFeedFilters({
    sort,
    maxPrice,
    category,
    listingStatus,
    publishedAfter,
    minSellerRating,
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Filters{activeCount > 0 ? ` (${activeCount})` : ''}</Text>
        <Pressable onPress={() => reset()} hitSlop={8}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>
      <WebVerticalScroll contentContainerStyle={styles.content}>
        <Text style={styles.section}>Category</Text>
        <Chip
          label="All"
          active={category === null}
          onPress={() => setCategory(null)}
          styles={styles}
          colors={colors}
        />
        {listingCategories.map((cat) => (
          <Chip
            key={cat.slug}
            label={cat.label}
            active={category === (cat.slug as ListingCategory)}
            onPress={() => setCategory(cat.slug)}
            styles={styles}
            colors={colors}
          />
        ))}

        <Text style={styles.section}>Max price</Text>
        <View style={styles.row}>
          {PRICE_OPTIONS.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              active={maxPrice === o.id}
              onPress={() => setMaxPrice(o.id)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <Text style={styles.section}>Availability</Text>
        <View style={styles.row}>
          {AVAILABILITY_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              active={listingStatus === o.id}
              onPress={() => setListingStatus(o.id)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        <Text style={styles.section}>Seller rating</Text>
        <View style={styles.row}>
          {RATING_OPTIONS.map((o) => (
            <Chip
              key={String(o.value)}
              label={o.label}
              active={minSellerRating === o.value}
              onPress={() => setMinSellerRating(o.value)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>
      </WebVerticalScroll>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  styles,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
  colors: ReturnType<typeof useThemeColors>;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: {
      width: 240,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
    reset: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    section: {
      marginTop: spacing.sm,
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      marginBottom: 4,
      backgroundColor: colors.background,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.priceBackground },
    chipText: { fontSize: fontSize.caption, color: colors.textSecondary },
  })
);
