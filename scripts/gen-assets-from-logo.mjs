/**
 * Regenerates every build-time app asset (icon, splash, adaptive icon,
 * favicon, web wordmark) from a single master logo image.
 *
 * The in-app Branding screen (admin/branding.tsx) updates the *runtime* logo
 * shown across the app/web UI instantly — but the OS-level app icon and splash
 * screen are baked into the native build and can only change via a rebuild.
 * This script is the "one command" that regenerates those local files; you
 * still need to rebuild (`eas build` / `expo prebuild`) and resubmit to the
 * app stores for icon/splash changes to actually ship.
 *
 * Usage:
 *   npm run gen-assets:from-logo -- <path-to-logo.png> [--name "Your App"] [--bg "#0A0A0F"] [--text "#111827"]
 *
 * <path-to-logo.png> should be a square-ish PNG with a transparent background
 * for best results (same file you'd upload in the admin Branding screen).
 * If --name is omitted, the script tries to read the current app_display_name
 * from Supabase (public_app_config) using the URL/anon key in .env, falling
 * back to "Your App".
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS_DIR = join(ROOT, 'assets');

const CANVAS = 1024;
// Keep all logo pixels inside a circle (~46% diameter) so launcher masks
// (round, squircle, adaptive) never clip the mark. Matches
// scripts/generate-app-icons.py so icon.png/adaptive-icon.png stay visually
// consistent regardless of which tool generated them.
const SAFE_RADIUS_RATIO = 0.23;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--name') args.name = argv[++i];
    else if (a === '--bg') args.bg = argv[++i];
    else if (a === '--text') args.text = argv[++i];
    else args._.push(a);
  }
  return args;
}

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#') && !env[m[1]]) env[m[1]] = m[2];
    }
  } catch {
    /* no .env; rely on process.env only */
  }
  return env;
}

