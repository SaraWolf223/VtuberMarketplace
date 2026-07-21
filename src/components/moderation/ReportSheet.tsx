import { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import {
  submitReport,
  REPORT_REASONS,
  type ReportReason,
} from '@/features/moderation/moderation-service';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props =
  | {
      visible: boolean;
      onClose: () => void;
      accessToken: string;
      targetType: 'listing';
      listingId: string;
      title?: string;
    }
  | {
      visible: boolean;
      onClose: () => void;
      accessToken: string;
      targetType: 'user';
      reportedUserId: string;
      title?: string;
    };

export function ReportSheet(props: Props): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const safeBottom = useSafeBottomPadding();
  const { visible, onClose, accessToken, title } = props;
  const [reason, setReason] = useState<ReportReason>('misleading');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) return;
    setReason('misleading');
    setDetails('');
  }, [visible]);

  const heading =
    title ?? (props.targetType === 'listing' ? 'Report listing' : 'Report user');

  const submit = async () => {
    setSubmitting(true);
    try {
      const result =
        props.targetType === 'listing'
          ? await submitReport(accessToken, {
              target_type: 'listing',
              listing_id: props.listingId,
              reason,
              details,
            })
          : await submitReport(accessToken, {
              target_type: 'user',
              reported_user_id: props.reportedUserId,
              reason,
              details,
            });

      const extra = result.listing_paused
        ? ' This listing was paused for review.'
        : '';
      Alert.alert('Report sent', `Thanks — our team will review it.${extra}`);
      onClose();
      setDetails('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.sub}>What is the issue?</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.reason, reason === r.id && styles.reasonActive]}
              onPress={() => setReason(r.id)}
            >
              <Text style={[styles.reasonText, reason === r.id && styles.reasonTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
          <TextInput
            style={styles.input}
            placeholder="Optional details"
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={500}
          />
          <Pressable style={styles.submit} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitText}>Submit report</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  title: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  sub: { fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.md },
  reason: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  reasonActive: { borderColor: colors.primary, backgroundColor: colors.priceBackground },
  reasonText: { color: colors.text },
  reasonTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    marginTop: spacing.md,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
    color: colors.text,
  },
  submit: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.textSecondary },
}));
