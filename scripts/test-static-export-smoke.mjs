/**
 * Smoke test for the exported website/ static bundle.
 *
 * This starts an in-process static server, then uses Playwright to verify that
 * the marketing site, legal pages, and exported Expo web app render.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import { chromium } from 'playwright';

const root = join(process.cwd(), 'website');
const appFallback = join(root, 'app', 'index.html');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`));
}

function resolveStaticPath(requestPath) {
  const urlPath = decodeURIComponent(requestPath.split('?')[0] || '/');
  const normalized = normalize(urlPath.replace(/^\/+/, ''));
  const basePath = join(root, normalized);
  if (!isInside(root, basePath)) return null;

  const candidates = [];
  if (urlPath === '/') {
    candidates.push(join(root, 'index.html'));
  } else {
    candidates.push(basePath);
    candidates.push(`${basePath}.html`);
    candidates.push(join(basePath, 'index.html'));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (urlPath.startsWith('/app/') && existsSync(appFallback)) {
    return appFallback;
  }

  return null;
}

function startServer() {
  const server = createServer((req, res) => {
    const filePath = resolveStaticPath(req.url ?? '/');
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const type = contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(readFileSync(filePath));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Could not bind static test server');
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function assertPage(page, url, pattern, label) {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  if (!response?.ok()) {
    throw new Error(`${label} returned HTTP ${response?.status() ?? 'unknown'}`);
  }
  await page.waitForFunction(
    (source) => new RegExp(source, 'i').test(document.body?.innerText ?? ''),
    pattern.source,
    { timeout: 20_000 }
  );
}

async function main() {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const badResponses = [];

  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    badResponses.push(`${failure?.errorText ?? 'request failed'} ${request.url()}`);
  });

  try {
    await assertPage(page, `${baseUrl}/`, /Local Marketplace|ZIP/i, 'Marketing home');
    console.log('PASS  Marketing home renders');

    for (const path of ['/terms', '/privacy', '/community', '/safety', '/legal']) {
      await assertPage(page, `${baseUrl}${path}`, /Local Marketplace|Privacy|Terms|Safety|Guidelines/i, path);
      console.log(`PASS  Legal page ${path} renders`);
    }

    await assertPage(page, `${baseUrl}/app/`, /Continue with Google|Sign in|Local Marketplace/i, 'Exported app');
    console.log('PASS  Exported app renders');

    await assertPage(page, `${baseUrl}/app/marketing-capture`, /Search for sale|Sponsored|Electronics/i, 'Marketing capture');
    console.log('PASS  Marketing capture route renders');

    const criticalErrors = errors.filter(
      (error) =>
        !/expo-notifications/i.test(error) &&
        !/favicon/i.test(error) &&
        !/Download the React DevTools/i.test(error)
    );
    const criticalResponses = badResponses.filter(
      (error) => !/favicon|apple-touch-icon|robots\.txt/i.test(error)
    );
    if (criticalResponses.length) {
      throw new Error(`HTTP error while rendering export: ${criticalResponses[0]}`);
    }
    if (criticalErrors.length) {
      throw new Error(`Browser console error: ${criticalErrors[0]}`);
    }

    console.log('PASS  No critical browser console errors');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error('FAIL ', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
