/**
 * Signed-in web QA harness.
 *
 * Creates (or reuses) a throwaway Supabase test user, mints a real session, and
 * injects it into a headless Chromium localStorage so the web app boots signed
 * in — no Google OAuth needed. Then it walks the key signed-in routes against
 * the live backend and reports pass/fail + screenshots.
 *
 * Requires:
 *   - .env with EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   - env SUPABASE_SERVICE_ROLE_KEY (server secret; used only to mint the test session)
 *   - a running web server (default http://localhost:8081)
 *   - npx playwright install chromium
 *
 * Usage:
 *   node scripts/test-web-signed-in.mjs [baseUrl] [--auth-only]
 */
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SHOTS_DIR = 'scripts/.signed-in-shots';

// Minimal RFC 6238 TOTP generator (no extra dependency) — used to step a
// freshly-enrolled MFA factor up to AAL2 for the admin checks below.
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secretBase32, timeStepSeconds = 30, digits = 6) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

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
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8081';
const AUTH_ONLY = process.argv.includes('--auth-only');
const MOBILE_ONLY = process.argv.includes('--mobile-only');
const DESKTOP_ONLY = process.argv.includes('--desktop-only');

const TEST_EMAIL = process.env.QA_TEST_EMAIL || 'qa.bot@yourdomain.com';
const TEST_PASSWORD = process.env.QA_TEST_PASSWORD || 'Local Marketplace!QA-7e3aF9b2';
const TEST_ZIP = process.env.QA_TEST_ZIP || '10001';
// Keep in sync with src/constants/legal.ts CURRENT_TERMS_VERSION.
const TERMS_VERSION = process.env.QA_TERMS_VERSION || '2026-06-19';
// Approx centroid for 10001 (NYC) — only used to satisfy the location gate.
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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  // listUsers is paginated; scan a few pages.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error('listUsers: ' + error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureTestUser() {
  let user = await findUserByEmail(TEST_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Local Marketplace QA', name: 'Local Marketplace QA' },
    });
    if (error) throw new Error('createUser: ' + error.message);
    user = data.user;
    console.log(`      created test user ${TEST_EMAIL}`);
  } else {
    // Guarantee a known password + confirmed email so password sign-in works.
    await admin.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    console.log(`      reusing test user ${TEST_EMAIL}`);
  }
  return user;
}

async function mintSession() {
  // Primary: email/password grant.
  const pw = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (pw.data?.session) return pw.data.session;

  // Fallback: admin magic-link → verifyOtp (works even if password grant is off).
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_EMAIL });
  const tokenHash = link.data?.properties?.hashed_token;
  if (tokenHash) {
    const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (v.data?.session) return v.data.session;
    throw new Error(
      `Could not mint session. password: "${pw.error?.message ?? 'no session'}"; verifyOtp: "${v.error?.message ?? 'no session'}"`
    );
  }
  throw new Error(
    `Could not mint session. password: "${pw.error?.message ?? 'no session'}"; generateLink: "${link.error?.message ?? 'no token'}"`
  );
}

async function seedOnboarding(session) {
  // Run the real onboarding RPCs *as the test user* so the web app boots past
  // the Terms gate and the location gate.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // upsert_user_prefs_location must run FIRST — it's what lazily creates the
  // profiles row for a brand-new user. accept_platform_terms only UPDATEs an
  // existing row, so calling it before this silently no-ops (no profile to
  // update yet) and the Terms modal keeps blocking every gated route below.
  const loc = await userClient.rpc('upsert_user_prefs_location', {
    p_home_zip: TEST_ZIP,
    p_lng: TEST_LNG,
    p_lat: TEST_LAT,
    p_radius_miles: 10,
    p_state: 'IN',
    p_city: 'Nashville',
  });
  check(!loc.error, 'Seeded location prefs', loc.error?.message ?? `ZIP ${TEST_ZIP}`);

  const terms = await userClient.rpc('accept_platform_terms', { p_version: TERMS_VERSION });
  check(!terms.error && terms.data?.ok !== false, 'Seeded terms acceptance', terms.error?.message ?? JSON.stringify(terms.data ?? TERMS_VERSION));
}

