import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? process.argv[3] ?? 8081);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function insideRoot(path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

function candidateFor(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  const direct = resolve(root, `.${normalized}`);
  if (insideRoot(direct) && existsSync(direct) && statSync(direct).isFile()) {
    return direct;
  }

  const html = direct.endsWith('.html') ? direct : `${direct}.html`;
  if (insideRoot(html) && existsSync(html) && statSync(html).isFile()) {
    return html;
  }

  const nestedIndex = join(direct, 'index.html');
  if (insideRoot(nestedIndex) && existsSync(nestedIndex) && statSync(nestedIndex).isFile()) {
    return nestedIndex;
  }

  return join(root, 'index.html');
}

const server = createServer((req, res) => {
  const filePath = candidateFor(req.url ?? '/');
  const type = contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream';
  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': type,
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
