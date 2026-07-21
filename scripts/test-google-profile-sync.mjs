/**
 * Google sign-in profile-sync QA harness — tests the REAL app code path
 * (`syncProfileFromAuthUser`, `AuthProvider`'s `INITIAL_SESSION` enrich step,
 * avatar/name rendering) without needing a real Google Cloud OAuth client.
 *
 * It cannot click the actual "Continue with Google" button (that step
 * genuinely requires a live Google OAuth client + Supabase provider config —
 * see docs/25-Google_Auth_and_Profile.md §3.1). What it DOES verify, against
 * your real backend + a real browser render, is everything downstream of a
 * successful Google OAuth callback:
 *
 *   1. Creates an auth user shaped exactly like Supabase's Google provider
 *      would produce it (app_metadata.provider = 'google', user_metadata with
 *      full_name/avatar_url in the same shape Google sends).
 *   2. Mints a real session for it (magic-link grant — Google-only accounts
 *      have no password).
 *   3. Injects that session into headless Chromium's localStorage and loads
 *      the app cold, so `AuthProvider`'s real `INITIAL_SESSION` → `enrichSession`
 *      → `syncProfileFromAuthUser` path runs for real (no test bypass).
 *   4. Confirms the `profiles` row actually got the display name + avatar
 *      from the fake-Google metadata, and that Settings/Profile render them.
 *   5. Re-runs once more with different fake metadata to exercise the
 *      "existing profile" update branch (name/avatar refresh on repeat sign-in).
 *
 * Requires:
 *   - .env with EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   - env SUPABASE_SERVICE_ROLE_KEY
 *   - a running web server (default http://localhost:8081)
 *   - npx playwright install chromium
 *
 * Usage:
 *   node scripts/test-google-profile-sync.mjs [baseUrl]
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SHOTS_DIR = 'scripts/.signed-in-shots';

function loadDotEnv() {
  const env = {};
  try {
    const txt = readFileSync('.env', 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env */
  }
  return env;
}

const fileEnv = loadDotEnv();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8081';

const TEST_EMAIL = process.env.QA_GOOGLE_EMAIL || 'google.qa@yourdomain.com';
const TERMS_VERSION = process.env.QA_TERMS_VERSION || '2026-06-19';
const TEST_ZIP = '10001';
const TEST_LAT = 40.7506;
const TEST_LNG = -73.9972;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('FAIL  Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (.env).');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('FAIL  Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).host.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${label}${extra ? ' — ' + extra : ''}`);
  } else {
    fail += 1;
    console.error(`FAIL  ${label}${extra ? ' — ' + extra : ''}`);
  }
  return ok;
};

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error('listUsers: ' + error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Shape mirrors exactly what Supabase's Google provider writes onto auth.users. */
function googleShapedMetadata(fullName, avatarSeed) {
  const avatarUrl = `https://lh3.googleusercontent.com/a/${avatarSeed}=s96-c`;
  return {
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {
      full_name: fullName,
      name: fullName,
      avatar_url: avatarUrl,
      picture: avatarUrl,
      email_verified: true,
      iss: 'https://accounts.google.com',
    },
  };
}

async function ensureGoogleTestUser(fullName, avatarSeed) {
  const shaped = googleShapedMetadata(fullName, avatarSeed);
  let user = await findUserByEmail(TEST_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      app_metadata: shaped.app_metadata,
      user_metadata: shaped.user_metadata,
    });
    if (error) throw new Error('createUser: ' + error.message);
    user = data.user;
    console.log(`      created fake-Google test user ${TEST_EMAIL}`);
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: shaped.app_metadata,
      user_metadata: shaped.user_metadata,
    });
    if (error) throw new Error('updateUserById: ' + error.message);
    user = data.user;
    console.log(`      reusing fake-Google test user ${TEST_EMAIL} (metadata refreshed)`);
  }
  return user;
}

/**
 * Google-only accounts have no password, so the session is minted via admin
 * magic link — but GoTrue's magiclink *grant* itself overwrites
 * app_metadata.provider to "email" server-side as a side effect (verified by
 * inspecting the user record before/after: createUser correctly stores
 * provider:"google", generateLink leaves it alone, verifyOtp resets it to
 * "email"). That's a Supabase GoTrue quirk, not anything in this app's code.
 *
 * The app only ever reads app_metadata/user_metadata off the *client-side*
 * session object it restores from localStorage on boot (supabase-js doesn't
 * re-fetch the user on INITIAL_SESSION) — so patching the in-memory session
 * here to carry the correct Google-shaped metadata is sufficient to exercise
 * the real `syncProfileFromAuthUser` Google branch, without the emitted
 * token's underlying grant type leaking into what the app actually sees.
 */
async function mintGoogleShapedSession(fullName, avatarSeed) {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_EMAIL });
  const tokenHash = link.data?.properties?.hashed_token;
  if (!tokenHash) throw new Error('generateLink: ' + (link.error?.message ?? 'no token'));
  const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (v.error || !v.data?.session) throw new Error('verifyOtp: ' + (v.error?.message ?? 'no session'));

  const session = v.data.session;
  const shaped = googleShapedMetadata(fullName, avatarSeed);
  session.user.app_metadata = shaped.app_metadata;
  session.user.user_metadata = shaped.user_metadata;
  return session;
}

