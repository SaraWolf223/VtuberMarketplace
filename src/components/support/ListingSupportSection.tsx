import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import {
  canSubscribe,
  fetchSupportPlan,
  startSupportSubscriptionCheckout,
  upsertSupportPlan,
  type SupportPlan,
} from '@/features/support/support-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  listingId: string;
  isOwner: boolean;
  assetType?: string | null;
  category?: string | null;
};

function isSupportEligible(assetType?: string | null, category?: string | null): boolean {
  return (
    assetType === 'live2d_2d' ||
    assetType === 'model_3d' ||
    category === 'vrchat'
  );
}

export function ListingSupportSection({
  listingId,
  isOwner,
  assetType,
  category,
}: Props): React.JSX.Element | null {
  const styles = useStyles();
  const colors = useThemeColors();
  const eligible = isSupportEligible(assetType, category);
  const [plan, setPlan] = useState<SupportPlan | null>(null);
  const [elig, setElig] = useState<{
    ok: boolean;
    error?: string;
    price_cents_month?: number;
    offerings_text?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [priceText, setPriceText] = useState('9.99');
  const [offerings, setOfferings] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!eligible) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchSupportPlan(listingId);
        if (cancelled) return;
        setPlan(p);
        if (p) {
          setPriceText((p.price_cents_month / 100).toFixed(2));
          setOfferings(p.offerings_text);
          setActive(p.active);
        }
        if (!isOwner) {
          const c = await canSubscribe(listingId);
          if (!cancelled) setElig(c);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId, isOwner, eligible]);

  if (!eligible) return null;
  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isOwner) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Monthly model support</Text>
        <Text style={styles.hint}>
          Purchasers can subscribe for ongoing support, updates, or extra assets. Platform fee
          applies via Stripe Connect.
        </Text>
        <Text style={styles.label}>Price / month (USD)</Text>
        <TextInput
          style={styles.input}
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          placeholder="9.99"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>What&apos;s included</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={offerings}
          onChangeText={setOfferings}
          multiline
          placeholder="Bugfixes, clothing assets, stream overlays…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={styles.secondary}
          onPress={() => setActive((v) => !v)}
        >
          <Text style={styles.secondaryText}>{active ? 'Plan: Active' : 'Plan: Inactive'}</Text>
        </Pressable>
        <Pressable
          style={styles.primary}
          disabled={busy}
          onPress={async () => {
            const dollars = Number(priceText);
            if (!Number.isFinite(dollars) || dollars <= 0) {
              showAlert('Price', 'Enter a price greater than $0.');
              return;
            }
            if (offerings.trim().length < 8) {
              showAlert('Offerings', 'Describe what monthly support includes.');
              return;
            }
            setBusy(true);
            try {
              const saved = await upsertSupportPlan({
                listing_id: listingId,
                price_cents_month: Math.round(dollars * 100),
                offerings_text: offerings.trim(),
                active,
              });
              setPlan(saved);
              showAlert('Saved', 'Support plan updated.');
            } catch (e) {
              showAlert('Error', e instanceof Error ? e.message : 'Could not save plan');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>{plan ? 'Update support plan' : 'Enable support plan'}</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (!plan?.active && !elig?.ok) return null;

  const priceCents = elig?.price_cents_month ?? plan?.price_cents_month;
  const text = elig?.offerings_text ?? plan?.offerings_text;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Monthly model support</Text>
      {priceCents != null ? (
        <Text style={styles.price}>${(priceCents / 100).toFixed(2)}/month</Text>
      ) : null}
      {text ? <Text style={styles.offerings}>{text}</Text> : null}
      {elig?.ok ? (
        <Pressable
          style={styles.primary}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await startSupportSubscriptionCheckout(listingId);
            } catch (e) {
              showAlert('Checkout', e instanceof Error ? e.message : 'Could not start checkout');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Subscribe</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.hint}>
          {elig?.error === 'NOT_PURCHASER'
            ? 'Only buyers with a completed purchase of this listing can subscribe.'
            : elig?.error === 'ALREADY_SUBSCRIBED'
              ? 'You already have an active support subscription.'
              : 'Support subscription is not available right now.'}
        </Text>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    box: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.semibold, color: colors.text },
    price: { fontSize: fontSize.priceSm, fontWeight: fontWeight.bold, color: colors.primary },
    offerings: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 20 },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 18 },
    label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
      backgroundColor: colors.background,
    },
    textarea: { minHeight: 80, textAlignVertical: 'top' },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    primaryText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    secondary: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    secondaryText: { color: colors.text, fontWeight: fontWeight.semibold },
  })
);
