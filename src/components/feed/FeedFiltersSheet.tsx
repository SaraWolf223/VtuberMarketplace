import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useFeedFiltersStore,
  type FeedMaxPrice,
  type FeedListingStatus,
} from '@/stores/feed-filters-store';
import { ALL_CATEGORIES_ICON, type CategoryIconName } from '@/features/listings/category-icons';
import { categoryLabel } from '@/features/listings/category-labels';
import { useListingCategories } from '@/hooks/useListingCategories';
import { WebVerticalScroll } from '@/components/web/WebVerticalScroll';
import type { FeedSort } from '@/types/feed';
import type { ListingCategory } from '@/types/enums';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { useWebViewport } from '@/hooks/useWebViewport';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type IconTileProps = {
  label: string;
  icon: CategoryIconName;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
};

const SORT_OPTIONS: {
  id: FeedSort;
  label: string;
  icon: CategoryIconName;
}[] = [
  { id: 'newest', label: 'Newest', icon: 'time-outline' },
  { id: 'price_low', label: 'Price ↑', icon: 'pricetag-outline' },
  { id: 'price_high', label: 'Price ↓', icon: 'pricetag-outline' },
  { id: 'featured', label: 'Featured', icon: 'star-outline' },
];

const AVAILABILITY_OPTIONS: { id: FeedListingStatus; label: string; icon: CategoryIconName }[] = [
  { id: 'active', label: 'Available', icon: 'checkmark-circle-outline' },
  { id: 'sold', label: 'Sold', icon: 'bag-check-outline' },
];

const PRICE_OPTIONS: {
  id: FeedMaxPrice;
  label: string;
  icon: CategoryIconName;
}[] = [
  { id: null, label: 'Any', icon: 'wallet-outline' },
  { id: 20, label: '$20', icon: 'cash-outline' },
  { id: 50, label: '$50', icon: 'cash-outline' },
  { id: 100, label: '$100', icon: 'cash-outline' },
  { id: 250, label: '$250', icon: 'cash-outline' },
];

const DATE_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'any', label: 'Any time', days: null },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
];