// Admin RPCs/RLS now mandatorily require an AAL2 session. Since the test user
// is reused across runs, wipe any leftover MFA factors from a prior run
// (service-role can delete factors without needing the user's own AAL2
// session) before enrolling + verifying a fresh TOTP factor.
async function stepUpAal2(session, userId) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const existing = await admin.auth.admin.mfa.listFactors({ userId });
  for (const factor of existing.data?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId }).catch(() => {});
  }

  const enroll = await userClient.auth.mfa.enroll({ factorType: 'totp' });
  if (enroll.error || !enroll.data) {
    check(false, 'Enrolled TOTP factor for AAL2 step-up', enroll.error?.message ?? 'no factor data');
    return session;
  }
  const challenge = await userClient.auth.mfa.challenge({ factorId: enroll.data.id });
  if (challenge.error) {
    check(false, 'Enrolled TOTP factor for AAL2 step-up', challenge.error.message);
    return session;
  }
  const verify = await userClient.auth.mfa.verify({
    factorId: enroll.data.id,
    challengeId: challenge.data.id,
    code: totpCode(enroll.data.totp.secret),
  });
  check(!!verify.data?.access_token, 'Stepped test session up to AAL2 (TOTP)', verify.error?.message ?? 'ok');
  return verify.data ?? session;
}

