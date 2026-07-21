import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { startConnectOnboarding } from '@/features/orders/order-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function PayoutsSettingsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { isSignedIn } = useAuth();
  const { data: profile } = useProfile();
  const [busy, setBusy] = useState(false);

  const p = profile as {
    stripe_charges_enabled?: boolean | null;
    stripe_payouts_enabled?: boolean | null;
    phone_verified_at?: string | null;
  } | null;

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Sign in to manage payouts.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Seller payouts' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Stripe Connect</Text>
        <Text style={styles.hint}>
          Sellers receive payouts via Stripe Connect Express. Publishing requires charges + payouts
          enabled and a verified phone number.
        </Text>
        <Text style={styles.meta}>
          Charges: {p?.stripe_charges_enabled ? 'Enabled' : 'Not ready'}
        </Text>
        <Text style={styles.meta}>
          Payouts: {p?.stripe_payouts_enabled ? 'Enabled' : 'Not ready'}
        </Text>
        <Text style={styles.meta}>
          Phone: {p?.phone_verified_at ? 'Verified' : 'Not verified (Settings → Verify phone)'}
        </Text>
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await startConnectOnboarding();
            } catch (e) {
              showAlert('Stripe', e instanceof Error ? e.message : 'Could not open onboarding');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Open Stripe Connect</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.sm },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 18 },
    meta: { fontSize: fontSize.caption, color: colors.text },
    button: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  })
);
