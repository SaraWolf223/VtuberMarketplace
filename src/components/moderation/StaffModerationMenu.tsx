import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  callAdminAction,
  fetchModerationTargetState,
  notifyModerationAction,
} from '@/features/admin/admin-service';
import type { AdminActionPayload } from '@/features/admin/admin-types';
import { queryKeys } from '@/lib/query-keys';
import { showAlert } from '@/lib/cross-platform-alert';
import { isStaffRole } from '@/lib/admin-access';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useSafeBottomPadding } from '@/hooks/useSafeBottomPadding';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';
import { useAppConfigStore } from '@/stores/app-config-store';

type Props = {
  visible: boolean;
  onClose: () => void;
  accessToken: string;
  adminUserId: string;
  target: { userId: string; username?: string | null; displayName?: string | null };
  /** Provided when opened from a listing screen — enables listing actions. */
  listing?: { id: string; status: string; title?: string | null } | null;
  /** Called after a listing is deleted so the host screen can navigate away. */
  onListingDeleted?: () => void;
};

type ActionTone = 'primary' | 'warning' | 'danger';

export function StaffModerationMenu({
  visible,
  onClose,
  accessToken,
  adminUserId,
  target,
  listing,
  onListingDeleted,
}: Props): React.JSX.Element {
  const appDisplayName = useAppConfigStore((state) => state.config.appDisplayName);
  const styles = useStyles();
  const colors = useThemeColors();
  const safeBottom = useSafeBottomPadding();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  const stateQuery = useQuery({
    queryKey: ['moderation-target', target.userId],
    enabled: visible && !!accessToken && !!target.userId,
    queryFn: () => fetchModerationTargetState(accessToken, target.userId),
    staleTime: 0,
  });

  const targetState = stateQuery.data;
  const targetIsStaff = isStaffRole(targetState?.role);
  const nameLabel = target.username
    ? `@${target.username}`
    : target.displayName ?? 'this user';

  const invalidateForUser = () => {
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProfile(target.userId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProfileListings(target.userId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminBannedUsers });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminWarnedUsers });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminQueueCounts });
  };

  const invalidateForListing = () => {
    if (listing) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.listing(listing.id) });
    }
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProfileListings(target.userId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminPausedListings });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminQueueCounts });
  };

  const run = async (
    payload: AdminActionPayload,
    successMsg: string,
    onDone?: () => void,
    notify?: { action: 'warn_user' | 'ban_user' | 'delete_listing' | 'pause_listing' }
  ) => {
    setBusy(true);
    try {
      await callAdminAction(accessToken, adminUserId, payload);
      if (notify) {
        // Best-effort — never block the action on a notification failure.
        try {
          await notifyModerationAction(accessToken, {
            userId: target.userId,
            action: notify.action,
            reason,
            listingId: listing?.id ?? null,
            listingTitle: listing?.title ?? null,
          });
        } catch {
          /* notification delivery is non-critical */
        }
      }
      showAlert('Done', successMsg);
      onDone?.();
      await stateQuery.refetch();
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const noteOrUndefined = () => reason.trim() || undefined;

  const confirm = (
    title: string,
    message: string,
    confirmLabel: string,
    destructive: boolean,
    onConfirm: () => void
  ) => {
    showAlert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  };

  const toneStyle = (tone: ActionTone) => {
    if (tone === 'primary') return [styles.btn, styles.btnPrimary];
    if (tone === 'warning') return [styles.btn, styles.btnWarning];
    return [styles.btn, styles.btnDanger];
  };
  const toneTextStyle = (tone: ActionTone) => {
    if (tone === 'primary') return styles.btnPrimaryText;
    if (tone === 'warning') return styles.btnWarningText;
    return styles.btnDangerText;
  };

  const ActionButton = ({
    label,
    tone,
    onPress,
  }: {
    label: string;
    tone: ActionTone;
    onPress: () => void;
  }) => (
    <Pressable
      style={[toneStyle(tone), busy && styles.btnDisabled]}
      disabled={busy}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={toneTextStyle(tone)}>{label}</Text>
    </Pressable>
  );

  const renderBody = () => {
    if (stateQuery.isLoading) {
      return <ActivityIndicator color={colors.primary} style={styles.loader} />;
    }
    if (stateQuery.isError || !targetState) {
      const errorMessage = stateQuery.error instanceof Error ? stateQuery.error.message : '';
      const blockedByStaffGate = errorMessage.toLowerCase().includes('forbidden');
      return (
        <Text style={styles.notice}>
          {blockedByStaffGate
            ? 'Complete your two-factor verification before using staff moderation tools.'
            : "Couldn't load this account's status. Try again from the admin panel."}
        </Text>
      );
    }
    if (targetIsStaff) {
      return (
        <Text style={styles.notice}>
          {nameLabel} is a {appDisplayName} staff account. Moderation tools are disabled for
          staff.
        </Text>
      );
    }

    return (
      <View style={styles.actions}>
        <Text style={styles.sectionLabel}>Reason (shared with the user)</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Listing violates our prohibited-items policy"
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!busy}
          maxLength={500}
          accessibilityLabel="Reason shared with the user"
        />
        <Text style={styles.reasonHint}>
          Sent to the user in-app for warnings, pauses, and removed listings. Bans are
          recorded too. Leave blank to send no reason.
        </Text>

        {listing ? (
          <>
            <Text style={styles.sectionLabel}>Listing</Text>
            {listing.status === 'active' ? (
              <ActionButton
                label="Pause listing (hide for review)"
                tone="warning"
                onPress={() =>
                  confirm(
                    'Pause listing',
                    'Hide this listing from the feed pending review?',
                    'Pause',
                    false,
                    () =>
                      void run(
                        { action: 'pause_listing', listing_id: listing.id, notes: noteOrUndefined() },
                        'Listing paused',
                        invalidateForListing,
                        { action: 'pause_listing' }
                      )
                  )
                }
              />
            ) : null}
            {listing.status === 'paused_pending_review' ? (
              <ActionButton
                label="Unpause listing (restore)"
                tone="primary"
                onPress={() =>
                  void run(
                    { action: 'unpause_listing', listing_id: listing.id },
                    'Listing restored',
                    invalidateForListing
                  )
                }
              />
            ) : null}
            <ActionButton
              label="Delete listing"
              tone="danger"
              onPress={() =>
                confirm(
                  'Delete listing',
                  'Permanently delete this listing and its images? This cannot be undone.',
                  'Delete',
                  true,
                    () =>
                      void run(
                        { action: 'delete_listing', listing_id: listing.id, notes: noteOrUndefined() },
                        'Listing deleted',
                        () => {
                          invalidateForListing();
                          onListingDeleted?.();
                          onClose();
                        },
                        { action: 'delete_listing' }
                      )
                )
              }
            />
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Seller / user</Text>
        <ActionButton
          label="Warn user"
          tone="warning"
          onPress={() =>
            confirm(
              'Warn user',
              `Log a warning for ${nameLabel}?`,
              'Warn',
              false,
              () =>
                void run(
                  { action: 'warn_user', user_id: target.userId, notes: noteOrUndefined() },
                  'Warning logged',
                  invalidateForUser,
                  { action: 'warn_user' }
                )
            )
          }
        />
        {targetState.banned_at ? (
          <ActionButton
            label="Unban user"
            tone="primary"
            onPress={() =>
              void run(
                { action: 'unban_user', user_id: target.userId },
                'User unbanned',
                invalidateForUser
              )
            }
          />
        ) : (
          <ActionButton
            label="Ban user"
            tone="danger"
            onPress={() =>
              confirm(
                'Ban user',
                `Ban ${nameLabel}? They will be blocked from signing in.`,
                'Ban',
                true,
                () =>
                  void run(
                    { action: 'ban_user', user_id: target.userId, notes: noteOrUndefined() },
                    'User banned',
                    invalidateForUser,
                    { action: 'ban_user' }
                  )
              )
            }
          />
        )}
        {targetState.shadow_banned ? (
          <ActionButton
            label="Remove shadow-ban"
            tone="primary"
            onPress={() =>
              void run(
                { action: 'unshadow_ban_user', user_id: target.userId },
                'Shadow-ban removed',
                invalidateForUser
              )
            }
          />
        ) : (
          <ActionButton
            label="Shadow-ban user"
            tone="warning"
            onPress={() =>
              confirm(
                'Shadow-ban user',
                `Shadow-ban ${nameLabel}? Their listings stay visible only to them.`,
                'Shadow-ban',
                false,
                () =>
                  void run(
                    { action: 'shadow_ban_user', user_id: target.userId },
                    'User shadow-banned',
                    invalidateForUser
                  )
              )
            }
          />
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Staff moderation</Text>
          <Text style={styles.sub}>Actions for {nameLabel}</Text>
          {renderBody()}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) =>
  StyleSheet.create({
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
    sub: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    loader: { marginVertical: spacing.lg },
    notice: {
      fontSize: fontSize.body,
      color: colors.textSecondary,
      paddingVertical: spacing.md,
    },
    actions: { gap: spacing.sm },
    sectionLabel: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginTop: spacing.sm,
    },
    reasonInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.body,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: 'top',
    },
    reasonHint: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      marginTop: -spacing.xs,
    },
    btn: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      borderWidth: 1,
    },
    btnDisabled: { opacity: 0.5 },
    btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary, fontWeight: fontWeight.semibold },
    btnWarning: { backgroundColor: 'transparent', borderColor: colors.warning },
    btnWarningText: { color: colors.warning, fontWeight: fontWeight.semibold },
    btnDanger: { backgroundColor: colors.errorMuted, borderColor: colors.error },
    btnDangerText: { color: colors.error, fontWeight: fontWeight.semibold },
    cancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
    cancelText: { color: colors.textSecondary },
  })
);
