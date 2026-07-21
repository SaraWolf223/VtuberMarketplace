/**
 * Desktop web layout checks (Playwright + viewport 1440px).
 * Usage: node scripts/test-web-desktop-layout.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';

async function main() {
  console.log(`Desktop layout test: ${base}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let passed = 0;
  let failed = 0;
  const pass = (name, detail = '') => {
    passed += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name, detail = '') => {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text());
  });

  try {
    await page.goto(`${base}/marketing-capture`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    for (const label of ['Search for sale', 'Post', 'All', 'Electronics', 'Gaming']) {
      const nav = page.getByText(label, { exact: true });
      if ((await nav.count()) >= 1) pass(`OfferUp-style chrome includes ${label}`);
      else fail(`OfferUp-style chrome includes ${label}`);
    }

    const sponsored = page.getByText('Sponsored', { exact: true });
    if ((await sponsored.count()) >= 1) {
      pass('In-grid sponsored cards appear in feed');
    } else {
      fail('In-grid sponsored cards appear in feed');
    }

    const firstRow = page.getByTestId('feed-listing-row').first();
    const cellCount = await firstRow.getByTestId('feed-listing-cell').count();
    if (cellCount === 5) pass('Feed grid uses 5 columns', `${cellCount} cards`);
    else fail('Feed grid uses 5 columns', `got ${cellCount}`);

    const bottomTab = page.getByText('Favorites', { exact: true });
    if ((await bottomTab.count()) === 0) {
      pass('Desktop marketing capture hides bottom tabs');
    } else {
      fail('Desktop marketing capture hides bottom tabs');
    }

    const tabList = page.locator('[role="tablist"]');
    if ((await tabList.count()) === 0) {
      pass('No bottom tab bar (tablist) on web');
    } else {
      fail('No bottom tab bar (tablist) on web');
    }

    const cssErrors = pageErrors.filter((e) => e.includes('CSSStyleProperties'));
    if (cssErrors.length === 0) {
      pass('No CSSStyleProperties runtime errors');
    } else {
      fail('No CSSStyleProperties runtime errors', cssErrors[0]?.slice(0, 100));
    }

    const nestedButtonErrors = pageErrors.filter((e) => e.includes('cannot be a descendant'));
    if (nestedButtonErrors.length === 0) {
      pass('Listing cards avoid nested buttons on web');
    } else {
      fail('Listing cards avoid nested buttons on web');
    }

    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(
      () => document.body?.innerText?.includes('Continue with Google'),
      { timeout: 20000 }
    );

    const topBar = page.getByTestId('web-top-bar');
    if ((await topBar.count()) === 0) {
      pass('Web top bar hidden on sign-in', 'expected before auth');
    } else {
      fail('Web top bar hidden on sign-in');
    }

    const signInLogo = page.getByTestId('web-app-logo');
    if ((await signInLogo.count()) >= 1) {
      pass('Logo visible on sign-in');
    } else {
      fail('Logo visible on sign-in');
    }

    const signInButton = page.getByTestId('sign-in-google-button');
    if ((await signInButton.count()) >= 1) {
      const box = await signInButton.boundingBox();
      if (box && box.width < 600) {
        pass('Desktop sign-in renders a centered card (not full-width)', `${Math.round(box.width)}px`);
      } else {
        fail('Desktop sign-in renders a centered card (not full-width)', box ? `${Math.round(box.width)}px` : 'no box');
      }
    } else {
      fail('Sign-in button present');
    }

    const flattenErrors = pageErrors.filter((e) => e.includes('flattenViewStyle'));
    if (flattenErrors.length === 0) {
      pass('No flattenViewStyle runtime errors');
    } else {
      fail('No flattenViewStyle runtime errors', flattenErrors[0]?.slice(0, 100));
    }
  } catch (e) {
    fail('Desktop layout suite', e instanceof Error ? e.message : String(e));
  }

  console.log(`\n${passed}/${passed + failed} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main();
