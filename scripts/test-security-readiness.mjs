import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function edgeFunctionNames() {
  const functionsRoot = join(root, 'supabase/functions');
  return readdirSync(functionsRoot)
    .filter((name) => name !== '_shared')
    .filter((name) => {
      const fullPath = join(functionsRoot, name);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'index.ts'));
    })
    .sort();
}

const expectedEdgeFunctionGates = {
  'admin-action': ['requireStaff', 'assertManagerActionAllowed'],
  'admin-bulk-email': ['requireAdmin'],
  'admin-manage': ['requireAdmin'],
  'apply-boost': ['requireUser'],
  'create-boost-checkout': ['requireUser'],
  'create-listing': ['requireUser'],
  'create-premium-checkout': ['requireUser'],
  'create-premium-portal': ['requireUser'],
  'delete-account': ['requireUser'],
  'delete-listing': ['requireUser'],
  'dev-mark-phone-verified': ['requireUser', 'ALLOW_DEV_PHONE_STUB'],
  'finalize-listing-images': ['requireUser'],
  'geocode-zip': ['requireUser', 'checkRateLimit'],
  'get-seller-benefits': ['requireUser'],
  'get-setup-status': ['requireAdmin'],
  'join-ios-waitlist': ['isOriginAllowed', 'verifyTurnstileToken', 'checkRateLimit'],
  'join-waitlist': ['isOriginAllowed', 'verifyTurnstileToken', 'checkRateLimit'],
  'purge-expired-college-badges': ['requireCronAuth'],
  'purge-expired-listings': ['requireCronAuth'],
  'redeem-promo-code': ['requireUser'],
  'send-college-email-code': ['requireUser', 'checkRateLimit'],
  'staff-notify-digest': ['requireCronAuth'],
  'stripe-webhook': ['stripe-signature', 'constructEventAsync', 'STRIPE_WEBHOOK_SECRET'],
  'submit-report': ['requireUser'],
  'sync-premium': ['requireUser'],
  'upload-branding-logo': ['requireAdmin'],
  'upload-profile-avatar': ['requireUser'],
  'verify-college-email-code': ['requireUser', 'checkRateLimit'],
};

test('every edge function has an intentional access or anti-abuse gate', () => {
  const actualNames = edgeFunctionNames();
  const expectedNames = Object.keys(expectedEdgeFunctionGates).sort();
  assert.deepEqual(actualNames, expectedNames);

  for (const [functionName, tokens] of Object.entries(expectedEdgeFunctionGates)) {
    const source = read(`supabase/functions/${functionName}/index.ts`);
    for (const token of tokens) {
      assert.match(source, new RegExp(token), `${functionName} should include ${token}`);
    }
  }
});

test('edge functions keep the intended CORS and POST-only shape', () => {
  for (const functionName of edgeFunctionNames()) {
    const source = read(`supabase/functions/${functionName}/index.ts`);
    assert.match(source, /req\.method\s*!==\s*['"]POST['"]/, `${functionName} should reject non-POST requests`);

    if (functionName === 'stripe-webhook') {
      assert.doesNotMatch(source, /withCors|bindCorsRequest/, 'Stripe webhook should preserve raw webhook handling');
      continue;
    }

    assert.match(source, /bindCorsRequest\(req\)/, `${functionName} should bind request CORS`);
    assert.match(source, /req\.method\s*===\s*['"]OPTIONS['"]/, `${functionName} should handle CORS preflight`);
    assert.match(source, /withCors\(/, `${functionName} should return CORS-wrapped responses`);
  }
});

test('staff and admin edge access remains role-gated with mandatory MFA', () => {
  const guard = read('supabase/functions/_shared/require-admin.ts');
  const adminAction = read('supabase/functions/admin-action/index.ts');

  assert.match(guard, /role\s*!==\s*['"]admin['"]\s*&&\s*role\s*!==\s*['"]manager['"]/);
  assert.match(guard, /currentLevel\s*!==\s*['"]aal2['"]/);
  assert.match(guard, /MFA_REQUIRED/);
  assert.match(guard, /staff\.role\s*!==\s*['"]admin['"]/);
  assert.match(guard, /MANAGER_ADMIN_ACTIONS/);
  assert.match(adminAction, /assertManagerActionAllowed\(auth\.role,\s*action\)/);
  assert.match(adminAction, /Cannot moderate a Local Marketplace staff account/);
});

test('dev phone verification stub fails closed outside explicit non-production QA', () => {
  const source = read('supabase/functions/dev-mark-phone-verified/index.ts');

  assert.match(source, /DENO_ENV'\)\s*===\s*['"]production['"]/);
  assert.match(source, /ENVIRONMENT'\)\s*===\s*['"]production['"]/);
  assert.match(source, /if\s*\(isProd\)\s*return\s+false/);
  assert.match(source, /ALLOW_DEV_PHONE_STUB'\)\s*===\s*['"]true['"]/);
  assert.match(source, /const auth\s*=\s*await requireUser\(req\)/);
});

test('client source does not read server-only secret environment variables', () => {
  for (const relativePath of [
    'app',
    'src',
  ]) {
    const files = listTextFiles(join(root, relativePath));
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /Deno\.env\.get\(/, `${file} should not use Deno.env`);
      assert.doesNotMatch(
        source,
        /process\.env\.(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CRON_SECRET)/,
        `${file} should not read server-only process.env secrets`
      );
    }
  }
});

test('static waitlist config ships with blank safe defaults', () => {
  const source = read('website/scripts/waitlist-config.js');

  assert.match(source, /supabaseUrl:\s*['"]{2}/);
  assert.match(source, /supabaseAnonKey:\s*['"]{2}/);
  assert.match(source, /formspreeEndpoint:\s*['"]{2}/);
  assert.match(source, /turnstileSiteKey:\s*['"]{2}/);
  assert.match(source, /siteOrigin:\s*['"]{2}/);
  assert.doesNotMatch(source, /YOUR_PROJECT|your-project|https:\/\/[a-z0-9-]+\.supabase\.co/i);
});

function listTextFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTextFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
