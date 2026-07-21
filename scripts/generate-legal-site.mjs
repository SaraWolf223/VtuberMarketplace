#!/usr/bin/env node
/**
 * Generates static HTML legal pages for yourdomain.com from docs/legal/*.md
 * Run: node scripts/generate-legal-site.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLegalIdentity, readLegalIdentity } from './legal-template-values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs', 'legal');
const outDir = path.join(root, 'website');

const identity = readLegalIdentity(docsDir);
const supportEmail = identity.supportEmail;

const PAGES = [
  { slug: 'terms', file: 'TERMS_OF_SERVICE.md', title: 'Terms of Service' },
  { slug: 'privacy', file: 'PRIVACY_POLICY.md', title: 'Privacy Policy' },
  { slug: 'community', file: 'COMMUNITY_GUIDELINES.md', title: 'Community Guidelines' },
  { slug: 'seller-agreement', file: 'SELLER_AGREEMENT.md', title: 'Seller Agreement' },
  { slug: 'buyer-purchase-terms', file: 'BUYER_PURCHASE_TERMS.md', title: 'Buyer Purchase Terms' },
  { slug: 'dmca', file: 'DMCA_COPYRIGHT_POLICY.md', title: 'DMCA / Copyright Policy' },
];

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal markdown → HTML for legal docs (headings, lists, tables, links, bold). */
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    out.push('<table>');
    tableRows.forEach((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      out.push('<tr>' + row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>');
    });
    out.push('</table>');
    tableRows = [];
    inTable = false;
  };

  const inline = (text) => {
    let s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  };

  for (const line of lines) {
    if (line.startsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    }
    if (inTable) flushTable();

    if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ')) {
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === '---') {
      out.push('<hr />');
    } else if (line.trim() === '') {
      out.push('');
    } else if (line.startsWith('> ')) {
      out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
    } else {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inTable) flushTable();

  return out.join('\n');
}

const css = `
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #0a0a0f; background: #f8fafc; }
  h1 { font-size: 1.75rem; margin-top: 0; }
  h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
  h3 { font-size: 1.05rem; margin-top: 1.5rem; }
  a { color: #0066ff; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #eff6ff; }
  blockquote { border-left: 3px solid #0066ff; margin: 1rem 0; padding: 0.5rem 1rem; background: #fff; color: #475569; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
  nav { margin-bottom: 2rem; font-size: 0.9rem; }
  nav a { margin-right: 1rem; }
  footer { margin-top: 3rem; font-size: 0.85rem; color: #64748b; }
`;

const nav = PAGES.map(
  (p) => `<a href="/${p.slug}">${escapeHtml(p.title)}</a>`
).join('\n    ');

for (const page of PAGES) {
  const md = applyLegalIdentity(fs.readFileSync(path.join(docsDir, page.file), 'utf8'), identity);
  const body = markdownToHtml(md);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)} — ${escapeHtml(identity.appName)}</title>
  <style>${css}</style>
</head>
<body>
  <nav>${nav}</nav>
  <main>${body}</main>
  <footer>${escapeHtml(identity.appName)} · <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></footer>
</body>
</html>`;
  const dir = path.join(outDir, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log('Wrote', path.join(dir, 'index.html'));
}

const legalDir = path.join(outDir, 'legal');
const home = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(identity.appName)} Legal</title>
  <style>${css}</style>
</head>
<body>
  <nav><a href="/">← ${escapeHtml(identity.appName)} home</a></nav>
  <h1>${escapeHtml(identity.appName)} Legal</h1>
  <p>Global marketplace for pre-made digital VTuber assets.</p>
  <ul>
    ${PAGES.map((p) => `<li><a href="/${p.slug}">${escapeHtml(p.title)}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>`;
fs.mkdirSync(legalDir, { recursive: true });
fs.writeFileSync(path.join(legalDir, 'index.html'), home, 'utf8');
console.log('Wrote website/legal/index.html (marketing home is website/index.html — not overwritten)');
