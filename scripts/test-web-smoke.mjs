/**
 * Smoke test for Expo web dev server.
 * Usage: node scripts/test-web-smoke.mjs [baseUrl]
 */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const base = process.argv[2] ?? 'http://localhost:8081';

const checks = [];

function pass(name, detail = '') {
  checks.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  checks.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchTextUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      parsed,
      { headers: { 'User-Agent': 'LocalMarketplaceWebSmoke/1.0' } },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;

        if (status >= 300 && status < 400 && location && redirects < 5) {
          res.resume();
          resolve(fetchTextUrl(new URL(location, parsed).toString(), redirects + 1));
          return;
        }

        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => resolve({ url, status, text }));
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function fetchText(path) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  return fetchTextUrl(url);
}

async function main() {
  console.log(`Testing web app at ${base}\n`);

  try {
    const home = await fetchText('/');
    if (home.status === 200) pass('Home HTTP 200');
    else fail('Home HTTP 200', `got ${home.status}`);

    if (home.text.length > 500) pass('Home HTML size', `${home.text.length} bytes`);
    else fail('Home HTML size', `${home.text.length} bytes`);

    if (!/Metro error|ReferenceError|TypeError: Cannot/i.test(home.text)) {
      pass('Home HTML has no obvious server error');
    } else {
      fail('Home HTML has no obvious server error', 'error text in response');
    }

    const bundleMatch = home.text.match(
      /src="([^"]*(?:entry\.bundle|_expo\/static\/js\/web\/entry-[^"]+\.js)[^"]*)"/i
    );
    if (bundleMatch) {
      pass('Home references JS bundle', bundleMatch[1].slice(0, 60));
      const bundleUrl = bundleMatch[1].startsWith('http')
        ? bundleMatch[1]
        : `${base.replace(/\/$/, '')}${bundleMatch[1].startsWith('/') ? '' : '/'}${bundleMatch[1]}`;
      const bundleRes = await fetchTextUrl(bundleUrl);
      if (bundleRes.status === 200) pass('JS bundle loads', `HTTP ${bundleRes.status}`);
      else fail('JS bundle loads', `HTTP ${bundleRes.status}`);
    } else {
      fail('Home references JS bundle');
    }
  } catch (e) {
    fail('Reach dev server', e instanceof Error ? e.message : String(e));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main();
