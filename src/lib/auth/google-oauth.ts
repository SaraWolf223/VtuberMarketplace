import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const rawScheme = Constants.expoConfig?.scheme;
const SCHEME =
  (typeof rawScheme === 'string' ? rawScheme : rawScheme?.[0]) ?? 'localmarketplace';
const NATIVE_CALLBACK = `${SCHEME}://callback`;
const LEGACY_CALLBACK = `${SCHEME}://auth/callback`;
const NATIVE_RESET_PASSWORD = `${SCHEME}://reset-password`;

/** Prevents double exchangeCodeForSession (deep link + browser result). */
let oauthExchangePromise: Promise<void> | null = null;
const exchangedAuthCodes = new Set<string>();

function isPkceVerifierError(message: string): boolean {
  return message.toLowerCase().includes('pkce') || message.toLowerCase().includes('code verifier');
}

export function beginOAuthFlow(): void {
  oauthExchangePromise = null;
  exchangedAuthCodes.clear();
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function normalizeWebBasePath(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_BASE_PATH?.trim() ?? '';
  if (!configured || configured === '/') return '';
  return configured.startsWith('/')
    ? configured.replace(/\/$/, '')
    : `/${configured.replace(/\/$/, '')}`;
}

function getWebCallbackPath(): string {
  return `${normalizeWebBasePath()}/callback`;
}

function getWebResetPasswordPath(): string {
  return `${normalizeWebBasePath()}/reset-password`;
}

function getWebCallbackOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.origin;
}

/**
 * Redirect URI sent to Supabase. Must match Auth → URL Configuration exactly.
 */
export function getAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    const origin = getWebCallbackOrigin();
    if (origin) {
      return `${origin}${getWebCallbackPath()}`;
    }
    return makeRedirectUri({ path: 'callback' });
  }

  if (isExpoGo()) {
    const expUri = Linking.createURL('/callback');
    if (expUri.includes('exp://')) {
      return expUri;
    }
    return makeRedirectUri({ scheme: SCHEME, path: 'callback', preferLocalhost: false });
  }

  const nativeUri = makeRedirectUri({
    scheme: SCHEME,
    path: 'callback',
    preferLocalhost: false,
  });
  if (nativeUri && !nativeUri.startsWith('exp://')) {
    return nativeUri;
  }
  return NATIVE_CALLBACK;
}

/** Redirect URI used for `supabase.auth.resetPasswordForEmail` (email/password Phase 5). */
export function getPasswordResetRedirectUri(): string {
  if (Platform.OS === 'web') {
    const origin = getWebCallbackOrigin();
    if (origin) {
      return `${origin}${getWebResetPasswordPath()}`;
    }
    return makeRedirectUri({ path: 'reset-password' });
  }

  if (isExpoGo()) {
    const expUri = Linking.createURL('/reset-password');
    if (expUri.includes('exp://')) {
      return expUri;
    }
    return makeRedirectUri({ scheme: SCHEME, path: 'reset-password', preferLocalhost: false });
  }

  const nativeUri = makeRedirectUri({
    scheme: SCHEME,
    path: 'reset-password',
    preferLocalhost: false,
  });
  if (nativeUri && !nativeUri.startsWith('exp://')) {
    return nativeUri;
  }
  return NATIVE_RESET_PASSWORD;
}

/** Only accept password-recovery redirects on our app scheme/reset-password path. */
export function isTrustedPasswordResetCallbackUrl(url: string): boolean {
  if (!url?.trim()) return false;

  if (Platform.OS === 'web') {
    try {
      const parsed = new URL(url, getWebCallbackOrigin() ?? undefined);
      const pathname = parsed.pathname.replace(/\/$/, '') || '/';
      const expected = getWebResetPasswordPath().replace(/\/$/, '') || '/reset-password';
      return pathname === expected || pathname.endsWith('/reset-password');
    } catch {
      return false;
    }
  }

  const lower = url.toLowerCase();
  if (lower.startsWith(NATIVE_RESET_PASSWORD.toLowerCase())) return true;
  if (isExpoGo()) {
    try {
      const parsed = Linking.parse(url);
      const path = parsed.path ?? '';
      return path.includes('reset-password');
    } catch {
      return false;
    }
  }
  return false;
}

/** Paste these into Supabase → Authentication → URL Configuration → Redirect URLs */
export function getSupabaseRedirectAllowList(): string[] {
  const primary = getAuthRedirectUri();
  const urls = [primary, NATIVE_CALLBACK, LEGACY_CALLBACK, NATIVE_RESET_PASSWORD, `${SCHEME}://**`];

  if (Platform.OS === 'web') {
    urls.push(
      `${getWebCallbackPath()}`,
      `http://localhost:8081${getWebCallbackPath()}`,
      `${getWebResetPasswordPath()}`,
      `http://localhost:8081${getWebResetPasswordPath()}`
    );
    const prodOrigin = process.env.EXPO_PUBLIC_WEB_APP_ORIGIN?.trim();
    if (prodOrigin) {
      urls.push(
        `${prodOrigin.replace(/\/$/, '')}${getWebCallbackPath()}`,
        `${prodOrigin.replace(/\/$/, '')}${getWebResetPasswordPath()}`
      );
    }
  }

  if (!isExpoGo()) {
    const devClientUri = Linking.createURL('/callback');
    if (devClientUri !== primary && !urls.includes(devClientUri)) {
      urls.push(devClientUri);
    }
  }

  return [...new Set(urls)];
}

