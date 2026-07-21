import { useState } from 'react';
import {
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePhoneVerificationGate } from '@/hooks/usePhoneVerificationGate';
import { isPhoneVerified } from '@/hooks/usePhoneVerification';
import { redeemPromoCode } from '@/features/admin/admin-service';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

export default function RedeemPromoScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { session, user } = useAuth();
  const { data: profile } = useProfile();
  const { requireVerification } = usePhoneVerificationGate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const redeem = async () => {
    const token = session?.access_token;
    if (!token) {
      Alert.alert('Sign in', 'Sign in to redeem a promo code.');
      return;
    }

    if (!requireVerification('Redeeming a promo code')) {
      return;
    }

    const normalized = code.trim();
    if (!normalized) {
      Alert.alert('Code required', 'Enter your promo code.');
      return;
    }

    if (redeeming) return;

    setRedeeming(true);
    try {
      const result = await redeemPromoCode(token, normalized);
      if (user?.id) {
        await queryClient.refetchQueries({ queryKey: queryKeys.profile(user.id) });
        await queryClient.refetchQueries({ queryKey: queryKeys.sellerBenefits(user.id) });
      }
      Alert.alert('Redeemed', result.message, [
        {
          text:
            result.type === 'free_premium_month'
              ? 'View Premium'
              : result.type === 'founding_seller'
                ? 'My listings'
                : 'OK',
          onPress: () => {
            if (result.type === 'free_premium_month') {
              router.push('/settings/premium');
            } else if (result.type === 'founding_seller') {
              router.push('/my-listings');
            }
          },
        },
      ]);
      setCode('');
    } catch (e) {
      Alert.alert('Could not redeem', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Redeem promo code</Text>
      <Text style={styles.hint}>
        Each code works once per account. Founding Seller and free Premium promos are one per
        account.
        {profile && !isPhoneVerified(profile)
          ? ' Verify your phone before redeeming.'
          : ''}
      </Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="PROMO-CODE"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Pressable
        style={[styles.button, redeeming && styles.buttonDisabled]}
        onPress={() => void redeem()}
        disabled={redeeming}
      >
        {redeeming ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Redeem</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  hint: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.h2,
    letterSpacing: 2,
    backgroundColor: colors.surface,
    textAlign: 'center',
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.body },
}));
