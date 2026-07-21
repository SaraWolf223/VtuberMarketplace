#!/usr/bin/env node
/**
 * Screenshots the landing page phone mock (uses same listing photos as app marketing capture).
 * Requires: npm run serve:website running, or pass BASE_URL
 *
 *   node scripts/capture-landing-phone.mjs
 *   BASE_URL=http://localhost:3456 node scripts/capture-landing-phone.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'website', 'assets', 'screenshots', 'app-feed.png');
const base = process.env.BASE_URL ?? 'http://localhost:3456';

async function main() {
  const { chromium } = await import('playwright');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  const phone = page.locator('.phone-frame').first();
  await phone.waitFor({ state: 'visible', timeout: 10000 });
  await phone.screenshot({ path: outPath });
  await browser.close();
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
