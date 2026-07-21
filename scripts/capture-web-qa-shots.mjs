/**
 * Capture desktop + mobile web screenshots for QA review.
 * Usage: node scripts/capture-web-qa-shots.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';

const shots = [
  { name: 'scripts/.web-after-desktop-feed.png', path: '/marketing-capture', width: 1440, height: 900 },
  { name: 'scripts/.web-after-mobile-feed.png', path: '/marketing-capture', width: 390, height: 844 },
  { name: 'scripts/.web-after-desktop-signin.png', path: '/', width: 1440, height: 900, wait: 'Continue with Google' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    try {
      await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      if (shot.wait) {
        await page.waitForFunction(
          (t) => document.body?.innerText?.includes(t),
          shot.wait,
          { timeout: 20000 }
        );
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: shot.name, fullPage: false });
      console.log(`saved ${shot.name} (${shot.width}x${shot.height})`);
    } catch (e) {
      console.error(`FAILED ${shot.name}: ${e instanceof Error ? e.message : e}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

main();
