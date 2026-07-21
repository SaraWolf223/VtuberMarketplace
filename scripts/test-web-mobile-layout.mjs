/**
 * Mobile web layout checks (Playwright + viewport 390px).
 * Usage: node scripts/test-web-mobile-layout.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';

async function main() {
  console.log(`Mobile web layout test: ${base}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

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

    const topBar = page.getByTestId('web-top-bar');
    if ((await topBar.count()) === 0) {
      pass('Desktop top bar hidden on mobile web');
    } else {
      fail('Desktop top bar hidden on mobile web');
    }

    const offerUpSearch = page.getByPlaceholder('Search for sale');
    if ((await offerUpSearch.count()) === 0) {
      pass('OfferUp desktop search bar not shown on mobile web');
    } else {
      fail('OfferUp desktop search bar not shown on mobile web');
    }

    const mobileSearch = page.getByText('Search listings…');
    if ((await mobileSearch.count()) >= 1) {
      pass('App-like search row visible on mobile web');
    } else {
      fail('App-like search row visible on mobile web');
    }

    const firstRow = page.getByTestId('feed-listing-row').first();
    const cellCount = await firstRow.getByTestId('feed-listing-cell').count();
    if (cellCount === 2) pass('Feed grid uses 2 columns', `${cellCount} cards`);
    else fail('Feed grid uses 2 columns', `got ${cellCount}`);

    const favoritesTab = page.getByText('Favorites', { exact: true });
    if ((await favoritesTab.count()) >= 1) {
      pass('Bottom tab bar visible on mobile web');
    } else {
      fail('Bottom tab bar visible on mobile web');
    }

    const flattenErrors = pageErrors.filter((e) => e.includes('flattenViewStyle'));
    if (flattenErrors.length === 0) {
      pass('No flattenViewStyle runtime errors');
    } else {
      fail('No flattenViewStyle runtime errors', flattenErrors[0]?.slice(0, 100));
    }
  } catch (e) {
    fail('Mobile web layout suite', e instanceof Error ? e.message : String(e));
  }

  console.log(`\n${passed}/${passed + failed} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

main();