async function fetchAppDisplayName(env) {
  const url = (env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key || url.includes('your-project')) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${url}/rest/v1/public_app_config?key=eq.app_display_name&select=value`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const rows = await res.json();
    const value = rows?.[0]?.value;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function scaledLogoBuffer(sourcePath, targetDiameter) {
  const meta = await sharp(sourcePath).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const halfDiag = Math.sqrt(w * w + h * h) / 2;
  const ratio = targetDiameter / 2 / halfDiag;
  const outW = Math.max(1, Math.round(w * ratio));
  const outH = Math.max(1, Math.round(h * ratio));
  return sharp(sourcePath).resize(outW, outH, { fit: 'inside' }).png().toBuffer();
}

async function composeCentered(canvasSize, background, logoBuffer) {
  const logoMeta = await sharp(logoBuffer).metadata();
  const left = Math.round((canvasSize - (logoMeta.width ?? 0)) / 2);
  const top = Math.round((canvasSize - (logoMeta.height ?? 0)) / 2);
  return sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceArg = args._[0];
  if (!sourceArg) {
    console.error(
      'Usage: npm run gen-assets:from-logo -- <path-to-logo.png> [--name "Your App"] [--bg "#0A0A0F"] [--text "#111827"]'
    );
    process.exitCode = 1;
    return;
  }

  const sourcePath = resolve(process.cwd(), sourceArg);
  if (!existsSync(sourcePath)) {
    console.error(`Logo file not found: ${sourcePath}`);
    process.exitCode = 1;
    return;
  }

  const env = loadEnv();
  const bg = args.bg || '#0A0A0F';
  const textColor = args.text || '#111827';
  const appName = args.name || (await fetchAppDisplayName(env)) || 'Your App';

  mkdirSync(ASSETS_DIR, { recursive: true });

  const safeDiameter = CANVAS * SAFE_RADIUS_RATIO * 2;

  // icon.png / splash-icon.png — filled background, used as the native app icon
  // and Expo's `icon` field (app.config.ts -> icon: './assets/splash-icon.png').
  const iconLogo = await scaledLogoBuffer(sourcePath, safeDiameter);
  const splashIcon = await composeCentered(CANVAS, bg, iconLogo);
  await sharp(splashIcon).toFile(join(ASSETS_DIR, 'splash-icon.png'));

  // adaptive-icon.png — Android adaptive foreground layer, transparent background
  // (the background color is set separately in app.config.ts).
  const adaptiveIcon = await composeCentered(CANVAS, { r: 0, g: 0, b: 0, alpha: 0 }, iconLogo);
  await sharp(adaptiveIcon).toFile(join(ASSETS_DIR, 'adaptive-icon.png'));

  // logo-mark.png — in-app splash/notification mark, transparent background,
  // slightly larger than the icon safe zone (no launcher mask to worry about).
  const markLogo = await scaledLogoBuffer(sourcePath, safeDiameter * 1.12);
  const logoMark = await composeCentered(CANVAS, { r: 0, g: 0, b: 0, alpha: 0 }, markLogo);
  await sharp(logoMark).toFile(join(ASSETS_DIR, 'logo-mark.png'));

  // logo-mark-trim.png - app/header mark with transparent padding removed.
  // Use this inside the app so a launcher-safe icon canvas does not look tiny.
  await sharp(logoMark)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .extend({
      top: 48,
      right: 48,
      bottom: 48,
      left: 48,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(join(ASSETS_DIR, 'logo-mark-trim.png'));

  // favicon.png — small filled-background square for the browser tab.
  const faviconLogo = await scaledLogoBuffer(sourcePath, 256 * SAFE_RADIUS_RATIO * 2.2);
  const favicon = await composeCentered(256, bg, faviconLogo);
  await sharp(favicon).toFile(join(ASSETS_DIR, 'favicon.png'));

  // web-logo-lockup.png — horizontal "[mark] App Name" wordmark for the web header/auth screens.
  // Sharp/libvips has no text-measurement API without rendering, so the canvas width is
  // estimated from character count (average glyph width for a 700-weight sans at this size)
  // with generous padding — safe for names up to ~30 characters at the default font size.
  const lockupHeight = 220;
  const markSize = 170;
  const markLeft = 20;
  const fontSize = 64;
  const textLeft = markLeft + markSize + 24;
  const estimatedTextWidth = Math.ceil(appName.length * fontSize * 0.62);
  const lockupWidth = Math.max(500, textLeft + estimatedTextWidth + 48);
  const lockupMark = await sharp(sourcePath)
    .resize(markSize, markSize, { fit: 'inside' })
    .png()
    .toBuffer();
  const markMeta = await sharp(lockupMark).metadata();
  const markTop = Math.round((lockupHeight - (markMeta.height ?? markSize)) / 2);
  const textSvg = `
    <svg width="${lockupWidth}" height="${lockupHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${textLeft}" y="${lockupHeight / 2 + 24}"
        font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
        fill="${textColor}">${escapeXml(appName)}</text>
    </svg>
  `;
  const lockup = await sharp({
    create: { width: lockupWidth, height: lockupHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: lockupMark, left: markLeft, top: markTop },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  await sharp(lockup).toFile(join(ASSETS_DIR, 'web-logo-lockup.png'));

  console.log(`Wrote assets from ${sourcePath} (name: "${appName}", bg: ${bg}):`);
  console.log('  assets/splash-icon.png   (app icon)');
  console.log('  assets/adaptive-icon.png (Android adaptive foreground)');
  console.log('  assets/logo-mark.png     (splash + notification mark)');
  console.log('  assets/logo-mark-trim.png (in-app/header mark)');
  console.log('  assets/favicon.png       (web favicon)');
  console.log('  assets/web-logo-lockup.png (web header wordmark)');
  console.log('');
  console.log('Next: rebuild the app (`eas build` or a new dev client) for the icon/splash');
  console.log('changes to take effect — these are compiled into the native binary and cannot');
  console.log('hot-reload like the in-app logo does.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
