/** Apply the local wizard's allowlisted non-secret runtime defaults to Supabase. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = join(ROOT, '.env');
const CONFIG_PATH = join(ROOT, '.buyer-setup.local.json');
const DRY_RUN = process.argv.includes('--dry-run');
const PUBLIC_KEYS = new Set([
  'app_display_name',
  'support_email',
  'branding_colors',
  'platform_fee_bps_free',
  'platform_fee_bps_pro',
  'featured_placement_duration_days',
  'featured_placement_price_cents',
  'link_health_grace_period_hours',
  'strike_expiry_months',
  'strike_ban_threshold',
]);
const PLATFORM_KEYS = new Set([
  'reports_per_hour',
  'pause_reports_24h',
  'pause_reports_lifetime',
]);

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[match[1]] = value;
  }
  return out;
}

function requireLocalFiles() {
  if (!existsSync(ENV_PATH)) throw new Error('Run `npm run setup` first; local .env is missing.');
  if (!existsSync(CONFIG_PATH)) throw new Error('Run `npm run setup` and choose platform defaults first.');
  const env = parseEnv(readFileSync(ENV_PATH, 'utf8'));
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || /your-project|placeholder/.test(url)) throw new Error('Set a real Supabase project URL in local .env.');
  if (!url.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    throw new Error('Supabase URL must use HTTPS (localhost is allowed for development).');
  }
  if (!serviceKey || /your-|placeholder/.test(serviceKey)) throw new Error('Set the Supabase service role key in local .env.');
  return { env, url, serviceKey, config: JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
}

function rowsFrom(object, allowlist, label) {
  if (!object || typeof object !== 'object') throw new Error(`${label} section is missing.`);
  const unknown = Object.keys(object).filter((key) => !allowlist.has(key));
  if (unknown.length) throw new Error(`${label} contains unsupported keys: ${unknown.join(', ')}`);
  return Object.entries(object).map(([key, value]) => ({ key, value }));
}

async function upsert(url, serviceKey, table, rows) {
  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table} update failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

async function main() {
  const { url, serviceKey, config } = requireLocalFiles();
  if (config.version !== 1) throw new Error('Unsupported platform setup profile version.');
  const publicRows = rowsFrom(config.publicAppConfig, PUBLIC_KEYS, 'publicAppConfig');
  const platformRows = rowsFrom(config.platformSettings, PLATFORM_KEYS, 'platformSettings');
  console.log(`Validated ${publicRows.length} public and ${platformRows.length} admin platform settings.`);
  if (DRY_RUN) {
    console.log('DRY RUN: no network changes made.');
    return;
  }
  await upsert(url, serviceKey, 'public_app_config', publicRows);
  await upsert(url, serviceKey, 'platform_settings', platformRows);
  console.log('Applied platform branding and moderation defaults. No secret was stored in either table.');
  console.log('Finish logo upload, categories, and email templates from the MFA-protected Admin screens.');
}

main().catch((error) => {
  console.error(`Apply failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
