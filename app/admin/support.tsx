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
import { Stack, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/cross-platform-alert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type SupportAdminRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  created_at: string;
  listing_title?: string | null;
};

type QuoteAdminRow = {
  id: string;
  title: string;
  amount_cents: number;
  status: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

export default function AdminSupportScreen(): React.JSX.Element {
  const styles = useStyles();
  const [tab, setTab] = useState<'subs' | 'quotes'>('subs');
  const [subs, setSubs] = useState<SupportAdminRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (tab === 'subs') {
        const { data, error } = await db
          .from('listing_support_subscriptions')
          .select('id, listing_id, buyer_id, seller_id, status, created_at, listings(title)')
          .order('created_at', { ascending: false })
          .limit(80);
        if (error) throw error;
        setSubs(
          ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
            id: row.id as string,
            listing_id: row.listing_id as string,
            buyer_id: row.buyer_id as string,
            seller_id: row.seller_id as string,
            status: row.status as string,
            created_at: row.created_at as string,
            listing_title: (row.listings as { title?: string } | null)?.title ?? null,
          }))
        );
      } else {
        const { data, error } = await db
          .from('support_work_quotes')
          .select('id, title, amount_cents, status, buyer_id, seller_id, created_at')
          .order('created_at', { ascending: false })
          .limit(80);
        if (error) throw error;
        setQuotes((data ?? []) as QuoteAdminRow[]);
      }
    } catch {
      setSubs([]);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const forceCancelSub = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await db
        .from('listing_support_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await load();
      showAlert('Updated', 'Subscription marked canceled. Confirm Stripe portal/webhook sync if needed.');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const cancelQuote = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await db
        .from('support_work_quotes')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await load();
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Support moderation' }} />
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'subs' && styles.tabActive]}
          onPress={() => setTab('subs')}
        >
          <Text style={[styles.tabText, tab === 'subs' && styles.tabTextActive]}>Subscriptions</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'quotes' && styles.tabActive]}
          onPress={() => setTab('quotes')}
        >
          <Text style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}>Quotes</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : tab === 'subs' ? (
        <FlatList
          data={subs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<Text style={styles.hint}>No support subscriptions.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.listing_title ?? item.listing_id}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Text style={styles.meta}>Buyer: {item.buyer_id}</Text>
              <Text style={styles.meta}>Seller: {item.seller_id}</Text>
              {item.status !== 'canceled' ? (
                <Pressable
                  style={styles.btn}
                  disabled={busyId === item.id}
                  onPress={() => void forceCancelSub(item.id)}
                >
                  <Text style={styles.btnText}>Force cancel</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
          ListEmptyComponent={<Text style={styles.hint}>No support quotes.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                ${(item.amount_cents / 100).toFixed(2)} · {item.status}
              </Text>
              <Text style={styles.meta}>Buyer: {item.buyer_id}</Text>
              <Text style={styles.meta}>Seller: {item.seller_id}</Text>
              {!['paid', 'cancelled', 'declined'].includes(item.status) ? (
                <Pressable
                  style={styles.btn}
                  disabled={busyId === item.id}
                  onPress={() => void cancelQuote(item.id)}
                >
                  <Text style={styles.btnText}>Cancel quote</Text>
                </Pressable>
              ) : null}
            </View>
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
      gap: 4,
    },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    meta: { fontSize: fontSize.caption, color: colors.textMuted },
    btn: {
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    btnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.caption },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hint: { textAlign: 'center', color: colors.textMuted },
  })
);