export function urlHasAuthPayload(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('code=') || lower.includes('access_token=');
}

/** Only accept OAuth redirects on our app scheme (blocks arbitrary deep-link token injection). */
export function isTrustedOAuthCallbackUrl(url: string): boolean {
  if (!url?.trim()) return false;

  if (Platform.OS === 'web') {
    try {
      const parsed = new URL(url, getWebCallbackOrigin() ?? undefined);
      const pathname = parsed.pathname.replace(/\/$/, '') || '/';
      const expected = getWebCallbackPath().replace(/\/$/, '') || '/callback';
      return pathname === expected || pathname.endsWith('/callback');
    } catch {
      return false;
    }
  }

  const lower = url.toLowerCase();
  if (lower.startsWith(NATIVE_CALLBACK.toLowerCase())) return true;
  if (lower.startsWith(LEGACY_CALLBACK.toLowerCase())) return true;
  if (isExpoGo()) {
    try {
      const parsed = Linking.parse(url);
      const path = parsed.path ?? '';
      return path.includes('callback') && (url.startsWith('exp://') || url.includes('expo-development-client'));
    } catch {
      return false;
    }
  }
  return false;
}

export function isOAuthCallbackUrl(url: string): boolean {
  return isTrustedOAuthCallbackUrl(url);
}

function parseParamString(paramString: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!paramString) return params;
  for (const part of paramString.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
    const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    if (key) params[key] = value;
  }
  return params;
}

function parseAuthParams(url: string): { params: Record<string, string>; errorCode: string | null } {
  try {
    const parsed = QueryParams.getQueryParams(url);
    if (parsed.params.code || parsed.params.access_token) {
      return parsed;
    }
  } catch {
    /* fall through — Android often puts tokens in the hash */
  }

  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const paramString =
    hashIdx >= 0
      ? url.slice(hashIdx + 1)
      : queryIdx >= 0
        ? url.slice(queryIdx + 1)
        : '';

  const params = parseParamString(paramString);
  const errorCode = params.error ?? params.error_description ?? null;
  return { params, errorCode };
}

/** Build a callback URL from router/deep-link fragments (expo-router may strip the query). */
export function buildOAuthCallbackUrl(parts: {
  code?: string | string[];
  access_token?: string | string[];
  refresh_token?: string | string[];
}): string | null {
  const code = [parts.code].flat().find((v) => typeof v === 'string' && v.length > 0);
  if (code) {
    if (Platform.OS === 'web') {
      const origin = getWebCallbackOrigin();
      if (origin) {
        return `${origin}${getWebCallbackPath()}?code=${encodeURIComponent(code)}`;
      }
    }
    return `${NATIVE_CALLBACK}?code=${encodeURIComponent(code)}`;
  }
  return null;
}

/** Build a password-reset callback URL from a route param code (expo-router may strip the query). */
export function buildRecoveryCallbackUrl(code: string | string[] | undefined): string | null {
  const value = [code].flat().find((v) => typeof v === 'string' && v.length > 0);
  if (!value) return null;

  if (Platform.OS === 'web') {
    const origin = getWebCallbackOrigin();
    if (origin) {
      return `${origin}${getWebResetPasswordPath()}?code=${encodeURIComponent(value)}`;
    }
  }
  return `${NATIVE_RESET_PASSWORD}?code=${encodeURIComponent(value)}`;
}

/** Collect the best OAuth callback URL from Linking (initial + current). */
export async function resolveOAuthCallbackUrl(): Promise<string | null> {
  const candidates: string[] = [];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    candidates.push(window.location.href);
  }

  try {
    const initial = await Linking.getInitialURL();
    if (initial) candidates.push(initial);
  } catch {
    /* ignore */
  }
  try {
    const current = await Linking.getLinkingURL();
    if (current) candidates.push(current);
  } catch {
    /* ignore */
  }

  for (const url of candidates) {
    if (isTrustedOAuthCallbackUrl(url) && urlHasAuthPayload(url)) return url;
  }
  return candidates.find((u) => isTrustedOAuthCallbackUrl(u)) ?? null;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Wait for Supabase session after browser redirect (deep link may set it asynchronously). */
