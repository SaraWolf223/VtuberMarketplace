import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeedFiltersStore } from '@/stores/feed-filters-store';
import type { FeedSort } from '@/types/feed';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const OPTIONS: { id: FeedSort; label: string }[] = [
  { id: 'newest', label: 'Recent first' },
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
  { id: 'featured', label: 'Featured first' },
];

/** OfferUp-style "Sort by" dropdown shown at the top-right of the desktop feed. */
export function WebSortDropdown(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const { sort, setSort } = useFeedFiltersStore();
  const current = OPTIONS.find((o) => o.id === sort) ?? OPTIONS[0];

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Sort listings"
      >
        <Text style={styles.label}>
          Sort by: <Text style={styles.value}>{current.label}</Text>
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <>
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close sort menu"
          />
          <View style={styles.menu}>
            {OPTIONS.map((o) => {
              const active = o.id === sort;
              return (
                <Pressable
                  key={o.id}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => {
                    setSort(o.id);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>{o.label}</Text>
                  {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    wrap: {
      position: 'relative',
      zIndex: 20,
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    label: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
    },
    value: {
      color: colors.text,
      fontWeight: fontWeight.semibold,
    },
    backdrop: {
      ...(Platform.OS === 'web'
        ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as object)
        : StyleSheet.absoluteFill),
    },
    menu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: spacing.xs,
      minWidth: 200,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.xs,
      zIndex: 30,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as object)
        : {}),
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    itemActive: {
      backgroundColor: colors.priceBackground,
    },
    itemText: {
      fontSize: fontSize.body,
      color: colors.text,
    },
    itemTextActive: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
  })
);
