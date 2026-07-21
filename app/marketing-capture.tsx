/**
 * Staged feed for marketing screenshots (real ListingCard UI + example photos).
 * Open on device/simulator/web: /marketing-capture
 */
import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedGridListingRow } from '@/components/feed/FeedGridListingRow';
import { FeedGridMixedRow } from '@/components/feed/FeedGridMixedRow';
import { WebAppLogo } from '@/components/web/WebAppLogo';
import { buildFeedGridRows } from '@/features/feed/feed-grid';
import { MARKETING_FEED_LISTINGS } from '@/features/marketing/marketing-feed-listings';
import { useWebViewport } from '@/hooks/useWebViewport';
import { WEB_APP_MAX_WIDTH } from '@/constants/feed-layout';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const CAPTURE_WIDTH = 390;

export default function MarketingCaptureScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isDesktopWeb, feedColumns, webFeedLayout } = useWebViewport();
  const isNative = Platform.OS !== 'web';
  const gridRows = buildFeedGridRows(MARKETING_FEED_LISTINGS, feedColumns, webFeedLayout).filter(
    (row) => row.type === 'mixed-row' || row.type === 'listing-row'
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.safe, isDesktopWeb ? styles.safeDesktop : styles.safeMobile]}
        edges={['top']}
      >
        <View
          style={[
            styles.frame,
            isDesktopWeb ? styles.frameDesktop : styles.frameMobile,
            isNative && styles.frameNative,
          ]}
          nativeID="marketing-capture-root"
          testID="marketing-capture-root"
          accessibilityLabel="Marketing feed capture"
        >
          {isDesktopWeb ? (
            <View style={styles.webHeader}>
              <View style={styles.webHeaderRow}>
                <WebAppLogo prominent />
                <View style={styles.locationFake}>
                  <Ionicons name="location-outline" size={18} color={colors.text} />
                  <Text style={styles.locationFakeText}>Near 10001 · 12 mi</Text>
                </View>
                <View style={styles.searchFakeWide}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.searchPlaceholder}>Search for sale</Text>
                </View>
                <View style={styles.postFake}>
                  <Ionicons name="add" size={18} color={colors.onPrimary} />
                  <Text style={styles.postFakeText}>Post</Text>
                </View>
                <View style={styles.iconNavMock}>
                  <Ionicons name="heart-outline" size={22} color={colors.textSecondary} />
                  <Ionicons name="chatbubble-outline" size={21} color={colors.textSecondary} />
                  <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                  <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryMock}>
                {['All', 'Electronics', 'Gaming', 'Furniture', 'Home', 'Toys'].map((label, i) => (
                  <View key={label} style={[styles.categoryChip, i === 0 && styles.categoryChipActive]}>
                    <Text style={i === 0 ? styles.categoryChipTextActive : styles.categoryChipText}>{label}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.screenHeader}>
              <Text style={styles.locationHeader}>Near 10001 · 12 mi</Text>
            </View>
          )}
          <View style={styles.filtersWrap}>
            {isDesktopWeb ? (
              <View style={styles.webFilterRow}>
                <View style={styles.filterFake}>
                  <Text style={styles.filterText}>Filters</Text>
                </View>
                <Text style={styles.webFilterHint}>Refine by category, price, distance, and more</Text>
              </View>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <View style={styles.searchFake}>
                    <Text style={styles.searchPlaceholder}>Search listings…</Text>
                  </View>
                  <View style={styles.filterFake}>
                    <Text style={styles.filterText}>Filters</Text>
                  </View>
                </View>
                <Text style={styles.filterSummary}>12 mi</Text>
              </>
            )}
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              isDesktopWeb && styles.scrollContentDesktop,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {gridRows.map((row) => {
              if (row.type === 'mixed-row') {
                return (
                  <FeedGridMixedRow
                    key={row.key}
                    cells={row.cells}
                    isFavorited={() => false}
                    pendingFavoriteId={null}
                    onToggleFavorite={() => {}}
                    favoritePending={false}
                  />
                );
              }
              if (row.type === 'listing-row') {
                return (
                  <FeedGridListingRow
                    key={row.key}
                    items={row.items}
                    isFavorited={() => false}
                    pendingFavoriteId={null}
                    onToggleFavorite={() => {}}
                    favoritePending={false}
                  />
                );
              }
              return null;
            })}
          </ScrollView>
          {!isDesktopWeb ? (
            <View style={styles.tabBar}>
              {(['Home', 'Post Ad', 'Favorites', 'Activity', 'Profile'] as const).map((label, i) => (
                <View key={label} style={styles.tabItem}>
                  <View style={[styles.tabDot, i === 0 && styles.tabDotActive]} />
                  <Text style={[styles.tabLabel, i === 0 && styles.tabLabelActive]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
    },
    safeDesktop: {
      backgroundColor: colors.background,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      padding: 0,
    },
    safeMobile: {
      backgroundColor: '#1a1a1a',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
    },
    frame: {
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    frameDesktop: {
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
      flex: 1,
      alignSelf: 'center',
      borderRadius: 0,
      borderWidth: 0,
    },
    frameMobile: {
      width: CAPTURE_WIDTH,
      maxWidth: '100%',
      flex: 1,
      maxHeight: Platform.OS === 'web' ? 844 : undefined,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
    },
    frameNative: {
      maxHeight: undefined,
    },
    webHeader: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    webHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    logo: { width: 36, height: 36 },
    brandText: {
      fontSize: fontSize.h2,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    locationFake: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    locationFakeText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    searchFakeWide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      backgroundColor: colors.background,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    postFake: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    postFakeText: {
      color: colors.onPrimary,
      fontWeight: fontWeight.semibold,
      fontSize: fontSize.body,
    },
    iconNavMock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 0,
    },
    webNavRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: spacing.sm,
    },
    categoryMock: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    categoryChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.priceBackground,
    },
    categoryChipText: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
    },
    categoryChipTextActive: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    webNav: {
      fontSize: fontSize.body,
      color: colors.textSecondary,
    },
    webNavActive: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    webFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    webFilterHint: {
      flex: 1,
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    screenHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
    },
    locationHeader: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    filtersWrap: {
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
    },
    searchRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    searchFake: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    searchPlaceholder: {
      fontSize: fontSize.body,
      color: colors.textMuted,
    },
    filterFake: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    filterSummary: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
      paddingHorizontal: spacing.xs,
    },
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    scrollContentDesktop: {
      paddingHorizontal: spacing.lg,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.tabBarBorder,
      backgroundColor: colors.tabBar,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    tabDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
    },
    tabDotActive: {
      backgroundColor: colors.primary,
    },
    tabLabel: {
      fontSize: 10,
      color: colors.textMuted,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
  })
);
