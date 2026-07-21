import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  total_cents: number;
  deliverable_url?: string | null;
  download_url?: string | null;
  listing_title?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function LibraryOrdersScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn, user } = useAuth();
  const [tab, setTab] = useState<'purchases' | 'sales'>('purchases');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliverableDraft, setDeliverableDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const col = tab === 'purchases' ? 'buyer_id' : 'seller_id';
      const { data, error } = await db
        .from('orders')
        .select('id, listing_id, buyer_id, seller_id, status, total_cents, listings(title, download_url), order_deliverables(deliverable_url)')
        .eq(col, user.id)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      setRows(
        ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
          const listing = row.listings as { title?: string; download_url?: string } | null;
          const dels = row.order_deliverables as Array<{ deliverable_url?: string }> | null;
          return {
            id: row.id as string,
            listing_id: row.listing_id as string,
            buyer_id: row.buyer_id as string,
            seller_id: row.seller_id as string,
            status: row.status as string,
            total_cents: row.total_cents as number,
            listing_title: listing?.title ?? null,
            download_url: listing?.download_url ?? null,
            deliverable_url: dels?.[0]?.deliverable_url ?? null,
          };
        })
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Sign in to view your library.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Orders & downloads' }} />
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'purchases' && styles.tabActive]}
          onPress={() => setTab('purchases')}
        >
          <Text style={[styles.tabText, tab === 'purchases' && styles.tabTextActive]}>
            Purchases
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'sales' && styles.tabActive]}
          onPress={() => setTab('sales')}
        >
          <Text style={[styles.tabText, tab === 'sales' && styles.tabTextActive]}>Sales</Text>
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
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={
            <Text style={styles.hint}>
              {tab === 'purchases'
                ? 'No purchases yet. Buy a listing to see download links here.'
                : 'No sales yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const link = item.deliverable_url || item.download_url;
            return (
              <View style={styles.card}>
                <Text style={styles.title}>{item.listing_title ?? 'Listing'}</Text>
                <Text style={styles.meta}>
                  ${(item.total_cents / 100).toFixed(2)} · {item.status}
                </Text>
                {tab === 'purchases' && link && item.status === 'fulfilled' ? (
                  <Pressable
                    style={styles.btn}
                    onPress={() => void Linking.openURL(link)}
                  >
                    <Text style={styles.btnText}>Open download link</Text>
                  </Pressable>
                ) : null}
                {tab === 'sales' &&
                (item.status === 'awaiting_fulfillment' || item.status === 'paid') ? (
                  <View style={styles.fulfill}>
                    <TextInput
                      style={styles.input}
                      value={deliverableDraft[item.id] ?? ''}
                      onChangeText={(t) =>
                        setDeliverableDraft((d) => ({ ...d, [item.id]: t }))
                      }
                      placeholder="https://… deliverable link"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                    <Pressable
                      style={styles.btn}
                      disabled={busyId === item.id}
                      onPress={async () => {
                        const url = (deliverableDraft[item.id] ?? '').trim();
                        if (!/^https?:\/\//i.test(url)) {
                          showAlert('Link', 'Enter an http(s) deliverable URL.');
                          return;
                        }
                        setBusyId(item.id);
                        try {
                          const { data, error } = await supabase.functions.invoke(
                            'submit-order-deliverable',
                            { body: { order_id: item.id, deliverable_url: url } }
                          );
                          if (error) throw error;
                          const payload = data as { ok?: boolean; error?: { message?: string } };
                          if (!payload?.ok) {
                            throw new Error(payload?.error?.message ?? 'Submit failed');
                          }
                          showAlert('Submitted', 'Buyer can open the deliverable link.');
                          await load();
                        } catch (e) {
                          showAlert('Error', e instanceof Error ? e.message : 'Submit failed');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      <Text style={styles.btnText}>Submit deliverable</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
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
    tabText: { fontSize: fontSize.caption, color: colors.text },
    tabTextActive: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    list: { padding: spacing.md, paddingBottom: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: 6,
    },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    meta: { fontSize: fontSize.caption, color: colors.textMuted },
    btn: {
      marginTop: 4,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    btnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
    fulfill: { gap: spacing.sm, marginTop: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    hint: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.caption },
  })
);
