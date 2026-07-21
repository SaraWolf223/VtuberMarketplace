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
import { useAuth } from '@/hooks/useAuth';
import {
  listMyPendingQuotes,
  respondSupportQuote,
  startSupportQuoteCheckout,
  type SupportQuote,
} from '@/features/support/support-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SupportQuotesScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const [rows, setRows] = useState<SupportQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setRows(await listMyPendingQuotes());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Support quotes' }} />
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
            <Text style={styles.hint}>No open quotes. Sellers send quotes from your subscriptions.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
              <Text style={styles.price}>${(item.amount_cents / 100).toFixed(2)}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              {item.status === 'pending_buyer' ? (
                <View style={styles.row}>
                  <Pressable
                    style={[styles.btn, styles.outline]}
                    disabled={busyId === item.id}
                    onPress={async () => {
                      setBusyId(item.id);
                      try {
                        await respondSupportQuote(item.id, false);
                        await load();
                      } catch (e) {
                        showAlert('Error', e instanceof Error ? e.message : 'Decline failed');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    <Text style={styles.outlineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.primary]}
                    disabled={busyId === item.id}
                    onPress={async () => {
                      setBusyId(item.id);
                      try {
                        await respondSupportQuote(item.id, true);
                        await startSupportQuoteCheckout(item.id);
                        await load();
                      } catch (e) {
                        showAlert('Error', e instanceof Error ? e.message : 'Accept failed');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.primaryText}>Accept & pay</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
              {item.status === 'accepted' ? (
                <Pressable
                  style={[styles.btn, styles.primary]}
                  disabled={busyId === item.id}
                  onPress={async () => {
                    setBusyId(item.id);
                    try {
                      await startSupportQuoteCheckout(item.id);
                    } catch (e) {
                      showAlert('Error', e instanceof Error ? e.message : 'Checkout failed');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  <Text style={styles.primaryText}>Pay now</Text>
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
    price: { fontSize: fontSize.priceSm, fontWeight: fontWeight.bold, color: colors.primary, marginTop: 4 },
    meta: { fontSize: fontSize.caption, color: colors.textMuted },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    btn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    primary: { backgroundColor: colors.primary },
    primaryText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    outline: { borderWidth: 1, borderColor: colors.border },
    outlineText: { color: colors.text, fontWeight: fontWeight.semibold },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' },
  })
);
