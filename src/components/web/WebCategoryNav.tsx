import { Pressable, Text, StyleSheet } from 'react-native';
import { WebHorizontalScroll } from '@/components/web/WebHorizontalScroll';
import type { ListingCategory } from '@/types/enums';
import { useListingCategories } from '@/hooks/useListingCategories';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

/** OfferUp-style horizontal category strip under the search bar. */
export function WebCategoryNav(): React.JSX.Element {
  const styles = useStyles();
  const { category, setCategory } = useFeedFiltersStore();
  const listingCategories = useListingCategories();

  const chips: { id: ListingCategory | null; label: string }[] = [
    { id: null, label: 'All' },
    ...listingCategories.map((c) => ({ id: c.slug, label: c.label })),
  ];

  return (
    <WebHorizontalScroll
      contentContainerStyle={styles.content}
      style={styles.scroll}
      testID="web-category-nav"
    >
      {chips.map((chip) => {
        const active = category === chip.id;
        return (
          <Pressable
            key={chip.label}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => setCategory(chip.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </WebHorizontalScroll>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    scroll: {
      width: '100%',
      paddingBottom: spacing.sm,
    },
    content: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      paddingRight: spacing.md,
    },
    chip: {
      flexShrink: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.text,
      backgroundColor: colors.text,
    },
    chipText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.surface,
      fontWeight: fontWeight.semibold,
    },
  })
);