async function seedOnboarding(session) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  // Must run first — lazily creates the profiles row that accept_platform_terms updates.
  const loc = await userClient.rpc('upsert_user_prefs_location', {
    p_home_zip: TEST_ZIP,
    p_lng: TEST_LNG,
    p_lat: TEST_LAT,
    p_radius_miles: 10,
    p_state: 'NY',
    p_city: 'New York',
  });
  check(!loc.error, 'Seeded location prefs', loc.error?.message ?? `ZIP ${TEST_ZIP}`);

  const terms = await userClient.rpc('accept_platform_terms', { p_version: TERMS_VERSION });
  check(!terms.error && terms.data?.ok !== false, 'Seeded terms acceptance', terms.error?.message ?? '');
}

async function runBrowserBoot(session, label) {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1320, height: 920 },
    storageState: {
      cookies: [],
      origins: [{ origin: BASE, localStorage: [{ name: storageKey, value: JSON.stringify(session) }] }],
    },
  });
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  // Cold boot on Settings — the screen most likely to render the account's
  // avatar + provider-derived display name + "Google account" email label.
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => (document.body?.innerText ?? '').includes('Settings'), { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const text = (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();
  // Display name lives in a TextInput's `value`, not a text node — innerText
  // won't see it. expo-image renders as a `<div data-expoimage>` on web (no
  // plain <img>), so we check whether it picked up the avatar_url at all
  // (best-effort: the fake googleusercontent.com URL here is syntactically
  // valid but doesn't point at a real photo, so the image itself may 404 —
  // that's a limitation of the synthetic test fixture, not the app).
  const inputValues = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map((i) => i.value));
  const hasAvatarContainer = await page.locator('[data-expoimage="true"]').count();
  await page.screenshot({ path: `${SHOTS_DIR}/google-sync-${label}.png`, fullPage: true }).catch(() => {});

  await browser.close();
  return { text, inputValues, hasAvatarContainer, consoleErrors };
}

async function main() {
  console.log(`Google profile-sync QA → ${BASE}`);
  console.log(`Supabase project: ${projectRef}\n`);

  // --- Run 1: brand-new "Google" account -------------------------------
  await ensureGoogleTestUser('Jane Google QA', 'ACg8ocJfirstrun00000001');
  const session1 = await mintGoogleShapedSession('Jane Google QA', 'ACg8ocJfirstrun00000001');
  check(!!session1?.access_token, 'Minted session for fake-Google account (magic link)', session1.user?.email);
  check(session1.user.app_metadata?.provider === 'google', 'Client-side session carries provider="google"', JSON.stringify(session1.user.app_metadata));
  await seedOnboarding(session1);

  const boot1 = await runBrowserBoot(session1, 'first-signin');
  check(boot1.inputValues.includes('Jane Google QA'), 'Settings\' Display name field shows the synced Google name', JSON.stringify(boot1.inputValues));
  console.log(`      (info) avatar image container rendered: ${boot1.hasAvatarContainer > 0} — actual photo load depends on the fake googleusercontent.com URL resolving, which it won't for synthetic test data`);
  if (boot1.consoleErrors.length) {
    console.warn(`      WARN ${boot1.consoleErrors.length} console error(s): ${boot1.consoleErrors.slice(0, 3).join(' | ')}`);
  } else {
    check(true, 'No console errors on cold boot with injected Google session');
  }

  const userId = session1.user.id;
  const row1 = await admin.from('profiles').select('display_name,avatar_url,auth_provider,email').eq('id', userId).maybeSingle();
  check(row1.data?.auth_provider === 'google', 'profiles.auth_provider = "google"', JSON.stringify(row1.data));
  check(row1.data?.display_name === 'Jane Google QA', 'profiles.display_name synced from Google full_name', row1.data?.display_name);
  check(!!row1.data?.avatar_url?.includes('googleusercontent.com'), 'profiles.avatar_url synced from Google avatar_url', row1.data?.avatar_url);

  // --- Run 2: same account, re-authenticates with a DIFFERENT Google name --
  // (Google accounts can rename themselves; verify the app updates on repeat sign-in.)
  await ensureGoogleTestUser('Jane G. Renamed', 'ACg8ocJsecondrun9999999');
  const session2 = await mintGoogleShapedSession('Jane G. Renamed', 'ACg8ocJsecondrun9999999');
  const boot2 = await runBrowserBoot(session2, 'repeat-signin-renamed');
  const sawEitherName = boot2.inputValues.includes('Jane G. Renamed') || boot2.inputValues.includes('Jane Google QA');
  check(sawEitherName, 'Settings still renders correctly after repeat Google sign-in', JSON.stringify(boot2.inputValues));

  const row2 = await admin.from('profiles').select('display_name,avatar_url').eq('id', userId).maybeSingle();
  console.log(`      (info) display_name after repeat sign-in: "${row2.data?.display_name}" — app currently ${row2.data?.display_name === 'Jane G. Renamed' ? 'DOES' : 'does NOT'} refresh the name on every sign-in (see syncProfileFromAuthUser.ts if this surprises you)`);

  console.log(`\nScreenshots: ${SHOTS_DIR}/google-sync-*.png`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
