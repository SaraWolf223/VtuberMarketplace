import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { isPremiumActive } from '@/features/monetization/premium-service';
import {
  createSellerPromoCode,
  upsertListingSale,
} from '@/features/sales/seller-discount-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SellerDiscountsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { data: profile } = useProfile();
  const pro =
    !!profile &&
    (Boolean((profile as { is_pro_seller?: boolean }).is_pro_seller) ||
      isPremiumActive(!!profile.is_premium, profile.premium_until));

  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('10');
  const [listingId, setListingId] = useState('');
  const [salePercent, setSalePercent] = useState('15');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Sign in to manage discounts.</Text>
      </View>
    );
  }

  if (!pro) {
    return (
      <>
        <Stack.Screen options={{ title: 'Promo codes & sales' }} />
        <View style={styles.center}>
          <Text style={styles.hint}>
            Promo codes and timed listing sales are Pro Seller only. Upgrade under Settings → Pro
            Seller.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Promo codes & sales' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Seller promo code</Text>
        <Text style={styles.hint}>Buyers redeem at checkout. Percent off your listings.</Text>
        <Text style={styles.label}>Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="SUMMER10"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Percent off</Text>
        <TextInput
          style={styles.input}
          value={percent}
          onChangeText={setPercent}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={async () => {
            const pct = Number(percent);
            if (!code.trim() || !Number.isFinite(pct) || pct <= 0 || pct >= 100) {
              showAlert('Promo', 'Enter a code and a percent between 1 and 99.');
              return;
            }
            setBusy(true);
            try {
              await createSellerPromoCode({
                code: code.trim().toUpperCase(),
                type: 'percent_off',
                value: pct,
              });
              showAlert('Created', 'Promo code is ready for buyers.');
              setCode('');
            } catch (e) {
              showAlert('Error', e instanceof Error ? e.message : 'Could not create promo');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Create promo code</Text>
          )}
        </Pressable>

        <Text style={[styles.section, { marginTop: spacing.lg }]}>Timed listing sale</Text>
        <Text style={styles.hint}>Put one listing on sale for a date range (effective price in feed).</Text>
        <Text style={styles.label}>Listing ID</Text>
        <TextInput
          style={styles.input}
          value={listingId}
          onChangeText={setListingId}
          autoCapitalize="none"
          placeholder="UUID from My listings"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Percent off</Text>
        <TextInput
          style={styles.input}
          value={salePercent}
          onChangeText={setSalePercent}
          keyboardType="number-pad"
          placeholder="15"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Duration (days)</Text>
        <TextInput
          style={styles.input}
          value={days}
          onChangeText={setDays}
          keyboardType="number-pad"
          placeholder="7"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={async () => {
            const pct = Number(salePercent);
            const d = Number(days);
            if (!listingId.trim() || !Number.isFinite(pct) || pct <= 0 || pct >= 100 || !Number.isFinite(d) || d < 1) {
              showAlert('Sale', 'Enter listing ID, percent 1–99, and days ≥ 1.');
              return;
            }
            const ends = new Date();
            ends.setDate(ends.getDate() + Math.floor(d));
            setBusy(true);
            try {
              const result = await upsertListingSale({
                listing_id: listingId.trim(),
                percent_off: pct,
                ends_at: ends.toISOString(),
              });
              showAlert(
                'Sale live',
                `Effective price: $${(result.effective_price_cents / 100).toFixed(2)}`
              );
            } catch (e) {
              showAlert('Error', e instanceof Error ? e.message : 'Could not create sale');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={styles.buttonText}>Put listing on sale</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    section: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
    label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    button: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 18 },
  })
);
