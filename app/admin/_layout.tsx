import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { Stack, Redirect, useRouter, useSegments } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useMfaStatus } from '@/hooks/useMfaStatus';
import { queryKeys } from '@/lib/query-keys';
import { getSupabaseEnv } from '@/lib/supabase-rest';
import {
  canAccessAdminRoute,
  isAdminRole,
  isStaffRole,
  staffPanelTitle,
  type AdminHubRoute,
} from '@/lib/admin-access';
import { mergeWebStackScreenOptions } from '@/lib/web-layout';
import { spacing, radius } from '@/theme/tokens';
import { useThemeColors } from '@/hooks/useThemeColors';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

function supabaseProjectRef(): string {
  try {
    const { url } = getSupabaseEnv();
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match?.[1] ?? url.slice(0, 40);
  } catch {
    return 'not configured';
  }
}

export default function AdminLayout(): React.JSX.Element {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading, isFetching, refetch, error } = useProfile();
  const { data: mfaStatus, isLoading: mfaLoading } = useMfaStatus();
  const [refreshing, setRefreshing] = useState(false);

  const refreshRole = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch, user?.id]);

  if (isLoading && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isStaffRole(profile?.role)) {
    const onSecurityScreen = segments[segments.length - 1] === 'security';

    if (mfaLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    // RLS requires `aal2` for every staff-gated read/write (see is_app_staff()/is_app_admin()),
    // so gate on the session's actual current level, not just whether a factor is enrolled —
    // an enrolled-but-not-stepped-up-this-session user would otherwise see the panel shell and
    // only fail once they try to load data.
    if (mfaStatus?.currentLevel !== 'aal2' && !onSecurityScreen) {
      return <Redirect href="/admin/security" />;
    }

    const currentRoute = `/admin/${segments[segments.length - 1] ?? ''}` as AdminHubRoute;
    const onHub = segments.length <= 1;
    if (!onHub && !canAccessAdminRoute(profile.role, currentRoute)) {
      return <Redirect href="/admin" />;
    }

    const panelTitle = staffPanelTitle(profile.role);
    return (
      <Stack
        screenOptions={mergeWebStackScreenOptions(
          {
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          },
          colors
        )}
      >
        <Stack.Screen name="index" options={{ title: panelTitle }} />
        <Stack.Screen name="moderation" options={{ title: 'Moderation' }} />
        <Stack.Screen name="sla" options={{ title: 'SLA & audit log' }} />
        <Stack.Screen name="warned-users" options={{ title: 'Warned users' }} />
        <Stack.Screen name="banned-users" options={{ title: 'Banned users' }} />
        <Stack.Screen
          name="users"
          options={{
            title: isAdminRole(profile?.role) ? 'All users' : 'All usernames',
          }}
        />
        <Stack.Screen name="college-students" options={{ title: 'College students' }} />
        <Stack.Screen name="promo-codes" options={{ title: 'Promo codes' }} />
        <Stack.Screen name="seed" options={{ title: 'Seed program' }} />
        <Stack.Screen name="banned-keywords" options={{ title: 'Banned keywords' }} />
        <Stack.Screen name="waitlist" options={{ title: 'Android waitlist' }} />
        <Stack.Screen name="ios-waitlist" options={{ title: 'iPhone waitlist' }} />
        <Stack.Screen name="bulk-email" options={{ title: 'Bulk email' }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Platform settings',
          }}
        />
        <Stack.Screen name="branding" options={{ title: 'Branding' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="email-templates" options={{ title: 'Email templates' }} />
        <Stack.Screen name="setup-status" options={{ title: 'Setup status' }} />
        <Stack.Screen name="security" options={{ title: 'Admin security' }} />
      </Stack>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.blocked}>
      <Text style={styles.title}>Admin access not active</Text>
      <Text style={styles.body}>
        The app still sees your account as a regular user. Gmail does not grant admin — you must
        update the matching row in Supabase.
      </Text>

      {error ? (
        <Text style={styles.error}>Profile error: {error.message}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Signed-in email</Text>
        <Text style={styles.mono} selectable>
          {profile?.email ?? user.email ?? '—'}
        </Text>

        <Text style={styles.label}>Profile id (use in SQL)</Text>
        <Text style={styles.mono} selectable>
          {user.id}
        </Text>

        <Text style={styles.label}>Role from API</Text>
        <Text style={styles.mono}>{profile?.role ?? 'unknown'}</Text>

        <Text style={styles.label}>Supabase project</Text>
        <Text style={styles.mono}>{supabaseProjectRef()}</Text>
      </View>

      <Text style={styles.body}>
        In Supabase SQL Editor (same project as above), run:
      </Text>
      <Text style={styles.sql} selectable>
        {`UPDATE profiles SET role = 'admin', updated_at = NOW()\nWHERE id = '${user.id}';\n\nSELECT email, role FROM profiles WHERE id = '${user.id}';`}
      </Text>

      <Pressable
        style={[styles.button, (refreshing || isFetching) && styles.buttonDisabled]}
        onPress={() => void refreshRole()}
        disabled={refreshing || isFetching}
      >
        {refreshing || isFetching ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Refresh role from server</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondary} onPress={() => router.replace('/settings')}>
        <Text style={styles.secondaryText}>Back to Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blocked: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  body: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22 },
  error: { color: colors.error, fontSize: fontSize.body },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  mono: {
    fontSize: fontSize.caption,
    color: colors.text,
    fontFamily: 'monospace',
  },
  sql: {
    fontSize: fontSize.caption,
    fontFamily: 'monospace',
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  secondary: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryText: { color: colors.primary, fontWeight: fontWeight.semibold },
}));
