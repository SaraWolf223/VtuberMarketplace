import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { enhanceGoogleAvatarUrl } from '@/features/auth/avatar-url';
import { generateUniqueUsername } from '@/features/auth/username';

export type AuthProviderKind = 'google' | 'apple' | 'email';

function detectProvider(user: User): AuthProviderKind {
  const raw = (user.app_metadata?.provider as string | undefined) ?? '';
  if (raw === 'apple') return 'apple';
  if (raw === 'google') return 'google';
  return 'email';
}

/**
 * Create/update the `profiles` row for any supported auth provider
 * (Google, Apple, email/password — Phase 5 of the white-label plan).
 * Google supplies name + avatar via OAuth metadata; Apple only supplies a
 * name on first sign-in (never an avatar); email/password accounts supply
 * neither, so `displayNameOverride` (collected on the sign-up form) is used.
 */
export async function syncProfileFromAuthUser(
  user: User,
  opts?: { displayNameOverride?: string }
): Promise<void> {
  const provider = detectProvider(user);
  const meta = user.user_metadata ?? {};
  const displayName =
    opts?.displayNameOverride?.trim() ||
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'User';
  const avatarUrl =
    provider === 'google'
      ? enhanceGoogleAvatarUrl(
          (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined)
        )
      : null;
  const email = user.email;
  if (!email) {
    throw new Error('Account must include an email');
  }

  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    const patch: {
      email: string;
      auth_provider: string;
      last_active_at: string;
      updated_at: string;
      avatar_url?: string | null;
      display_name?: string;
    } = {
      email,
      auth_provider: provider,
      last_active_at: now,
      updated_at: now,
    };

    if (!existing.avatar_url && avatarUrl) {
      patch.avatar_url = avatarUrl;
    }
    // Apple only returns the name on the very first sign-in — capture it if
    // the profile still has the generic fallback and a real name showed up.
    if (opts?.displayNameOverride?.trim() && existing.display_name !== opts.displayNameOverride.trim()) {
      patch.display_name = opts.displayNameOverride.trim();
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw error;
    return;
  }

  const username = await generateUniqueUsername(displayName, user.id);
  // Supabase auth triggers may create the profile row at the same time the
  // client-side first-session sync runs. `ignoreDuplicates` avoids a noisy 409
  // in that race, then the update below finishes syncing the account metadata.
  const { error: insertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
      auth_provider: provider,
      last_active_at: now,
      updated_at: now,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  if (insertError) throw insertError;

  const patch: {
    email: string;
    auth_provider: string;
    last_active_at: string;
    updated_at: string;
    avatar_url?: string | null;
    display_name?: string;
  } = {
    email,
    auth_provider: provider,
    last_active_at: now,
    updated_at: now,
  };

  if (avatarUrl) {
    patch.avatar_url = avatarUrl;
  }
  if (opts?.displayNameOverride?.trim()) {
    patch.display_name = displayName;
  }

  const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (updateError) throw updateError;
}
