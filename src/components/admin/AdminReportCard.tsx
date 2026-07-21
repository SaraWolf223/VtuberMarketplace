import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  adminReportListingThumb,
  callAdminAction,
  isOrphanListingReport,
  notifyModerationAction,
  resolveReportSubjectUserId,
} from '@/features/admin/admin-service';
import type { AdminReport } from '@/features/admin/admin-types';
import { reportReasonLabel } from '@/features/moderation/moderation-service';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

type Props = {
  report: AdminReport;
  accessToken: string;
  adminUserId: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onComplete: (message: string) => Promise<void>;
};

function reportAgeLabel(createdAt: string): { text: string; overdue: boolean } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 1) {
    return { text: 'Submitted less than 1 hour ago', overdue: false };
  }
  if (hours < 24) {
    return { text: `Submitted ${Math.floor(hours)} hour${Math.floor(hours) === 1 ? '' : 's'} ago`, overdue: false };
  }
  const days = Math.floor(hours / 24);
  return {
    text: `Submitted ${days} day${days === 1 ? '' : 's'} ago — review overdue`,
    overdue: true,
  };
}

export function AdminReportCard({
  report,
  accessToken,
  adminUserId,
  busy,
  onBusyChange,
  onComplete,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const router = useRouter();
  const [warnNotes, setWarnNotes] = useState('');
  const thumb = adminReportListingThumb(report);
  const subjectUserId = resolveReportSubjectUserId(report);
  const orphan = isOrphanListingReport(report);
  const listing = report.listing;
  const subjectProfile =
    report.target_type === 'user' ? report.reported_user : listing?.seller ?? report.reported_user;
  const age = reportAgeLabel(report.created_at);

  const run = async (message: string, fn: () => Promise<void>) => {
    onBusyChange(true);
    try {
      await fn();
      await onComplete(message);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed');
      onBusyChange(false);
    }
  };

  const notifyBestEffort = async (params: {
    userId: string;
    action: 'warn_user' | 'ban_user' | 'delete_listing';
    reason?: string;
    listingId?: string | null;
    listingTitle?: string | null;
  }) => {
    try {
      await notifyModerationAction(accessToken, params);
    } catch {
      /* notification delivery is non-critical */
    }
  };

  const warnUser = () => {
    if (!subjectUserId) return;
    Alert.alert(
      'Warn user',
      `Log a warning for @${subjectProfile?.username ?? 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Warn',
          onPress: () => {
            void run('Warning logged', async () => {
              await callAdminAction(accessToken, adminUserId, {
                action: 'warn_user',
                user_id: subjectUserId,
                report_id: report.id,
                notes: warnNotes.trim() || undefined,
              });
              await notifyBestEffort({
                userId: subjectUserId,
                action: 'warn_user',
                reason: warnNotes.trim() || undefined,
              });
            });
          },
        },
      ]
    );
  };

  const banUser = () => {
    if (!subjectUserId) return;
    Alert.alert('Ban user', `Ban @${subjectProfile?.username ?? 'this user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: () => {
          void run('User banned', async () => {
            await callAdminAction(accessToken, adminUserId, {
              action: 'ban_user',
              user_id: subjectUserId,
              report_id: report.id,
            });
            await notifyBestEffort({ userId: subjectUserId, action: 'ban_user' });
          });
        },
      },
    ]);
  };

  const banAiContent = () => {
    if (!subjectUserId) return;
    Alert.alert(
      'Ban for AI-generated content?',
      'Confirmed AI-generated assets skip the warn ladder and result in an immediate account ban.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban account',
          style: 'destructive',
          onPress: () => {
            void run('Account banned (AI content)', async () => {
              await callAdminAction(accessToken, adminUserId, {
                action: 'ban_ai_content',
                user_id: subjectUserId,
                listing_id: listing?.id ?? null,
                report_id: report.id,
                notes: warnNotes.trim() || undefined,
              });
              await notifyBestEffort({ userId: subjectUserId, action: 'ban_user' });
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {report.target_type === 'listing' ? 'Listing report' : 'User report'}
      </Text>
      <Text style={styles.meta}>
        {reportReasonLabel(report.reason)} · {new Date(report.created_at).toLocaleString()}
      </Text>
      <Text style={[styles.age, age.overdue && styles.ageOverdue]}>{age.text}</Text>
      {report.reporter?.display_name ? (
        <Text style={styles.metaSmall}>Reported by {report.reporter.display_name}</Text>
      ) : null}
      {report.details ? <Text style={styles.body}>{report.details}</Text> : null}

      {orphan ? (
        <Text style={styles.orphan}>Listing removed — report will auto-close on refresh.</Text>
      ) : null}

      {listing && !orphan ? (
        <Pressable
          style={styles.targetRow}
          onPress={() => router.push(`/listing/${listing.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open listing ${listing.title}`}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.flex}>
            <Text style={styles.targetTitle}>{listing.title}</Text>
            <Text style={styles.meta}>
              ${Number(listing.price).toFixed(2)} · {listing.status.replace(/_/g, ' ')}
            </Text>
            <Text style={styles.linkHint}>Tap to open listing</Text>
          </View>
        </Pressable>
      ) : null}

      {subjectProfile && subjectUserId ? (
        <Pressable
          style={styles.profileLink}
          onPress={() => router.push(`/profile/${subjectUserId}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open profile ${subjectProfile.display_name}`}
        >
          <Text style={styles.profileLinkText}>
            {report.target_type === 'user' ? 'Reported user' : 'Seller'}: @{subjectProfile.username}{' '}
            ({subjectProfile.display_name})
          </Text>
          <Text style={styles.linkHint}>Tap to open profile</Text>
        </Pressable>
      ) : subjectUserId ? (
        <Pressable
          style={styles.profileLink}
          onPress={() => router.push(`/profile/${subjectUserId}`)}
        >
          <Text style={styles.profileLinkText}>Open user profile</Text>
        </Pressable>
      ) : null}

      {subjectUserId ? (
        <TextInput
          style={styles.notesInput}
          placeholder="Warning note (optional, for Warn action)"
          value={warnNotes}
          onChangeText={setWarnNotes}
          maxLength={500}
        />
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.secondaryBtn}
          disabled={busy}
          onPress={() => {
            Alert.alert(
              'Dismiss report?',
              'This marks the report reviewed without banning or warning the user.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Dismiss',
                  onPress: () => {
                    void run('Report dismissed', () =>
                      callAdminAction(accessToken, adminUserId, {
                        action: 'dismiss_reports',
                        report_id: report.id,
                      }).then(() => undefined)
                    );
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.secondaryBtnText}>Dismiss</Text>
        </Pressable>

        {subjectUserId ? (
          <>
            {report.reason === 'ai_generated_content' ? (
              <Pressable style={styles.dangerBtn} disabled={busy} onPress={banAiContent}>
                <Text style={styles.dangerBtnText}>Ban (AI content)</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.warnBtn} disabled={busy} onPress={warnUser}>
              <Text style={styles.warnBtnText}>Warn</Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} disabled={busy} onPress={banUser}>
              <Text style={styles.dangerBtnText}>Ban</Text>
            </Pressable>
          </>
        ) : null}

        {listing && !orphan ? (
          <Pressable
            style={styles.dangerBtn}
            disabled={busy}
            onPress={() => {
              Alert.alert('Delete listing', 'Permanently delete this listing?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void run('Listing deleted', async () => {
                      await callAdminAction(accessToken, adminUserId, {
                        action: 'delete_listing',
                        listing_id: listing.id,
                      });
                      if (subjectUserId) {
                        await notifyBestEffort({
                          userId: subjectUserId,
                          action: 'delete_listing',
                          listingId: listing.id,
                          listingTitle: listing.title,
                        });
                      }
                    });
                  },
                },
              ]);
            }}
          >
            <Text style={styles.dangerBtnText}>Delete listing</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  age: { fontSize: fontSize.caption, color: colors.textMuted },
  ageOverdue: { color: colors.warning, fontWeight: fontWeight.semibold },
  metaSmall: { fontSize: fontSize.caption, color: colors.textMuted },
  body: { fontSize: fontSize.body, color: colors.text },
  orphan: { fontSize: fontSize.caption, color: colors.warning, fontStyle: 'italic' },
  targetRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.border },
  thumbEmpty: { opacity: 0.4 },
  targetTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.primary },
  linkHint: { fontSize: fontSize.caption, color: colors.primary, marginTop: 2 },
  profileLink: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 2,
  },
  profileLinkText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: fontSize.body,
    backgroundColor: colors.background,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  secondaryBtnText: { color: colors.text, fontWeight: fontWeight.semibold },
  warnBtn: {
    backgroundColor: colors.warningMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  warnBtnText: { color: colors.warning, fontWeight: fontWeight.semibold },
  dangerBtn: {
    backgroundColor: colors.errorMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  dangerBtnText: { color: colors.error, fontWeight: fontWeight.semibold },
}));
