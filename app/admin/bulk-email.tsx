import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  adminQueryErrorMessage,
  fetchEmailCampaigns,
  previewBulkEmail,
  sendBulkEmail,
} from '@/features/admin/admin-service';
import type { BulkEmailAudience } from '@/features/admin/admin-types';
import { AdminErrorBanner } from '@/components/admin/AdminErrorBanner';
import { queryKeys } from '@/lib/query-keys';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

const AUDIENCES: { id: BulkEmailAudience; label: string; hint: string }[] = [
  {
    id: 'waitlist',
    label: 'Android waitlist',
    hint: 'Landing page signups with founding codes — Android launch updates.',
  },
  {
    id: 'ios_waitlist',
    label: 'iPhone waitlist',
    hint: 'iOS waitlist emails only — App Store launch and TestFlight news.',
  },
  {
    id: 'users',
    label: 'Registered users',
    hint: 'All non-banned accounts — product updates and promotions.',
  },
];

function audienceLabel(audience: BulkEmailAudience): string {
  if (audience === 'waitlist') return 'Android waitlist';
  if (audience === 'ios_waitlist') return 'iPhone waitlist';
  return 'registered user';
}

export default function AdminBulkEmailScreen(): React.JSX.Element {
  const styles = useStyles();
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const colors = useThemeColors();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const queryClient = useQueryClient();

  const [audience, setAudience] = useState<BulkEmailAudience>('waitlist');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const campaignsQuery = useQuery({
    queryKey: queryKeys.adminEmailCampaigns,
    enabled: !!token,
    queryFn: () => fetchEmailCampaigns(token),
  });

  const handlePreview = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Enter a subject and message body first.');
      return;
    }
    setPreviewing(true);
    try {
      const result = await previewBulkEmail(token, audience, subject.trim(), body.trim());
      setPreviewCount(result.recipient_count);
    } catch (e) {
      Alert.alert('Preview failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Enter a subject and message body first.');
      return;
    }

    // Always confirm with a fresh, accurate count — if the admin skipped "Preview count"
    // (or changed the subject/body/audience since previewing), don't let the confirm dialog
    // say "all" recipients, which reads as an unbounded/unintended send.
    let count = previewCount;
    if (count == null) {
      setPreviewing(true);
      try {
        const result = await previewBulkEmail(token, audience, subject.trim(), body.trim());
        count = result.recipient_count;
        setPreviewCount(count);
      } catch (e) {
        Alert.alert('Could not preview recipients', e instanceof Error ? e.message : 'Try again');
        return;
      } finally {
        setPreviewing(false);
      }
    }

    Alert.alert(
      'Send bulk email?',
      `This will email ${count} ${audienceLabel(audience)} recipient(s). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSending(true);
              try {
                const result = await sendBulkEmail(token, audience, subject.trim(), body.trim());
                setPreviewCount(null);
                setSubject('');
                setBody('');
                await queryClient.invalidateQueries({ queryKey: queryKeys.adminEmailCampaigns });
                Alert.alert(
                  'Email sent',
                  `${result.sent_count} of ${result.recipient_count} delivered${result.failed_count ? ` (${result.failed_count} failed)` : ''}.`
                );
              } catch (e) {
                Alert.alert('Send failed', e instanceof Error ? e.message : 'Try again');
              } finally {
                setSending(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Send plain-text announcements via Resend. Configure RESEND_API_KEY and BULK_EMAIL_FROM in
        Supabase secrets before production sends.
      </Text>

      <AdminErrorBanner
        message={adminQueryErrorMessage(
          campaignsQuery.isError,
          campaignsQuery.error,
          'Could not load past campaigns'
        )}
        onRetry={() => void campaignsQuery.refetch()}
        loading={campaignsQuery.isFetching}
      />

      <Text style={styles.label}>Audience</Text>
      <View style={styles.audienceRow}>
        {AUDIENCES.map((item) => {
          const active = audience === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.audienceChip, active && styles.audienceChipActive]}
              onPress={() => {
                setAudience(item.id);
                setPreviewCount(null);
              }}
            >
              <Text style={[styles.audienceChipText, active && styles.audienceChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{AUDIENCES.find((a) => a.id === audience)?.hint}</Text>

      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={(v) => {
          setSubject(v);
          setPreviewCount(null);
        }}
        placeholder={`${appDisplayName} is live in your area!`}
        placeholderTextColor={colors.textMuted}
        maxLength={200}
      />

      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.bodyInput]}
        value={body}
        onChangeText={(v) => {
          setBody(v);
          setPreviewCount(null);
        }}
        placeholder="Plain text only. Include how to download and redeem a waitlist code if relevant."
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        maxLength={50000}
      />

      {previewCount != null ? (
        <Text style={styles.previewLine}>
          Ready to send to <Text style={styles.previewCount}>{previewCount}</Text> recipient
          {previewCount === 1 ? '' : 's'}.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.secondaryBtn, previewing && styles.btnDisabled]}
          onPress={() => void handlePreview()}
          disabled={previewing || sending}
        >
          {previewing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryBtnText}>Preview count</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, sending && styles.btnDisabled]}
          onPress={() => void handleSend()}
          disabled={sending || previewing}
        >
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Send email</Text>
          )}
        </Pressable>
      </View>

      {campaignsQuery.data?.length ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Recent campaigns</Text>
          {campaignsQuery.data.map((row) => (
            <View key={row.id} style={styles.historyRow}>
              <Text style={styles.historySubject}>{row.subject}</Text>
              <Text style={styles.historyMeta}>
                {row.audience} · {row.sent_count}/{row.recipient_count} sent ·{' '}
                {new Date(row.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    lead: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
    label: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginTop: spacing.sm,
    },
    hint: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
    audienceRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    audienceChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
    },
    audienceChipActive: { borderColor: colors.primary, backgroundColor: colors.surface },
    audienceChipText: { color: colors.text, fontWeight: fontWeight.semibold },
    audienceChipTextActive: { color: colors.primary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSize.body,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    bodyInput: { minHeight: 160 },
    previewLine: { fontSize: fontSize.body, color: colors.text, marginTop: spacing.xs },
    previewCount: { fontWeight: fontWeight.bold, color: colors.primary },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    primaryBtnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
    secondaryBtnText: { color: colors.primary, fontWeight: fontWeight.bold },
    btnDisabled: { opacity: 0.7 },
    history: {
      marginTop: spacing.lg,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    historyTitle: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    historyRow: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    historySubject: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
    historyMeta: { fontSize: fontSize.caption, color: colors.textSecondary },
  })
);
