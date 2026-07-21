/**
 * Local-only buyer setup wizard.
 *
 * This is intentionally a terminal program, never an Expo route or web page.
 * It writes only git-ignored local files and makes no network requests. Runtime
 * white-label values can be applied later with `npm run setup:apply`.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = join(ROOT, '.env');
const BUYER_CONFIG_PATH = join(ROOT, '.buyer-setup.local.json');
const CHECK_ONLY = process.argv.includes('--check');
const PREVIEW_ONLY = process.argv.includes('--preview');
const SELF_TEST = process.argv.includes('--self-test');

const SECTIONS = [
  {
    name: 'App identity and native builds',
    fields: [
      ['APP_DISPLAY_NAME', 'App display name', 'Local Marketplace'],
      ['APP_SCHEME', 'Deep-link scheme (lowercase, no spaces)', 'localmarketplace'],
      ['APP_DOMAIN', 'Production domain (no https://)', 'yourdomain.com'],
      ['IOS_BUNDLE_IDENTIFIER', 'iOS bundle identifier', 'com.example.localmarketplace'],
      ['ANDROID_PACKAGE', 'Android package identifier', 'com.example.localmarketplace'],
      ['IOS_MERCHANT_IDENTIFIER', 'Apple merchant identifier', '', false],
      ['EXPO_OWNER', 'Expo/EAS account owner', 'your-eas-account'],
      ['EXPO_SLUG', 'Expo project slug', 'local-marketplace'],
      ['EAS_PROJECT_ID', 'EAS project ID', '', false],
      ['SUPPORT_EMAIL', 'Support and staff-notification email', 'support@yourdomain.com'],
    ],
  },
  {
    name: 'Supabase',
    fields: [
      ['EXPO_PUBLIC_SUPABASE_URL', 'Project URL', 'https://your-project.supabase.co'],
      ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'Anon/public key', 'your-anon-key'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'Service role key (secret)', '', false, true],
    ],
  },
  {
    name: 'Authentication and Firebase',
    fields: [
      ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'Google web OAuth client ID', '', false],
      ['GOOGLE_SERVICES_JSON', 'Firebase Android config path', './google-services.json', false],
    ],
  },
  {
    name: 'Maps, payments, and advertising',
    fields: [
      ['EXPO_PUBLIC_MAPBOX_TOKEN', 'Mapbox public token', '', false],
      ['MAPBOX_ACCESS_TOKEN', 'Mapbox server token (secret)', '', false, true],
      ['EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Stripe publishable key', '', false],
      ['STRIPE_SECRET_KEY', 'Stripe secret key', '', false, true],
      ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook secret', '', false, true],
      ['STRIPE_PRICE_PREMIUM', 'Stripe Premium price ID', '', false],
      ['ADMOB_ANDROID_APP_ID', 'Android AdMob app ID', '', false],
      ['ADMOB_IOS_APP_ID', 'iOS AdMob app ID', '', false],
      ['EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID', 'Android banner unit ID', 'ca-app-pub-3940256099942544/6300978111'],
      ['EXPO_PUBLIC_ADMOB_IOS_BANNER_ID', 'iOS banner unit ID', 'ca-app-pub-3940256099942544/2934735716'],
      ['EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_VIDEO_ID', 'Android native/video unit ID', '', false],
      ['EXPO_PUBLIC_ADMOB_IOS_NATIVE_VIDEO_ID', 'iOS native/video unit ID', '', false],
      ['EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_ID', 'Android app-open unit ID', '', false],
      ['EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID', 'iOS app-open unit ID', '', false],
      ['EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID', 'Android interstitial unit ID', '', false],
      ['EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID', 'iOS interstitial unit ID', '', false],
      ['EXPO_PUBLIC_POSTHOG_KEY', 'PostHog analytics key', '', false],
    ],
  },
  {
    name: 'Email, bot protection, and production secrets',
    fields: [
      ['RESEND_API_KEY', 'Resend API key (secret)', '', false, true],
      ['COLLEGE_EMAIL_FROM', 'College-verification from address', '', false],
      ['BULK_EMAIL_FROM', 'Bulk/staff from address', '', false],
      ['EXPO_PUBLIC_TURNSTILE_SITE_KEY', 'Turnstile site key', '', false],
      ['TURNSTILE_SECRET_KEY', 'Turnstile secret key', '', false, true],
      ['CRON_SECRET', 'Cron bearer secret', '', false, true],
      ['COLLEGE_OTP_SECRET', 'College OTP HMAC secret', '', false, true],
      ['CORS_ALLOWED_ORIGINS', 'Allowed web origins (comma-separated)', '', false],
    ],
  },
];

const WHITE_LABEL_FIELDS = [
  ['appDisplayName', 'Public app name', 'Local Marketplace'],
  ['supportEmail', 'Public support email', 'support@example.com'],
  ['primary', 'Primary color (#RRGGBB)', '#0066FF'],
  ['primaryDark', 'Dark-mode primary color (#RRGGBB)', '#0066FF'],
  ['accent', 'Accent color (#RRGGBB)', '#0066FF'],
  ['radiusOptions', 'Feed radius choices in miles', '0.5, 1, 2, 5, 10, 25, 50'],
  ['maxRadiusMiles', 'Maximum feed radius', '50'],
  ['boostDurationHours', 'Boost duration in hours', '24'],
  ['boostBaseCents', 'Boost base price in cents', '100'],
  ['reportsPerHour', 'Report limit per user/hour', '5'],
  ['pauseReports24h', 'Auto-pause reports in 24 hours', '10'],
  ['pauseReportsLifetime', 'Auto-pause lifetime reports', '50'],
];

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadEnv() {
  return existsSync(ENV_PATH) ? parseEnv(readFileSync(ENV_PATH, 'utf8')) : {};
}

function loadBuyerConfig() {
  if (!existsSync(BUYER_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BUYER_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function mask(value) {
  if (!value) return '';
  return value.length < 9 ? '********' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function envLine(key, value) {
  if (!value) return `${key}=`;
  return /[\s#]/.test(value) ? `${key}=${JSON.stringify(value)}` : `${key}=${value}`;
}

function buildEnv(values) {
  const publicKeys = [];
  const privateKeys = [];
  for (const section of SECTIONS) {
    for (const [key, , , , secret] of section.fields) {
      (key.startsWith('EXPO_PUBLIC_') ? publicKeys : privateKeys).push([key, secret]);
    }
  }
  const knownKeys = new Set([...publicKeys, ...privateKeys].map(([key]) => key));
  const preserved = Object.keys(values)
    .filter((key) => !knownKeys.has(key))
    .sort();
  const lines = [
    '# Generated by `npm run setup`. This file is git-ignored.',
    '# EXPO_PUBLIC_* and app.config.ts identity values are bundled into clients. Secrets stay local/server-side.',
    '',
    '# Public client/build configuration',
    ...publicKeys.map(([key]) => envLine(key, values[key] || '')),
    '',
    '# Local build and server/edge configuration - never commit real values',
    ...privateKeys.map(([key]) => envLine(key, values[key] || '')),
    ...(preserved.length ? ['', '# Preserved advanced/custom values', ...preserved.map((key) => envLine(key, values[key] || ''))] : []),
    '',
  ];
  return lines.join('\n');
}

function positiveNumber(value, label, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) throw new Error(`${label} must be between 0 and ${max}.`);
  return number;
}

function validateEmail(value, label) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${label} must be a valid email address.`);
}

function validateIdentity(values, { rejectPlaceholders = false } = {}) {
  const required = ['APP_DISPLAY_NAME', 'APP_SCHEME', 'APP_DOMAIN', 'IOS_BUNDLE_IDENTIFIER', 'ANDROID_PACKAGE', 'EXPO_OWNER', 'EXPO_SLUG', 'SUPPORT_EMAIL'];
  for (const key of required) if (!String(values[key] || '').trim()) throw new Error(`${key} is required.`);
  if (String(values.APP_DISPLAY_NAME).trim().length > 60) throw new Error('APP_DISPLAY_NAME must be 60 characters or fewer.');
  if (!/^[a-z][a-z0-9+.-]*$/.test(values.APP_SCHEME)) throw new Error('APP_SCHEME must be lowercase, start with a letter, and contain only letters, numbers, +, . or -.');
  if (!/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(values.APP_DOMAIN)) throw new Error('APP_DOMAIN must be a hostname without protocol, path, spaces, or trailing slash.');
  const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
  if (!identifier.test(values.IOS_BUNDLE_IDENTIFIER)) throw new Error('IOS_BUNDLE_IDENTIFIER must be a reverse-domain identifier.');
  if (!identifier.test(values.ANDROID_PACKAGE)) throw new Error('ANDROID_PACKAGE must be a reverse-domain identifier.');
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(values.EXPO_OWNER)) throw new Error('EXPO_OWNER contains invalid characters.');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(values.EXPO_SLUG)) throw new Error('EXPO_SLUG must be lowercase letters, numbers, and hyphens.');
  if (values.EAS_PROJECT_ID && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(values.EAS_PROJECT_ID)) throw new Error('EAS_PROJECT_ID must be a UUID.');
  validateEmail(values.SUPPORT_EMAIL, 'SUPPORT_EMAIL');
  if (rejectPlaceholders) {
    const joined = required.map((key) => String(values[key])).join(' ');
    if (/yourdomain|your-eas-account|com\.example|support@example|localmarketplace/i.test(joined)) throw new Error('Buyer identity still contains bundled placeholder values.');
  }
}

function normalizeWhiteLabel(raw, env) {
  const color = (key) => {
    const value = String(raw[key] || '#0066FF').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`${key} must use #RRGGBB format.`);
    return value.toUpperCase();
  };
  const radiusOptions = String(raw.radiusOptions || '')
    .split(',')
    .map((value) => Number(value.trim()));
  if (!radiusOptions.length || radiusOptions.some((value) => !Number.isFinite(value) || value <= 0 || value > 200)) {
    throw new Error('Radius choices must be comma-separated numbers between 0 and 200.');
  }
  const appDisplayName = String(raw.appDisplayName || env.APP_DISPLAY_NAME || '').trim();
  const supportEmail = String(raw.supportEmail || env.SUPPORT_EMAIL || '').trim();
  if (!appDisplayName || appDisplayName.length > 60) throw new Error('Public app name is required and must be 60 characters or fewer.');
  validateEmail(supportEmail, 'Public support email');
  const maxRadiusMiles = positiveNumber(raw.maxRadiusMiles, 'Maximum radius', 200);
  if (Math.max(...radiusOptions) > maxRadiusMiles) throw new Error('Maximum radius must cover every radius choice.');
  return {
    version: 1,
    publicAppConfig: {
      app_display_name: appDisplayName,
      support_email: supportEmail,
      branding_colors: { primary: color('primary'), primaryDark: color('primaryDark'), accent: color('accent') },
      feed_radius_options: [...new Set(radiusOptions)].sort((a, b) => a - b),
      max_radius_miles: maxRadiusMiles,
    },
    platformSettings: {
      boost_duration_hours: positiveNumber(raw.boostDurationHours, 'Boost duration'),
      boost_base_cents: positiveNumber(raw.boostBaseCents, 'Boost price'),
      reports_per_hour: positiveNumber(raw.reportsPerHour, 'Report limit'),
      pause_reports_24h: positiveNumber(raw.pauseReports24h, '24-hour threshold'),
      pause_reports_lifetime: positiveNumber(raw.pauseReportsLifetime, 'Lifetime threshold'),
    },
  };
}

async function prompt(rl, label, current, fallback, secret = false) {
  const shown = current ? (secret ? mask(current) : current) : fallback;
  const answer = (await rl.question(`  ${label}${shown ? ` [${shown}]` : ' [skip]'}: `)).trim();
  return answer || current || fallback || '';
}

function protectLocalFile(path) {
  try { chmodSync(path, 0o600); } catch { /* Windows ACLs are used instead of POSIX modes. */ }
}