const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 4.5, label: '4.5★+' },
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function FeedFiltersSheet({ visible, onClose }: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const safeBottom = useSafeBottomPadding();
  const { isDesktopWeb } = useWebViewport();
  const categories = useListingCategories();
  const {
    category,
    maxPrice,
    sort,
    listingStatus,
    publishedAfter,
    minSellerRating,
    licenseType,
    hasCustomization,
    hasSetup,
    setCategory,
    setMaxPrice,
    setSort,
    setListingStatus,
    setPublishedAfter,
    setPublishedBefore,
    setMinSellerRating,
    setLicenseType,
    setHasCustomization,
    setHasSetup,
    reset,
  } = useFeedFiltersStore();

  const activeDatePreset =
    DATE_PRESETS.find((p) => {
      if (p.days == null) return publishedAfter == null;
      if (!publishedAfter) return false;
      const target = daysAgoIso(p.days);
      return Math.abs(new Date(publishedAfter).getTime() - new Date(target).getTime()) < 86_400_000;
    })?.id ?? 'any';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' && isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          isDesktopWeb ? styles.containerDesktop : styles.containerBottom,
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
        <View
          style={[
            styles.sheet,
            isDesktopWeb ? styles.sheetDesktop : styles.sheetBottom,
            { maxHeight: isDesktopWeb ? '72%' : '88%', paddingBottom: safeBottom },
          ]}
          testID="feed-filters-panel"
        >
          {Platform.OS !== 'web' || !isDesktopWeb ? <View style={styles.handle} /> : null}
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <Pressable
              onPress={() => {
                reset();
                setPublishedBefore(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.reset}>Reset all</Text>
            </Pressable>
          </View>

          <WebVerticalScroll
            style={[styles.scroll, isDesktopWeb && styles.scrollDesktop]}
            contentContainerStyle={styles.scrollContent}
            testID="feed-filters-scroll"
          >
            <FilterSection title="Category">
              <View style={styles.categoryGrid}>
                <FilterIconTile
                  label="All"
                  icon={ALL_CATEGORIES_ICON}
                  selected={category === null}
                  onPress={() => setCategory(null)}
                />
                {categories.map((cat) => (
                  <FilterIconTile
                    key={cat.slug}
                    label={cat.label}
                    icon={cat.icon}
                    selected={category === cat.slug}
                    onPress={() => setCategory(cat.slug)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Sort by">
              <View style={styles.tileRow}>
                {SORT_OPTIONS.map((o) => (
                  <FilterIconTile
                    key={o.id}
                    label={o.label}
                    icon={o.icon}
                    selected={sort === o.id}
                    onPress={() => setSort(o.id)}
                    compact
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Availability">
              <View style={styles.tileRow}>
                {AVAILABILITY_OPTIONS.map((o) => (
                  <FilterIconTile
                    key={o.id}
                    label={o.label}
                    icon={o.icon}
                    selected={listingStatus === o.id}
                    onPress={() => setListingStatus(o.id)}
                    compact
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Max price">
              <View style={styles.categoryGrid}>
                {PRICE_OPTIONS.map((o) => (
                  <FilterIconTile
                    key={o.label}
                    label={o.label}
                    icon={o.icon}
                    selected={maxPrice === o.id}
                    onPress={() => setMaxPrice(o.id)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Published">
              <View style={styles.tileRow}>
                {DATE_PRESETS.map((o) => (
                  <FilterIconTile
                    key={o.id}
                    label={o.label}
                    icon="calendar-outline"
                    selected={activeDatePreset === o.id}
                    onPress={() => {
                      if (o.days == null) {
                        setPublishedAfter(null);
                        setPublishedBefore(null);
                      } else {
                        setPublishedAfter(daysAgoIso(o.days));
                        setPublishedBefore(null);
                      }
                    }}
                    compact
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Min seller rating">
              <View style={styles.tileRow}>
                {RATING_OPTIONS.map((o) => (
                  <FilterIconTile
                    key={String(o.value)}
                    label={o.label}
                    icon="star-outline"
                    selected={minSellerRating === o.value}
                    onPress={() => setMinSellerRating(o.value)}
                    compact
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="License">
              <View style={styles.tileRow}>
                {(
                  [
                    [null, 'Any'],
                    ['otu', 'OTU'],
                    ['p2u', 'P2U'],
                  ] as const
                ).map(([id, label]) => (
                  <FilterIconTile
                    key={label}
                    label={label}
                    icon="document-text-outline"
                    selected={licenseType === id}
                    onPress={() => setLicenseType(id)}
                    compact
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Add-ons">
              <View style={styles.tileRow}>
                <FilterIconTile
                  label="Customization"
                  icon="color-palette-outline"
                  selected={hasCustomization === true}
                  onPress={() =>
                    setHasCustomization(hasCustomization === true ? null : true)
                  }
                  compact
                />
                <FilterIconTile
                  label="Setup"
                  icon="construct-outline"
                  selected={hasSetup === true}
                  onPress={() => setHasSetup(hasSetup === true ? null : true)}
                  compact
                />
              </View>
            </FilterSection>
          </WebVerticalScroll>

          <Pressable style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyBtnText}>Show results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterIconTile({
  label,
  icon,
  selected,
  onPress,
  compact = false,
}: IconTileProps): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  return (
    <Pressable
      style={[compact ? styles.tileCompact : styles.tile, selected && styles.tileSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
        <Ionicons name={icon} size={compact ? 22 : 24} color={selected ? colors.onPrimary : colors.primary} />
      </View>
      <Text
        style={[styles.tileLabel, compact && styles.tileLabelCompact, selected && styles.tileLabelSelected]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function countActiveFeedFilters(input: {
  sort: FeedSort;
  maxPrice: FeedMaxPrice;
  category: ListingCategory | null;
  listingStatus?: FeedListingStatus;
  publishedAfter?: string | null;
  minSellerRating?: number | null;
}): number {
  let n = 0;
  if (input.sort !== 'newest') n += 1;
  if (input.maxPrice !== null) n += 1;
  if (input.category !== null) n += 1;
  if (input.listingStatus === 'sold') n += 1;
  if (input.publishedAfter) n += 1;
  if (input.minSellerRating != null) n += 1;
  return n;
}

export function feedFiltersSummary(input: {
  sort: FeedSort;
  maxPrice: FeedMaxPrice;
  category: ListingCategory | null;
  listingStatus?: FeedListingStatus;
  publishedAfter?: string | null;
  minSellerRating?: number | null;
}): string {
  const parts: string[] = [];
  if (input.sort === 'price_low') parts.push('Price ↑');
  else if (input.sort === 'price_high') parts.push('Price ↓');
  else if (input.sort === 'featured') parts.push('Featured');
  if (input.maxPrice != null) parts.push(`≤ $${input.maxPrice}`);
  if (input.category) parts.push(categoryLabel(input.category));
  if (input.listingStatus === 'sold') parts.push('Sold');
  if (input.publishedAfter) parts.push('Recent');
  if (input.minSellerRating != null) parts.push(`${input.minSellerRating}★+`);
  return parts.join(' · ');
}

const TILE_GAP = spacing.sm;

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { flex: 1 },
  containerDesktop: { justifyContent: 'flex-start' },
  containerBottom: { justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  sheetDesktop: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: WEB_APP_MAX_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sheetBottom: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  reset: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
  scroll: { maxHeight: 480 },
  scrollDesktop: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -TILE_GAP / 2,
  },
  tile: {
    width: '25%',
    paddingHorizontal: TILE_GAP / 2,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tileCompact: {
    flex: 1,
    minWidth: 72,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  tileSelected: {},
  tileRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.billGreenMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tileLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  tileLabelCompact: { fontSize: fontSize.caption, lineHeight: 16 },
  tileLabelSelected: { color: colors.primary, fontWeight: fontWeight.semibold },
  applyBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
}));
