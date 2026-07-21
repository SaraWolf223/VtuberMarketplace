/**
 * Export Expo web static build into website/app/ for yourdomain.com/app hosting.
 *
 * Usage:
 *   npm run web:build       # uses the buyer's configured public environment
 *   npm run web:build:sale  # forces placeholder public values for sale prep
 *
 * Sets EXPO_PUBLIC_WEB_BASE_PATH=/app so asset and route URLs work under /app
 * on the marketing site.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = join(root, 'dist');
const targetDir = join(root, 'website', 'app');
const sanitized = process.argv.includes('--sanitized') || process.env.SALE_SANITIZED_EXPORT === '1';

const sanitizedPublicEnv = sanitized
  ? {
      // Expo embeds EXPO_PUBLIC_* values into the static web bundle. Keep sale
      // artifacts tied to placeholders even if a developer has a local .env.
      EXPO_NO_DOTENV: '1',
      EAS_PROJECT_ID: '',
      EXPO_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'your-anon-key',
      EXPO_PUBLIC_MAPBOX_TOKEN: 'your-mapbox-public-token',
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_...',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'your-google-web-client-id.apps.googleusercontent.com',
      EXPO_PUBLIC_POSTHOG_KEY: '',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
      EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: 'ca-app-pub-3940256099942544/2934735716',
      EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',
      EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_ENABLED: 'true',
      EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE: '',
      EXPO_PUBLIC_ADMOB_IOS_NATIVE_VIDEO_ID: '',
      EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_VIDEO_ID: '',
      EXPO_PUBLIC_FULLSCREEN_ADS_LIVE: '',
      EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID: '',
      EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_ID: '',
      EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID: '',
      EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID: '',
    }
  : {};

const env = {
  ...process.env,
  ...sanitizedPublicEnv,
  // Static web builds should not inherit a native EAS project UUID from the shell.
  EAS_PROJECT_ID: sanitized ? '' : process.env.EXPO_PUBLIC_WEB_EAS_PROJECT_ID ?? '',
  EXPO_PUBLIC_WEB_BASE_PATH: '/app',
  EXPO_PUBLIC_WEB_APP_ORIGIN: sanitized
    ? 'https://yourdomain.com'
    : process.env.EXPO_PUBLIC_WEB_APP_ORIGIN ?? 'https://yourdomain.com',
};

console.log(
  `Exporting Expo web app (base path /app${sanitized ? ', sanitized public env' : ''})...`
);
// Metro can create many worker processes by default. Keep Windows exports
// conservative so lower-memory buyer machines remain responsive; buyers can
// override this with EXPO_EXPORT_MAX_WORKERS when they want more parallelism.
const maxWorkers = process.env.EXPO_EXPORT_MAX_WORKERS?.trim() ||
  (process.platform === 'win32' ? '1' : '');
const exportArgs = ['expo', 'export', '--platform', 'web', '--clear'];
if (maxWorkers) exportArgs.push('--max-workers', maxWorkers);

const result = spawnSync('npx', exportArgs, {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error('Expected dist/ after export - none found.');
  process.exit(1);
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true });
}
mkdirSync(join(root, 'website'), { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

console.log(`Copied ${distDir} -> ${targetDir}`);
console.log('Deploy website/ to yourdomain.com - app lives at /app/');
