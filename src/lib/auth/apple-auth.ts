import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { syncProfileFromAuthUser } from '@/features/auth/syncProfileFromAuthUser';

/** Apple only allows Sign in with Apple on iOS — never render the button elsewhere. */
export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios';
}

/** Loaded on demand so Metro/Android/web never require the native module. */
async function loadAppleAuthentication() {
  return import('expo-apple-authentication');
}

/**
 * Native Sign in with Apple → Supabase (Phase 5, required for iOS once the
 * app offers other account-creation methods per App Store Guideline 4.8).
 * Uses a hashed nonce (SHA-256) per Apple's native-client requirement, with
 * the raw nonce passed to Supabase for verification.
 */
export async function signInWithApple(): Promise<void> {
  if (!isAppleSignInAvailable()) {
    throw new Error('Sign in with Apple is only available on iOS');
  }

  const AppleAuthentication = await loadAppleAuthentication();

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sign in with Apple is not available on this device');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const identityToken = credential.identityToken;
  if (!identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from Supabase');

  // Apple only returns the name on the very first sign-in ever — capture it now.
  const nameParts = [
    credential.fullName?.givenName,
    credential.fullName?.middleName,
    credential.fullName?.familyName,
  ].filter((v): v is string => !!v?.trim());
  const fullName = nameParts.join(' ').trim();

  await syncProfileFromAuthUser(data.user, fullName ? { displayNameOverride: fullName } : undefined);
}
