/**
 * Browser smoke test — verifies sign-in UI renders (not a white screen).
 * Requires: npx playwright install chromium
 * Usage: node scripts/test-web-browser.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';
const timeoutMs = 20_000;

async function main() {
  console.log(`Browser test: ${base}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: timeoutMs });

    await page.waitForFunction(
      () => {
        const body = document.body?.innerText ?? '';
        return (
          body.includes('Continue with Google') ||
          body.includes('What is Local Marketplace?') ||
          body.includes('Sign in')
        );
      },
      { timeout: timeoutMs }
    );

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    console.log('PASS  Sign-in UI visible');
    console.log('      Snippet:', bodyText.replace(/\s+/g, ' ').slice(0, 120));

    const hasSpinnerOnly =
      bodyText.trim().length < 20 &&
      (await page.locator('[role="progressbar"], .css-view').count()) > 0;
    if (hasSpinnerOnly) {
      throw new Error('Page still showing loader only');
    }

    if (consoleErrors.length) {
      console.warn('WARN  Console errors:', consoleErrors.slice(0, 3).join(' | '));
    } else {
      console.log('PASS  No console errors');
    }

    await page.screenshot({ path: 'scripts/.web-smoke-screenshot.png', fullPage: true });
    console.log('PASS  Screenshot saved to scripts/.web-smoke-screenshot.png');
  } catch (e) {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    const htmlLen = await page.evaluate(() => document.documentElement.outerHTML.length).catch(() => 0);
    console.error('      Body text:', bodyText.replace(/\s+/g, ' ').slice(0, 200) || '(empty)');
    console.error('      HTML length:', htmlLen);
    if (consoleErrors.length) {
      console.error('      Console errors:', consoleErrors.slice(0, 5).join('\n      '));
    }
    await page.screenshot({ path: 'scripts/.web-smoke-fail.png', fullPage: true }).catch(() => {});
    console.error('FAIL ', e instanceof Error ? e.message : String(e));
    console.error('      Screenshot: scripts/.web-smoke-fail.png');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
