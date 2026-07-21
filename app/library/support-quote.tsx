import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { createSupportQuote } from '@/features/support/support-service';
import { showAlert } from '@/lib/cross-platform-alert';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SupportQuoteScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const { subscriptionId } = useLocalSearchParams<{ subscriptionId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!subscriptionId) {
      showAlert('Error', 'Missing subscription.');
      return;
    }
    const dollars = Number(amount);
    if (!title.trim()) {
      showAlert('Title', 'Add a short title for the work.');
      return;
    }
    if (!Number.isFinite(dollars) || dollars <= 0) {
      showAlert('Amount', 'Enter an amount greater than $0.');
      return;
    }
    setBusy(true);
    try {
      await createSupportQuote({
        subscription_id: subscriptionId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount_cents: Math.round(dollars * 100),
      });
      showAlert('Quote sent', 'The buyer can accept and pay from their subscriptions.');
      router.back();
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not create quote');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Work quote' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Formal quote for extra work under an active support subscription. Buyer accepts, then pays
          via Stripe (platform fee applies). Informal negotiation can stay in DMs.
        </Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="New clothing set"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Scope of work…"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="25.00"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Send quote to buyer</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    hint: { fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 18 },
    label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    textarea: { minHeight: 100, textAlignVertical: 'top' },
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
