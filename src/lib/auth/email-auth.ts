import { supabase } from '@/lib/supabase';
import { syncProfileFromAuthUser } from '@/features/auth/syncProfileFromAuthUser';
import { getPasswordResetRedirectUri } from '@/lib/auth/google-oauth';

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export type SignUpResult = { needsEmailConfirmation: boolean };

/** Email/password account creation (Phase 5 of the white-label plan). */
export async function signUpWithEmailPassword(input: {
  email: string;
  password: string;
  displayName: string;
  /** Cloudflare Turnstile token (web only, Phase 9 white-label plan) — omitted on native. */
  captchaToken?: string;
}): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim().slice(0, 60) || email.split('@')[0] || 'User';

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: displayName },
      captchaToken: input.captchaToken || undefined,
    },
  });

  if (error) throw error;

  // Session is present immediately only when email confirmations are
  // disabled in Supabase Auth settings — otherwise the user must click the
  // confirmation link first, and no profile row exists until they sign in.
  if (data.session && data.user) {
    await syncProfileFromAuthUser(data.user, { displayNameOverride: displayName });
    return { needsEmailConfirmation: false };
  }

  return { needsEmailConfirmation: true };
}

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  if (data.user) {
    await syncProfileFromAuthUser(data.user).catch(() => {
      /* profile row optional for prefs */
    });
  }
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: getPasswordResetRedirectUri(),
  });
  if (error) throw error;
}

export async function completePasswordReset(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function resendSignupConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) throw error;
}
