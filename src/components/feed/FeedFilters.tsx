import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import { useWebViewport } from '@/hooks/useWebViewport';
import {
  FeedFiltersSheet,
  countActiveFeedFilters,
  feedFiltersSummary,
} from '@/components/feed/FeedFiltersSheet';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest',
  price_low: 'Price ↑',
  price_high: 'Price ↓',
  featured: 'Featured',
};

function FilterPill({
  label,
  icon,
  active,
  badge,
  onPress,
  styles,
  colors,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  badge?: number;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
  colors: ReturnType<typeof useThemeColors>;
}): React.JSX.Element {
  const accent = active ? colors.primary : colors.textSecondary;
  return (
    <Pressable
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={16} color={accent} /> : null}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-down" size={14} color={active ? colors.primary : colors.textMuted} />
      )}
    </Pressable>
  );
}

export function FeedFilters(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    category,
    maxPrice,
    sort,
    search,
    setSearch,
    listingStatus,
    publishedAfter,
    minSellerRating,
  } = useFeedFiltersStore();
  const { isDesktopWeb } = useWebViewport();

  const activeCount = countActiveFeedFilters({
    sort,
    maxPrice,
    category,
    listingStatus,
    publishedAfter,
    minSellerRating,
  });
  const summary = feedFiltersSummary({
    sort,
    maxPrice,
    category,
    listingStatus,
    publishedAfter,
    minSellerRating,
  });

  return (
    <View style={styles.wrap} testID="feed-filters-bar">
      {Platform.OS !== 'web' || !isDesktopWeb ? (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Search VTuber assets…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <Pressable
            style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open filters"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeCount > 0 ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.filterBtnText, activeCount > 0 && styles.filterBtnTextActive]}>
              Filters
            </Text>
            {activeCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : (
        <View style={styles.webToolbar}>
          <FilterPill
            label="All filters"
            icon="options-outline"
            active={activeCount > 0}
            badge={activeCount}
            onPress={() => setSheetOpen(true)}
            styles={styles}
            colors={colors}
          />
          <FilterPill
            label={SORT_LABELS[sort] ?? 'Sort'}
            active={sort !== 'newest'}
            onPress={() => setSheetOpen(true)}
            styles={styles}
            colors={colors}
          />
          <FilterPill
            label={maxPrice != null ? `Under $${maxPrice}` : 'Price'}
            active={maxPrice != null}
            onPress={() => setSheetOpen(true)}
            styles={styles}
            colors={colors}
          />
          <FilterPill
            label={minSellerRating != null ? `${minSellerRating}★+` : 'Rating'}
            icon="star-outline"
            active={minSellerRating != null}
            onPress={() => setSheetOpen(true)}
            styles={styles}
            colors={colors}
          />
          {listingStatus === 'sold' ? (
            <FilterPill
              label="Sold"
              active
              onPress={() => setSheetOpen(true)}
              styles={styles}
              colors={colors}
            />
          ) : null}
        </View>
      )}

      {summary && (Platform.OS !== 'web' || !isDesktopWeb) ? (
        <Pressable onPress={() => setSheetOpen(true)} style={styles.summaryWrap}>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </Pressable>
      ) : null}

      <FeedFiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    search: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: fontSize.body,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
    },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.priceBackground },
    filterBtnText: { fontSize: fontSize.caption, color: colors.textSecondary, fontWeight: fontWeight.semibold },
    filterBtnTextActive: { color: colors.primary },
    webToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surface,
    },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.priceBackground },
    pillText: { fontSize: fontSize.caption, color: colors.textSecondary },
    pillTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: fontWeight.bold },
    summaryWrap: { paddingBottom: spacing.xs },
    summary: { fontSize: fontSize.caption, color: colors.textMuted },
  })
);