function securityCheck() {
  const ignored = readFileSync(join(ROOT, '.gitignore'), 'utf8');
  if (!ignored.includes('.buyer-setup.local.json') || !ignored.match(/^\.env$/m)) {
    throw new Error('Setup safety check failed: local setup files are not git-ignored.');
  }
  console.log('PASS setup is terminal-only; .env and .buyer-setup.local.json are git-ignored.');
}

function configurationCheck() {
  if (!existsSync(ENV_PATH)) throw new Error('Local .env is missing. Run `npm run setup` first.');
  const env = loadEnv();
  validateIdentity(env, { rejectPlaceholders: true });
  if (!env.EXPO_PUBLIC_SUPABASE_URL || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(env.EXPO_PUBLIC_SUPABASE_URL) || /your-project|placeholder/.test(env.EXPO_PUBLIC_SUPABASE_URL)) throw new Error('Set a real EXPO_PUBLIC_SUPABASE_URL.');
  if (!env.EXPO_PUBLIC_SUPABASE_ANON_KEY || /your-anon-key|placeholder/.test(env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) throw new Error('Set a real EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  if (!existsSync(BUYER_CONFIG_PATH)) throw new Error('White-label defaults are missing. Run `npm run setup` and configure them.');
  const buyerConfig = loadBuyerConfig();
  const publicConfig = buyerConfig.publicAppConfig;
  const platform = buyerConfig.platformSettings;
  if (!publicConfig || !platform) throw new Error('White-label defaults are incomplete. Run `npm run setup` again.');
  normalizeWhiteLabel({
    appDisplayName: publicConfig.app_display_name,
    supportEmail: publicConfig.support_email,
    primary: publicConfig.branding_colors?.primary,
    primaryDark: publicConfig.branding_colors?.primaryDark,
    accent: publicConfig.branding_colors?.accent,
    radiusOptions: publicConfig.feed_radius_options?.join(','),
    maxRadiusMiles: publicConfig.max_radius_miles,
    boostDurationHours: platform.boost_duration_hours,
    boostBaseCents: platform.boost_base_cents,
    reportsPerHour: platform.reports_per_hour,
    pauseReports24h: platform.pause_reports_24h,
    pauseReportsLifetime: platform.pause_reports_lifetime,
  }, env);
  console.log('PASS buyer identity, Supabase client values, and white-label defaults are configured.');
}

function selfTest() {
  const validIdentity = {
    APP_DISPLAY_NAME: 'Neighbor Auto',
    APP_SCHEME: 'neighborauto',
    APP_DOMAIN: 'neighborauto.example',
    IOS_BUNDLE_IDENTIFIER: 'com.neighbor.auto',
    ANDROID_PACKAGE: 'com.neighbor.auto',
    IOS_MERCHANT_IDENTIFIER: 'merchant.com.neighbor.auto',
    EXPO_OWNER: 'neighbor-auto',
    EXPO_SLUG: 'neighbor-auto',
    EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
    SUPPORT_EMAIL: 'support@neighborauto.example',
  };
  validateIdentity(validIdentity, { rejectPlaceholders: true });
  for (const [key, value] of [
    ['APP_SCHEME', 'Bad Scheme'],
    ['APP_DOMAIN', 'https://example.com/path'],
    ['IOS_BUNDLE_IDENTIFIER', 'not-an-identifier'],
    ['SUPPORT_EMAIL', 'not-an-email'],
  ]) {
    let rejected = false;
    try { validateIdentity({ ...validIdentity, [key]: value }, { rejectPlaceholders: true }); } catch { rejected = true; }
    if (!rejected) throw new Error(`Self-test expected ${key}=${value} to be rejected.`);
  }
  let placeholderRejected = false;
  try { validateIdentity({ ...validIdentity, APP_DOMAIN: 'yourdomain.com' }, { rejectPlaceholders: true }); } catch { placeholderRejected = true; }
  if (!placeholderRejected) throw new Error('Self-test expected bundled placeholders to be rejected.');
  normalizeWhiteLabel({
    appDisplayName: validIdentity.APP_DISPLAY_NAME,
    supportEmail: validIdentity.SUPPORT_EMAIL,
    primary: '#123456', primaryDark: '#112233', accent: '#ABCDEF',
    radiusOptions: '1, 5, 25', maxRadiusMiles: '25',
    boostDurationHours: '24', boostBaseCents: '100', reportsPerHour: '5',
    pauseReports24h: '10', pauseReportsLifetime: '50',
  }, validIdentity);
  console.log('PASS setup validators accept a complete buyer configuration and reject invalid identity values and placeholders.');
}

function printPreview() {
  console.log('\nLocal Marketplace buyer setup — safe preview');
  console.log('Nothing is hosted or transmitted. The live wizard writes only git-ignored local files.');
  console.log('This preview never asks for, displays, or saves credentials.\n');
  for (const section of SECTIONS) {
    console.log(section.name);
    for (const [, label, fallback = '', , secret = false] of section.fields) {
      const shown = secret ? '[secret — entered locally]' : `[${fallback || 'optional'}]`;
      console.log(`  ${label} ${shown}`);
    }
    console.log('');
  }
  console.log('White-label and platform defaults');
  for (const [, label, fallback] of WHITE_LABEL_FIELDS) console.log(`  ${label} [${fallback}]`);
  console.log('\nNext: apply allowlisted defaults, finish Admin branding, then run setup checks and builds.');
}

async function main() {
  if (SELF_TEST) return selfTest();
  securityCheck();
  if (CHECK_ONLY) return configurationCheck();
  if (PREVIEW_ONLY) {
    printPreview();
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('The setup wizard requires a local interactive terminal and will not run as a hosted/non-interactive process.');
  }

  console.log('\nLocal Marketplace buyer setup');
  console.log('Nothing is hosted or transmitted. Secrets are written only to the local git-ignored .env file.');
  console.log('Use a private terminal: newly typed secret values may be visible while you paste them.');
  console.log('Press Enter to keep the value shown in brackets.\n');

  const currentEnv = loadEnv();
  const currentConfig = loadBuyerConfig();
  const values = { ...currentEnv };
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const section of SECTIONS) {
      console.log(`\n${section.name}`);
      for (const [key, label, fallback = '', , secret = false] of section.fields) {
        values[key] = await prompt(rl, label, currentEnv[key] || '', fallback, secret);
      }
    }
    validateIdentity(values);
    const configure = (await rl.question('\nConfigure initial white-label/admin defaults now? [Y/n]: ')).trim().toLowerCase();
    if (configure !== 'n' && configure !== 'no') {
      console.log('\nWhite-label and platform defaults');
      const prior = {
        appDisplayName: currentConfig.publicAppConfig?.app_display_name || values.APP_DISPLAY_NAME,
        supportEmail: currentConfig.publicAppConfig?.support_email || values.SUPPORT_EMAIL,
        primary: currentConfig.publicAppConfig?.branding_colors?.primary,
        primaryDark: currentConfig.publicAppConfig?.branding_colors?.primaryDark,
        accent: currentConfig.publicAppConfig?.branding_colors?.accent,
        radiusOptions: currentConfig.publicAppConfig?.feed_radius_options?.join(', '),
        maxRadiusMiles: currentConfig.publicAppConfig?.max_radius_miles,
        boostDurationHours: currentConfig.platformSettings?.boost_duration_hours,
        boostBaseCents: currentConfig.platformSettings?.boost_base_cents,
        reportsPerHour: currentConfig.platformSettings?.reports_per_hour,
        pauseReports24h: currentConfig.platformSettings?.pause_reports_24h,
        pauseReportsLifetime: currentConfig.platformSettings?.pause_reports_lifetime,
      };
      const raw = {};
      for (const [key, label, fallback] of WHITE_LABEL_FIELDS) raw[key] = await prompt(rl, label, String(prior[key] ?? ''), fallback);
      const config = normalizeWhiteLabel(raw, values);
      writeFileSync(BUYER_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
      protectLocalFile(BUYER_CONFIG_PATH);
      console.log(`Wrote local white-label profile: ${BUYER_CONFIG_PATH}`);
    }
  } finally {
    rl.close();
  }

  writeFileSync(ENV_PATH, buildEnv(values), { mode: 0o600 });
  protectLocalFile(ENV_PATH);
  console.log(`\nWrote local environment: ${ENV_PATH}`);
  console.log('\nNext steps:');
  console.log('  1. Create the listed provider accounts and finish any blank values.');
  console.log('  2. Run Supabase migrations and deploy edge-function secrets per docs/00-Developer_Setup.md.');
  console.log('  3. Run `npm run setup:apply` to apply the allowlisted white-label/platform defaults.');
  console.log('  4. Create your first user, promote it to admin, enable MFA, and use Admin screens for logo, categories, and email templates.');
  console.log('  5. Run `npm run setup:check`, then build preview apps.');
}

main().catch((error) => {
  console.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
