#!/usr/bin/env node
/**
 * Captures the real app marketing feed screen for the static landing page.
 *
 * Prerequisites: npm install (playwright installed on first run via npx)
 *
 * Usage:
 *   node scripts/capture-marketing-screenshots.mjs
 *
 * Starts Expo web, screenshots /marketing-capture, writes website/assets/screenshots/
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'website', 'assets', 'screenshots');
const PORT = 19007;
const URL = `http://localhost:${PORT}/marketing-capture`;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(URL, { redirect: 'follow' });
      if (res.ok || res.status === 200) return true;
    } catch {
      /* not ready */
    }
    await wait(2000);
  }
  return false;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting Expo web on port', PORT, '…');
  const expo = spawn(
    'npx',
    ['expo', 'start', '--web', '--port', String(PORT), '--non-interactive'],
    {
      cwd: root,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1' },
    }
  );

  expo.stdout?.on('data', (d) => process.stdout.write(d));
  expo.stderr?.on('data', (d) => process.stderr.write(d));

  const ready = await waitForServer();
  if (!ready) {
    expo.kill('SIGTERM');
    console.error('Expo web did not become ready in time. Open', URL, 'manually and screenshot.');
    process.exit(1);
  }

  console.log('Capturing screenshot from', URL);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const rootEl = page.locator('[data-testid="marketing-capture-root"], [nativeid="marketing-capture-root"], #marketing-capture-root').first();
  const hasRoot = (await rootEl.count()) > 0;
  const feedPath = path.join(outDir, 'feed-hero.png');
  const phonePath = path.join(outDir, 'feed-phone.png');

  if (hasRoot) {
    await rootEl.screenshot({ path: feedPath });
    console.log('Wrote', feedPath);
  } else {
    await page.screenshot({ path: feedPath, fullPage: false });
    console.log('Wrote full viewport (root not found):', feedPath);
  }

  await page.screenshot({ path: phonePath, fullPage: false });
  console.log('Wrote', phonePath);

  await browser.close();
  expo.kill('SIGTERM');
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
