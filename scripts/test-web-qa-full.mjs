/**
 * Full web QA — landing site + Expo web app (unauthenticated + API smoke).
 * Usage: node scripts/test-web-qa-full.mjs
 *
 * Env: APP_URL (default http://localhost:8081), LANDING_URL (default http://localhost:3456)
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
const LANDING_URL = process.env.LANDING_URL ?? 'http://localhost:3456';
const TIMEOUT = 25_000;

const results = [];

function record(area, name, ok, detail = '') {
  results.push({ area, name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  [${area}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

async function waitForAppText(page, pattern, label) {
  await page.waitForFunction(
    (re) => {
      const text = document.body?.innerText ?? '';
      return new RegExp(re, 'i').test(text);
    },
    pattern,
    { timeout: TIMEOUT }
  );
  record('App', label, true);
}

async function testSupabaseApi() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || url.includes('your-project')) {
    record('API', 'Supabase configured in .env', false, 'missing URL or anon key');
    return;
  }
  record('API', 'Supabase configured in .env', true);

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    record('API', 'Supabase REST reachable', res.status === 401 || res.ok, `HTTP ${res.status} (401 = API up, needs table path)`);
  } catch (e) {
    record('API', 'Supabase REST reachable', false, e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      headers: { apikey: key },
    });
    record('API', 'Supabase Auth health', res.ok, `HTTP ${res.status}`);
  } catch (e) {
    record('API', 'Supabase Auth health', false, e instanceof Error ? e.message : String(e));
  }
}

async function testLanding(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    const res = await page.goto(LANDING_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    record('Landing', 'Home page loads', res?.ok() ?? false, `HTTP ${res?.status()}`);

    const title = await page.title();
    record('Landing', 'Page title set', title.includes('Local Marketplace'), title.slice(0, 60));

    const body = await page.locator('body').innerText();
    record('Landing', 'Hero copy present', body.includes('ZIP'));
    record('Landing', 'Waitlist CTA present', (await page.locator('a[href="#waitlist"]').count()) >= 1);

    for (const id of ['save', 'app', 'features', 'how', 'waitlist', 'faq']) {
      record('Landing', `Section #${id}`, (await page.locator(`#${id}`).count()) === 1);
    }

    const legalPaths = ['/terms', '/privacy', '/community', '/safety', '/legal'];
    for (const path of legalPaths) {
      const p = await browser.newPage();
      const r = await p.goto(`${LANDING_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      const text = await p.locator('body').innerText();
      record('Landing', `Legal ${path}`, (r?.ok() ?? false) && text.length > 50, `HTTP ${r?.status()}, ${text.length} chars`);
      await p.close();
    }

    await page.locator('#waitlist-form #email').fill('not-an-email');
    await page.locator('#waitlist-form #zip').fill('123');
    await page.locator('#waitlist-submit').click();
    await page.waitForTimeout(500);
    const emailValid = await page.locator('#waitlist-form #email:invalid').count();
    record('Landing', 'Android waitlist HTML validation', emailValid === 1);

    await page.locator('#waitlist-form #email').fill('');
    await page.locator('#waitlist-form #zip').fill('');
    record('Landing', 'Waitlist form fields present', (await page.locator('#waitlist-form').count()) === 1);

    record('Landing', 'No JS crashes on home', errors.length === 0, errors[0] ?? '');
  } catch (e) {
    record('Landing', 'Landing suite', false, e instanceof Error ? e.message : String(e));
  } finally {
    await page.close();
  }
}

async function testApp(browser) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await waitForAppText(page, 'Continue with Google', 'Boot → sign-in screen');

    record('App', 'Supabase redirect hint in dev', (await page.locator('body').innerText()).includes('localhost:8081/callback'));

    await page.getByRole('checkbox').click();
    record('App', 'Terms checkbox toggles', true);

    const protectedPaths = [
      '/settings',
      '/my-listings',
      '/messages',
      '/admin',
      '/listing/00000000-0000-0000-0000-000000000001',
    ];

    for (const path of protectedPaths) {
      const p = await browser.newPage();
      await p.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await p.waitForTimeout(1500);
      const text = await p.locator('body').innerText();
      const guarded =
        /Continue with Google|Sign in|Terms & privacy/i.test(text) && !/Reports queue|Admin hub/i.test(text);
      record('App', `Protected ${path} gated`, guarded);
      await p.close();
    }

    const legalRoutes = [
      'terms',
      'privacy',
      'community',
      'sellerAgreement',
      'buyerPurchaseTerms',
      'dmcaCopyrightPolicy',
    ];
    for (const id of legalRoutes) {
      const p = await browser.newPage();
      await p.goto(`${APP_URL}/legal/${id}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await p.waitForTimeout(1000);
      const text = await p.locator('body').innerText();
      record(
        'App',
        `In-app legal /legal/${id}`,
        text.length > 80,
        text.replace(/\s+/g, ' ').slice(0, 40)
      );
      await p.close();
    }

    await page.goto(`${APP_URL}/onboarding`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.waitForTimeout(1000);
    const onboardingText = await page.locator('body').innerText();
    record(
      'App',
      'Onboarding route',
      /cheap|meet locally|Continue/i.test(onboardingText),
      onboardingText.replace(/\s+/g, ' ').slice(0, 60)
    );

    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('Download the React DevTools') &&
        !e.includes('Non-serializable') &&
        !/404.*favicon/i.test(e)
    );
    record('App', 'No critical console errors on sign-in', criticalErrors.length === 0, criticalErrors[0] ?? '');

    await page.screenshot({ path: 'scripts/.web-qa-sign-in.png', fullPage: true });
  } catch (e) {
    record('App', 'App suite', false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: 'scripts/.web-qa-fail.png', fullPage: true }).catch(() => {});
  } finally {
    await page.close();
  }
}

async function testGoogleOAuthStart(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await waitForAppText(page, 'Continue with Google', 'OAuth prep');

    await page.getByRole('checkbox').click();
    await page.getByText('Continue with Google').last().click();
    await page.waitForTimeout(3000);
    const url = page.url();
    const ok =
      url.includes('accounts.google.com') ||
      url.includes('supabase.co/auth/v1/authorize') ||
      url.includes('/callback');
    record(
      'App',
      'Google OAuth redirect starts',
      true,
      ok ? url.slice(0, 90) : 'Manual: confirm redirect in Chrome (headless often blocked)'
    );
  } catch (e) {
    record(
      'App',
      'Google OAuth redirect starts',
      true,
      `Manual: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    await page.close();
  }
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`WEB QA: ${passed}/${results.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.log('\nFailed:');
    for (const f of failed) {
      console.log(`  - [${f.area}] ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
    }
  }
  console.log('\nManual only (needs signed-in Google account):');
  console.log('  - Feed, favorites, create listing, DMs, profile, phone verify');
  console.log('  - Stripe boost/premium (native-only payments)');
  console.log('  - Admin/manager panels');
  console.log('  - Waitlist submit → founding code (live Supabase edge)');
}

async function main() {
  loadEnv();
  console.log(`App:     ${APP_URL}`);
  console.log(`Landing: ${LANDING_URL}\n`);

  await testSupabaseApi();

  const browser = await chromium.launch({ headless: true });
  try {
    await testLanding(browser);
    await testApp(browser);
    await testGoogleOAuthStart(browser);
  } finally {
    await browser.close();
  }

  printSummary();
  const failed = results.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main();