export async function waitForSupabaseSession(maxMs = 8000): Promise<boolean> {
  const step = 250;
  const attempts = Math.ceil(maxMs / step);
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

async function exchangeCodeOnce(code: string): Promise<void> {
  if (exchangedAuthCodes.has(code)) {
    if (await waitForSupabaseSession(2000)) return;
    throw new Error('Sign-in code was already used. Try again.');
  }

  exchangedAuthCodes.add(code);

  const { error } = await withTimeout(
    supabase.auth.exchangeCodeForSession(code),
    15_000,
    'Sign-in timed out. Check your connection and try again.'
  );

  if (error) {
    if (isPkceVerifierError(error.message) && (await waitForSupabaseSession(1500))) {
      return;
    }
    throw error;
  }
}

async function createSessionFromUrlInternal(url: string): Promise<void> {
  if (!url?.trim()) {
    const hasSession = await waitForSupabaseSession(2000);
    if (hasSession) return;
    throw new Error('No auth code or tokens in redirect URL');
  }

  if (!isTrustedOAuthCallbackUrl(url)) {
    throw new Error('Untrusted OAuth callback URL');
  }

  const { params, errorCode } = parseAuthParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  if (params.code) {
    await exchangeCodeOnce(params.code);
    return;
  }

  const hasSession = await waitForSupabaseSession(3000);
  if (hasSession) return;

  if (__DEV__) {
    console.warn('[Local Marketplace] OAuth callback URL had no PKCE code:', url.slice(0, 120));
  }
  throw new Error('No auth code in redirect URL');
}

/** Idempotent OAuth callback handler (safe if deep link + browser both fire). */
export async function createSessionFromUrl(url: string): Promise<void> {
  if (await waitForSupabaseSession(500)) {
    return;
  }

  if (oauthExchangePromise) {
    return oauthExchangePromise;
  }

  oauthExchangePromise = createSessionFromUrlInternal(url).finally(() => {
    oauthExchangePromise = null;
  });

  return oauthExchangePromise;
}

let recoveryExchangePromise: Promise<void> | null = null;
const exchangedRecoveryCodes = new Set<string>();

/** Idempotent password-recovery callback handler — mirrors createSessionFromUrl but for the reset-password deep link. */
export async function createRecoverySessionFromUrl(url: string): Promise<void> {
  if (recoveryExchangePromise) {
    return recoveryExchangePromise;
  }

  const run = async () => {
    if (!isTrustedPasswordResetCallbackUrl(url)) {
      throw new Error('Untrusted password reset callback URL');
    }

    const { params, errorCode } = parseAuthParams(url);
    if (errorCode) {
      throw new Error(errorCode);
    }

    if (params.code) {
      if (exchangedRecoveryCodes.has(params.code)) {
        return;
      }
      exchangedRecoveryCodes.add(params.code);
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(params.code),
        15_000,
        'Reset link timed out. Request a new one.'
      );
      if (error) throw error;
      return;
    }

    if (await waitForSupabaseSession(2000)) return;
    throw new Error('Reset link is missing a valid code. Request a new one.');
  };

  recoveryExchangePromise = run().finally(() => {
    recoveryExchangePromise = null;
  });

  return recoveryExchangePromise;
}

export async function signInWithGoogle(): Promise<void> {
  beginOAuthFlow();
  const redirectTo = getAuthRedirectUri();

  if (__DEV__) {
    console.log('[Local Marketplace] OAuth redirectTo:', redirectTo);
    console.log('[Local Marketplace] Supabase allow list:', getSupabaseRedirectAllowList().join(', '));
  }

  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });

    if (error) throw error;
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    throw new Error('Could not start Google sign-in');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Google sign-in');

  if (!data.url.includes('/auth/v1/authorize')) {
    throw new Error(
      'Supabase did not return a sign-in URL. Enable Google under Authentication → Providers.'
    );
  }

  let deepLinkHandled = false;
  const linkingSub = Linking.addEventListener('url', ({ url }) => {
    if (!isOAuthCallbackUrl(url)) return;
    deepLinkHandled = true;
    void WebBrowser.dismissBrowser();
    if (urlHasAuthPayload(url)) {
      void createSessionFromUrl(url);
    }
  });

  if (Platform.OS === 'android') {
    await WebBrowser.warmUpAsync();
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      showInRecents: true,
      createTask: Platform.OS === 'android',
    });

    if (result.type === 'success' && result.url && isTrustedOAuthCallbackUrl(result.url)) {
      if (urlHasAuthPayload(result.url)) {
        await createSessionFromUrl(result.url);
        return;
      }
      if (isOAuthCallbackUrl(result.url) && (await waitForSupabaseSession(12_000))) {
        return;
      }
    }

    // Android often reports "dismiss" even after a successful Google redirect to the app.
    if (await waitForSupabaseSession(12_000)) {
      return;
    }

    if (result.type === 'dismiss' || result.type === 'cancel') {
      if (deepLinkHandled && (await waitForSupabaseSession(8000))) {
        return;
      }
      throw new Error('Google sign-in was cancelled');
    }

    const allowList = getSupabaseRedirectAllowList().join('\n');
    throw new Error(
      `Sign-in did not return to the app.\n\n` +
        `Supabase → Authentication → URL Configuration:\n` +
        `Site URL: ${redirectTo}\n` +
        `Redirect URLs (add each line):\n${allowList}\n\n` +
        `Blank page at supabase.co = redirect URL missing.`
    );
  } finally {
    linkingSub.remove();
    if (Platform.OS === 'android') {
      await WebBrowser.coolDownAsync();
    }
  }
}
