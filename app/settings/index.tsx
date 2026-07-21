import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect , Redirect, useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Platform,
  Linking,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSellerBenefits } from '@/hooks/useSellerBenefits';
import { isPremiumActive } from '@/features/monetization/premium-service';
import { isPhoneVerified } from '@/hooks/usePhoneVerification';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  daysUntil,
  isCollegeBadgeActive,
  isInCollegeReverifyGrace,
} from '@/features/college/college-badge-service';
import { isStaffRole, staffPanelTitle } from '@/lib/admin-access';
import { useMfaStatus } from '@/hooks/useMfaStatus';
import { queryKeys } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { openActivityTab } from '@/lib/open-activity-tab';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { SettingsProfileSection } from '@/components/settings/SettingsProfileSection';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { useUpdateAvatar } from '@/hooks/useUpdateAvatar';
import { updateDisplayName } from '@/features/profile/profile-update-service';
import { deleteAccount } from '@/features/account/delete-account-service';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function SettingsScreen(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { user, signOut, isSignedIn, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading, isError, error, refetch } = useProfile();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const { premiumActive: benefitsPremium } = useSellerBenefits();
  const { data: mfaStatus } = useMfaStatus();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldsLoadedForUserId, setFieldsLoadedForUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { changeAvatar, uploading: uploadingAvatar } = useUpdateAvatar();
  const {
    enabled: pushEnabled,
    loading: pushLoading,
    busy: pushBusy,
    setPushEnabled,
  } = usePushNotifications();

  const onTogglePush = async (next: boolean) => {
    const res = await setPushEnabled(next);
    if (!res.ok) {
      Alert.alert(
        'Push notifications',
        res.message ?? 'Could not update notifications.',
        res.openSettings
          ? [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ]
          : undefined
      );
    }
  };

  useEffect(() => {
    if (!profile || !user?.id) return;
    if (fieldsLoadedForUserId === user.id) return;
    setUsername(profile.username ?? '');
    setDisplayName(profile.display_name ?? '');
    setFieldsLoadedForUserId(user.id);
  }, [profile, user?.id, fieldsLoadedForUserId]);

  const premiumActive =
    benefitsPremium || isPremiumActive(!!profile?.is_premium, profile?.premium_until);
  const phoneVerified = profile ? isPhoneVerified(profile) : false;
  const profileCollege = profile as {
    college_badge_expires_at?: string | null;
    college_reverify_deadline_at?: string | null;
  } | undefined;
  const collegeActive = isCollegeBadgeActive(profileCollege?.college_badge_expires_at);
  const collegeGrace = isInCollegeReverifyGrace(
    profileCollege?.college_badge_expires_at,
    profileCollege?.college_reverify_deadline_at
  );
  const collegeGraceDays = daysUntil(profileCollege?.college_reverify_deadline_at);

  const canChangeUsername = (): boolean => {
    if (!profile?.username_changed_at) return true;
    const last = new Date(profile.username_changed_at).getTime();
    return Date.now() - last >= SEVEN_DAYS_MS;
  };

  const saveDisplayName = async () => {
    if (!user || !profile) return;
    setSavingName(true);
    try {
      const next = await updateDisplayName(user.id, displayName);
      setDisplayName(next);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      Alert.alert('Saved', 'Display name updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save name');
    } finally {
      setSavingName(false);
    }
  };

  const saveUsername = async () => {
    if (!user || !profile) return;
    const next = username.trim();
    if (next.length < 3 || next.length > 24 || !USERNAME_RE.test(next)) {
      Alert.alert('Username', 'Use 3–24 characters: letters, numbers, underscore only.');
      return;
    }
    if (!canChangeUsername()) {
      Alert.alert('Username', 'You can change your username once every 7 days.');
      return;
    }
    if (next.toLowerCase() === profile.username.toLowerCase()) return;

    setSaving(true);
    try {
      // `profiles` RLS only allows selecting your own row, so checking uniqueness
      // there always comes back empty regardless of whether the name is taken.
      // `profiles_public` is readable by everyone and reflects real usernames.
      const { data: taken } = await supabase
        .from('profiles_public')
        .select('id')
        .ilike('username', next)
        .neq('id', user.id)
        .maybeSingle();

      if (taken) {
        Alert.alert('Username', 'That username is already taken.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: next,
          username_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Username', 'That username is already taken.');
          return;
        }
        throw error;
      }
      setUsername(next);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      Alert.alert('Saved', 'Username updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save username');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'This removes your profile, listings, and messages. Paid subscriptions are canceled. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'This permanently deletes your account and cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                style: 'destructive',
                onPress: async () => {
                  const token = (await supabase.auth.getSession()).data.session?.access_token;
                  if (!token) {
                    Alert.alert('Error', 'Sign in again and retry.');
                    return;
                  }
                  setDeletingAccount(true);
                  try {
                    await deleteAccount(token);
                    await signOut();
                  } catch (e) {
                    Alert.alert(
                      'Could not delete account',
                      e instanceof Error ? e.message : 'Try again later.'
                    );
                    setDeletingAccount(false);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert(
        'Sign out failed',
        e instanceof Error ? e.message : 'Could not sign out. Try again.'
      );
      setSigningOut(false);
    }
  };

  if (!authLoading && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (signingOut || authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        {signingOut ? <Text style={styles.signingOutLabel}>Signing out…</Text> : null}
      </View>
    );
  }

  if (isError && !profile) {
    return (
      <View style={styles.centered}>
        <ErrorRetry
          message={error instanceof Error ? error.message : 'Could not load your profile'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  if (isLoading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SettingsSection title="Profile">
        <SettingsProfileSection
          profile={profile}
          displayName={displayName}
          onChangeDisplayName={setDisplayName}
          onSaveDisplayName={saveDisplayName}
          onChangePhoto={changeAvatar}
          savingName={savingName}
          uploadingPhoto={uploadingAvatar}
        />
      </SettingsSection>

      <SettingsSection
        title="Account"
        footer="Email comes from your sign-in provider and cannot be changed here."
      >
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your_username"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.fieldHint}>
            {canChangeUsername()
              ? 'Changeable once every 7 days. Letters, numbers, and underscore only.'
              : 'You can change your username again after 7 days.'}
          </Text>
          <Pressable
            style={[styles.inlineBtn, saving && styles.inlineBtnDisabled]}
            onPress={saveUsername}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.inlineBtnText}>Save username</Text>
            )}
          </Pressable>
        </View>
        <SettingsRow title="Email" subtitle={profile.email} isLast />
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingsRow
          title="Two-factor authentication"
          subtitle="Add an authenticator app code to your sign-in"
          badge={mfaStatus?.verifiedFactor ? 'On' : 'Off'}
          badgeTone={mfaStatus?.verifiedFactor ? 'success' : undefined}
          onPress={() => router.push('/settings/security')}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Location & verification">
        <SettingsRow
          title="Home ZIP & radius"
          subtitle="Controls which listings you see in the feed"
          onPress={() => router.push('/settings/location')}
        />
        <SettingsRow
          title="Phone verification"
          subtitle={
            phoneVerified
              ? 'Required for messaging — you are verified'
              : 'Required before you can send DMs'
          }
          badge={phoneVerified ? 'Verified' : 'Required'}
          badgeTone={phoneVerified ? 'success' : 'warning'}
          onPress={() => router.push('/settings/verify-phone')}
        />
        <SettingsRow
          title="College student badge"
          subtitle={
            collegeActive
              ? 'Active on your profile — renew yearly'
              : collegeGrace
                ? `Re-verify within ${collegeGraceDays ?? 10} day${(collegeGraceDays ?? 10) === 1 ? '' : 's'}`
                : 'Verify a .edu email for the college badge'
          }
          badge={collegeActive ? 'Active' : collegeGrace ? 'Re-verify' : undefined}
          badgeTone={collegeActive ? 'success' : collegeGrace ? 'warning' : undefined}
          onPress={() => router.push('/settings/verify-college-email')}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Appearance" footer="Light is the default. Changes apply immediately.">
        <ThemePicker />
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        footer={
          Platform.OS === 'web'
            ? undefined
            : 'Turn on push to get alerts even when the app is closed.'
        }
      >
        {Platform.OS !== 'web' ? (
          <SettingsRow
            title="Push notifications"
            subtitle="Messages, deals, and expiring-listing alerts"
            rightElement={
              pushLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Switch
                  value={pushEnabled}
                  onValueChange={(v) => void onTogglePush(v)}
                  disabled={pushBusy}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.onPrimary}
                />
              )
            }
          />
        ) : null}
        <SettingsRow
          title="Activity & notifications"
          subtitle="Listing updates, messages, and alerts"
          onPress={openActivityTab}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Selling & ads">
        <SettingsRow
          title={premiumActive ? 'Pro Seller' : 'Upgrade to Pro Seller'}
          subtitle={
            premiumActive
              ? 'Manage membership, sales, and Featured credits'
              : 'Lower fees, Featured credits, promo codes & timed sales'
          }
          titleTone="premium"
          onPress={() => router.push('/settings/premium')}
        />
        <SettingsRow
          title="Shop profile"
          subtitle="Portfolio URL, website, and social links"
          onPress={() => router.push('/settings/seller-shop')}
        />
        <SettingsRow
          title="Seller payouts"
          subtitle="Stripe Connect onboarding for digital sales"
          onPress={() => router.push('/settings/payouts')}
        />
        <SettingsRow
          title="Support subscriptions"
          subtitle="Buyer and seller support plans"
          onPress={() => router.push('/library/subscriptions')}
        />
        <SettingsRow
          title="Support quotes"
          subtitle="Accept and pay extra-work quotes"
          onPress={() => router.push('/library/support-quotes')}
        />
        <SettingsRow
          title="Promo codes & sales"
          subtitle="Pro Seller discounts and timed listing sales"
          onPress={() => router.push('/settings/seller-discounts')}
        />
        <SettingsRow
          title="Redeem promo code"
          subtitle="Seller or platform promo codes"
          onPress={() => router.push('/settings/redeem-promo')}
          isLast
        />
      </SettingsSection>

      <SettingsSection title="Safety">
        <SettingsRow
          title="Trust & safety"
          subtitle="Content rules, copyright, and reporting a broken download link"
          onPress={() => router.push('/settings/safety')}
        />
        <SettingsRow
          title="Blocked users"
          subtitle="See who you've blocked and unblock them"
          onPress={() => router.push('/settings/blocked-users')}
        />
        <SettingsRow
          title="Legal & policies"
          subtitle="Terms, privacy, and community guidelines"
          onPress={() => router.push('/settings/legal')}
          isLast
        />
      </SettingsSection>

      {isStaffRole(profile.role) ? (
        <SettingsSection title={profile.role === 'manager' ? 'Moderation' : 'Admin'}>
          <SettingsRow
            title={staffPanelTitle(profile.role)}
            subtitle={
              profile.role === 'manager'
                ? 'Reports and user moderation'
                : 'Moderation, promos, waitlist email, and platform settings'
            }
            onPress={() => router.push('/admin')}
            isLast
          />
        </SettingsSection>
      ) : null}

      {__DEV__ ? (
        <Text style={styles.devId} selectable>
          Dev profile id: {profile.id}
        </Text>
      ) : null}

      <SettingsSection title="Account actions">
        <SettingsRow
          title="Delete account"
          subtitle="Permanently remove your profile and listings"
          onPress={handleDeleteAccount}
          titleTone="danger"
          isLast
        />
      </SettingsSection>

      <Pressable
        style={[styles.signOutBtn, (signingOut || deletingAccount) && styles.inlineBtnDisabled]}
        onPress={handleSignOut}
        disabled={signingOut || deletingAccount}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>

      {deletingAccount ? (
        <View style={styles.centeredInline}>
          <ActivityIndicator color={colors.error} />
          <Text style={styles.deletingLabel}>Deleting account…</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  signingOutLabel: { fontSize: fontSize.body, color: colors.textSecondary },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  fieldBlock: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  fieldHint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    backgroundColor: colors.background,
    color: colors.text,
  },
  inlineBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    alignSelf: 'flex-start',
    minWidth: 140,
  },
  inlineBtnDisabled: { opacity: 0.7 },
  inlineBtnText: { color: colors.onPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
  signOutBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.error, fontWeight: fontWeight.semibold, fontSize: fontSize.body },
  centeredInline: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  deletingLabel: { fontSize: fontSize.caption, color: colors.error },
  devId: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
}));
