import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  listMySupportSubscriptions,
  listSellerSupportSubscriptions,
  type SupportSubscriptionRow,
} from '@/features/support/support-service';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

export default function SupportSubscriptionsScreen(): React.JSX.Element {
  const styles = useStyles();
  const { isSignedIn, user } = useAuth();
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const [rows, setRows] = useState<SupportSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const data =
        tab === 'buyer'
          ? await listMySupportSubscriptions()
          : await listSellerSupportSubscriptions();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn, tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Sign in to view support subscriptions.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Support subscriptions' }} />
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'buyer' && styles.tabActive]}
          onPress={() => setTab('buyer')}
        >
          <Text style={[styles.tabText, tab === 'buyer' && styles.tabTextActive]}>
            My subscriptions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'seller' && styles.tabActive]}
          onPress={() => setTab('seller')}
        >
          <Text style={[styles.tabText, tab === 'seller' && styles.tabTextActive]}>
            Subscribers
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.hint}>
              {tab === 'buyer'
                ? 'No active support subscriptions yet. Purchase a model, then subscribe from the listing.'
                : 'No subscribers yet. Enable a support plan on an eligible listing.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/listing/${item.listing_id}`)}
            >
              <Text style={styles.title} numberOfLines={2}>
                {item.listing_title ?? 'Listing'}
              </Text>
              <Text style={styles.meta}>
                Status: {item.status}
                {item.price_cents_month != null
                  ? ` · ${formatCents(item.price_cents_month)}`
                  : ''}
              </Text>
              {tab === 'seller' && item.buyer_display_name ? (
                <Text style={styles.meta}>Buyer: {item.buyer_display_name}</Text>
              ) : null}
              {user && tab === 'seller' ? (
                <Pressable
                  style={styles.quoteBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/library/support-quote',
                      params: { subscriptionId: item.id },
                    })
                  }
                >
                  <Text style={styles.quoteBtnText}>Create work quote</Text>
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: fontSize.caption, color: colors.text, fontWeight: fontWeight.semibold },
    tabTextActive: { color: colors.onPrimary },
    list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 4 },
    quoteBtn: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
    },
    quoteBtnText: { color: colors.onPrimary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' },
  })
);
