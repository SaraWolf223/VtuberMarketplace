import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
  sellerName: string;
  onSubmit: (rating: number, body?: string) => Promise<void>;
};

const STARS = [1, 2, 3, 4, 5] as const;

export function ReviewModal({
  visible,
  onClose,
  sellerName,
  onSubmit,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const safeBottom = useSafeBottomPadding();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setRating(0);
    setBody('');
  };

  const submit = async () => {
    if (rating < 1) {
      Alert.alert('Rating', 'Tap 1–5 stars to rate this seller.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, body.trim() || undefined);
      reset();
      onClose();
      Alert.alert('Thanks', 'Your review was submitted.');
    } catch (e) {
      Alert.alert('Review', e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
        <Text style={styles.title}>Rate {sellerName}</Text>
        <Text style={styles.sub}>How was your purchase experience?</Text>

        <View style={styles.stars}>
          {STARS.map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} style={styles.starBtn}>
              <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Optional comment (300 chars max)"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />

        <Pressable style={styles.submit} onPress={submit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>Submit review</Text>
          )}
        </Pressable>
        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.caption, color: colors.textSecondary },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  starBtn: { padding: spacing.xs },
  star: { fontSize: 36, color: colors.border },
  starOn: { color: colors.warning },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 88,
    fontSize: fontSize.body,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  submit: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.textSecondary },
}));