async function grantAdmin(userId) {
  // Service role bypasses the ban/role-protection trigger + RLS.
  const { data, error } = await admin
    .from('profiles')
    .update({ role: 'admin', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('role')
    .maybeSingle();
  check(!error && data?.role === 'admin', 'Granted admin role to test user', error?.message ?? `role=${data?.role ?? '?'}`);
}

// Exercise safe, REVERSIBLE admin actions through the real backend (staff/admin
// RLS + RPCs), with full cleanup. Destructive actions (ban/delete/bulk-email)
// are intentionally NOT run.
async function adminActionChecks(session) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  // Reads behind admin/staff RLS + RPCs (these power the admin screens).
  const usersPage = await userClient.rpc('list_staff_users_page', { p_limit: 5, p_offset: 0 });
  check(
    !usersPage.error,
    'Admin RPC: list_staff_users_page',
    usersPage.error?.message ?? `${Array.isArray(usersPage.data) ? usersPage.data.length : '?'} row(s)`
  );

  const promos = await userClient.from('promo_codes').select('id').limit(1);
  check(!promos.error, 'Admin read: promo_codes (admin RLS)', promos.error?.message ?? 'ok');

  const settings = await userClient.from('platform_settings').select('key,value');
  check(
    !settings.error,
    'Admin read: platform_settings (admin RLS)',
    settings.error?.message ?? `${settings.data?.length ?? 0} key(s)`
  );

  const reports = await userClient.from('reports').select('id').limit(1);
  check(!reports.error, 'Admin read: reports queue (staff RLS)', reports.error?.message ?? 'ok');

  // Reversible WRITE: add → disable → re-enable → delete a banned keyword.
  const kw = `qa_test_kw_${Date.now()}`;
  let kwId = null;
  try {
    const ins = await userClient
      .from('banned_keywords')
      .insert({ keyword: kw, active: true })
      .select('id,active')
      .single();
    if (ins.error) throw new Error('insert: ' + ins.error.message);
    kwId = ins.data.id;
    check(!!kwId, 'Admin action: add banned keyword', kw);

    const off = await userClient
      .from('banned_keywords')
      .update({ active: false })
      .eq('id', kwId)
      .select('active')
      .single();
    check(!off.error && off.data?.active === false, 'Admin action: disable banned keyword', off.error?.message ?? 'active=false');

    const on = await userClient
      .from('banned_keywords')
      .update({ active: true })
      .eq('id', kwId)
      .select('active')
      .single();
    check(!on.error && on.data?.active === true, 'Admin action: re-enable banned keyword', on.error?.message ?? 'active=true');
  } catch (e) {
    check(false, 'Admin action: banned keyword lifecycle', e instanceof Error ? e.message : String(e));
  } finally {
    if (kwId != null) {
      let del = await userClient.from('banned_keywords').delete().eq('id', kwId);
      if (del.error) del = await admin.from('banned_keywords').delete().eq('id', kwId);
      check(!del.error, 'Admin action: delete banned keyword (cleanup)', del.error?.message ?? 'ok');
    }
  }
}

async function main() {
  console.log(`Signed-in web QA → ${BASE}`);
  console.log(`Supabase project: ${projectRef}\n`);

  await ensureTestUser();
  let session = await mintSession();
  check(!!session?.access_token, 'Minted test-user session', `user ${session.user?.email}`);

  await seedOnboarding(session);
  await grantAdmin(session.user.id);
  // Admin RPCs/RLS require AAL2 — step the session up before exercising them
  // or rendering any /admin route (the browser walk below reuses this same
  // AAL2 session for both buyer and admin routes; AAL2 is a superset of AAL1).
  session = await stepUpAal2(session, session.user.id);
  await adminActionChecks(session);

  if (AUTH_ONLY) {
    console.log('\n(--auth-only) Session minting verified; skipping browser run.');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }

  mkdirSync(SHOTS_DIR, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const storageValue = JSON.stringify(session);

  const ROUTES = [
    { path: '/', name: 'Feed', expect: ['Post', 'Search', 'Near', 'Categories'], cold: true },
    { path: '/favorites', name: 'Favorites', expect: ['Saved', 'favorite', 'No saved'] },
    { path: '/messages', name: 'Messages', expect: ['Messages', 'No conversations', 'conversation'] },
    { path: '/sell', name: 'Sell', expect: ['Post a listing', 'Post an ad', 'Step 1', 'Add photos'] },
    { path: '/settings', name: 'Settings', expect: ['Settings', 'Account', 'Legal'] },
    { path: '/notifications', name: 'Activity', expect: ['Activity', 'notification', 'No '] },
    { path: '/my-listings', name: 'My listings', expect: ['listing', 'Active', 'sold', 'No '] },
    { path: '/settings/legal', name: 'Settings·Legal', expect: ['Legal', 'Terms', 'Privacy'] },
    { path: '/settings/safety', name: 'Settings·Safety', expect: ['Safety', 'meetup', 'block'] },
    { path: '/settings/location', name: 'Settings·Location', expect: ['location', 'ZIP', 'radius'] },
    { path: '/settings/premium', name: 'Settings·Premium', expect: ['Premium', 'boost', 'upgrade', 'month'] },
    { path: '/settings/redeem-promo', name: 'Settings·Promo', expect: ['promo', 'code', 'redeem'] },
    { path: '/settings/verify-phone', name: 'Settings·VerifyPhone', expect: ['phone', 'verify', 'code'] },
  ];

  // Staff/admin panel (rendered with role granted to the test user).
  const ADMIN_ROUTES = [
    { path: '/admin', name: 'Admin·Hub', expect: ['Admin', 'Moderation', 'Queue', 'Users'] },
    { path: '/admin/moderation', name: 'Admin·Moderation', expect: ['Moderation', 'Reports', 'Paused', 'queue', 'No '] },
    { path: '/admin/users', name: 'Admin·Users', expect: ['Users', 'directory', '@', 'ban', 'No '] },
    { path: '/admin/banned-users', name: 'Admin·BannedUsers', expect: ['ban', 'No ', 'user'] },
    { path: '/admin/warned-users', name: 'Admin·WarnedUsers', expect: ['warn', 'No ', 'user'] },
    { path: '/admin/banned-keywords', name: 'Admin·Keywords', expect: ['keyword', 'Add', 'No '] },
    { path: '/admin/promo-codes', name: 'Admin·Promos', expect: ['Promo', 'code', 'Create', 'No '] },
    { path: '/admin/settings', name: 'Admin·Settings', expect: ['boost', 'price', 'cents', 'Settings'] },
    { path: '/admin/sla', name: 'Admin·SLA', expect: ['SLA', 'audit', 'action', 'No '] },
    { path: '/admin/waitlist', name: 'Admin·Waitlist', expect: ['waitlist', 'No ', 'signup'] },
    { path: '/admin/ios-waitlist', name: 'Admin·iOSWaitlist', expect: ['waitlist', 'No ', 'iPhone', 'signup'] },
    { path: '/admin/college-students', name: 'Admin·College', expect: ['college', 'edu', 'No ', 'verif'] },
    { path: '/admin/bulk-email', name: 'Admin·BulkEmail', expect: ['email', 'audience', 'subject', 'Preview'] },
  ];

  async function runViewport(vp) {
    console.log(`\n— ${vp.label} (${vp.width}×${vp.height}) —`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      storageState: {
        cookies: [],
        origins: [{ origin: BASE, localStorage: [{ name: storageKey, value: storageValue }] }],
      },
    });
    const page = await context.newPage();
    // Accept confirm()/alert() dialogs (web Alert shim routes through these) so
    // confirm-gated actions proceed instead of Playwright's default dismiss.
    // Keep the latest message so upload checks can assert success vs. error text.
    let lastDialog = '';
    page.on('dialog', (d) => {
      lastDialog = d.message();
      d.accept().catch(() => {});
    });
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    const bodyText = () => page.evaluate(() => document.body?.innerText ?? '');
    const shot = (name) =>
      page.screenshot({ path: `${SHOTS_DIR}/${vp.tag}-${name}.png`, fullPage: true }).catch(() => {});

    // Navigate with one retry — the local dev bundler can be slow on a route's
    // first hit and may briefly refuse connections under load.
    async function gotoWithRetry(url, timeout) {
      try {
        return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      } catch (e) {
        await page.waitForTimeout(4000);
        return page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      }
    }

    async function visit(route) {
      const label = `${vp.label}: ${route.name}`;
      const timeout = route.cold ? 180_000 : 60_000;
      try {
        await gotoWithRetry(`${BASE}${route.path}`, timeout);
        await page
          .waitForFunction(
            (expected) => {
              const t = (document.body?.innerText ?? '').toLowerCase();
              return t.includes('continue with google') || expected.some((s) => t.includes(s.toLowerCase()));
            },
            route.expect,
            { timeout }
          )
          .catch(() => {});
        await page.waitForTimeout(800);
        const text = await bodyText();
        const lower = text.toLowerCase();
        const signedOut = lower.includes('continue with google');
        const denied = lower.includes('admin access') || lower.includes('not active');
        const hit = route.expect.find((s) => lower.includes(s.toLowerCase()));
        await shot(route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        console.log(`      [${route.name}] ${text.replace(/\s+/g, ' ').trim().slice(0, 120) || '(empty)'}`);
        check(
          !signedOut && !denied && !!hit,
          label,
          signedOut
            ? 'bounced to sign-in'
            : denied
              ? 'admin access not active'
              : hit
                ? `saw "${hit}"`
                : 'expected text not found'
        );
      } catch (e) {
        await shot(route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        check(false, label, e instanceof Error ? e.message : String(e));
      }
    }

    for (const route of ROUTES) await visit(route);

    // Admin panel render coverage (test user was granted role=admin).
    if (vp.adminTest) {
      console.log(`      · admin panel ·`);
      for (const route of ADMIN_ROUTES) await visit(route);
    }

    // Desktop only: upload a photo on the Sell step and confirm a preview shows
    // + Next advances (regression test for the web getFileSize/preview fix).
    if (vp.panelTest) {
      try {
        await page.goto(`${BASE}/sell`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1500);
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 12_000 }),
          page.getByText('Add photos', { exact: false }).first().click({ timeout: 10_000 }),
        ]);
        await chooser.setFiles('assets/icon.png');
        // Wait for the compressed preview <img> to appear in the photo grid.
        await page.waitForSelector('img', { timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(2500);
        const imgCount = await page.locator('img').count();
        await shot('sell-photo-preview');
        check(imgCount > 0, `${vp.label}: Photo preview renders after upload`, `${imgCount} img(s)`);

        // Next should advance to Details (no silent Alert).
        await page.getByText('Next', { exact: true }).first().click({ timeout: 8_000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const afterNext = await bodyText();
        await shot('sell-after-next');
        check(
          /Step 2 of 3|Details|TITLE|PRICE|CATEGORY/i.test(afterNext),
          `${vp.label}: Next advances past photos`,
          afterNext.replace(/\s+/g, ' ').trim().slice(0, 60)
        );
      } catch (e) {
        await shot('sell-photo-error');
        check(false, `${vp.label}: Photo upload + Next`, e instanceof Error ? e.message : String(e));
      }
    }

    // Desktop only: the Activity/Profile slide panel must open OVER the current
    // page (regression test for the fix that removed router.replace('/(tabs)')).
    if (vp.panelTest) {
      try {
        await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1500);
        await page.getByLabel('Your profile').first().click({ timeout: 10_000 });
        await page.waitForTimeout(1200);
        const url = page.url();
        const text = await bodyText();
        await shot('profile-panel-over-settings');
        check(
          url.includes('/settings') && text.includes('Settings'),
          `${vp.label}: Profile panel stays on current page`,
          `url ${new URL(url).pathname}`
        );
      } catch (e) {
        check(false, `${vp.label}: Profile panel stays on current page`, e instanceof Error ? e.message : String(e));
      }
    }

    // Avatar upload — drives the REAL "Change profile photo" UI → file chooser →
    // compress → multipart upload → upload-profile-avatar edge function, then
    // verifies the backend stored a new avatar. Regression test for the web
    // FormData "file is required" bug (the { uri, name, type } shape only works
    // on native; web needs a real Blob via appendUploadFile). Runs on every web
    // viewport because the bug affected desktop and mobile web alike.
    if (vp.avatarTest) {
      try {
        const userId = session.user.id;
        const before = await admin
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .maybeSingle();
        const beforeUrl = before.data?.avatar_url ?? null;

        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1800);
        const avatarBtn = page.getByLabel('Change profile photo').first();
        await avatarBtn.waitFor({ state: 'visible', timeout: 12_000 });

        lastDialog = '';
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 12_000 }),
          avatarBtn.click({ timeout: 10_000 }),
        ]);
        await chooser.setFiles('assets/icon.png');

        // Poll the backend for the upload round-trip (cache-busted URL changes).
        let afterUrl = beforeUrl;
        for (let i = 0; i < 25; i += 1) {
          await page.waitForTimeout(1000);
          const a = await admin
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .maybeSingle();
          afterUrl = a.data?.avatar_url ?? null;
          if (afterUrl && afterUrl.includes('/avatars/') && afterUrl !== beforeUrl) break;
          if (/file is required|could not update/i.test(lastDialog)) break;
        }
        await shot('avatar-after-upload');

        const dbOk = !!afterUrl && afterUrl.includes('/avatars/') && afterUrl !== beforeUrl;
        const dialogOk =
          !/file is required|could not update/i.test(lastDialog) &&
          (/saved|updated/i.test(lastDialog) || dbOk);
        check(
          dbOk && dialogOk,
          `${vp.label}: Avatar upload succeeds (no "file is required")`,
          dbOk
            ? `stored avatar; dialog "${lastDialog.replace(/\s+/g, ' ').trim().slice(0, 40)}"`
            : `dialog "${lastDialog.replace(/\s+/g, ' ').trim().slice(0, 70) || '(none)'}"`
        );
      } catch (e) {
        await shot('avatar-error');
        check(false, `${vp.label}: Avatar upload succeeds`, e instanceof Error ? e.message : String(e));
      }
    }

    if (consoleErrors.length) {
      console.warn(`      WARN ${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 3).join(' | ')}`);
    } else {
      check(true, `${vp.label}: no console errors`);
    }
    await context.close();
  }

  try {
    if (!MOBILE_ONLY) {
      await runViewport({ tag: 'desktop', label: 'Desktop web', width: 1320, height: 920, isMobile: false, panelTest: true, adminTest: true, avatarTest: true });
    }
    if (!DESKTOP_ONLY) {
      await runViewport({ tag: 'mobile', label: 'Mobile web', width: 390, height: 844, isMobile: true, panelTest: false, adminTest: false, avatarTest: true });
    }
  } finally {
    await browser.close();
  }

  console.log(`\nScreenshots: ${SHOTS_DIR}/`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
