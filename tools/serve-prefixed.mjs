#!/usr/bin/env node
/**
 * Pre-flight for GitHub Pages: serve the project under a URL PREFIX, the way a
 * project site is served at https://<user>.github.io/<repo>/ .
 *
 * A project site lives at a subpath, so any path in the source that starts with
 * a bare "/" would resolve to the domain root and 404. This reproduces that
 * layout locally so it can be caught before deploying.
 *
 *   node tools/serve-prefixed.mjs [prefix] [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = process.argv[2] ?? '/composition-destijl';
const PORT = Number(process.argv[3] ?? 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.ttf': 'font/ttf', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (!pathname.startsWith(PREFIX + '/') && pathname !== PREFIX) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`404 ${pathname} (outside ${PREFIX})`);
      return;
    }
    pathname = pathname.slice(PREFIX.length);
    if (pathname === '' || pathname.endsWith('/')) pathname += 'index.html';

    const target = normalize(join(ROOT, pathname));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      // a request that escapes the prefix would have 404'd above; reaching here
      // with a bare path means the page asked for something at the domain root
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`404 ${pathname}`);
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.length, 'cache-control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(`500 ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  prefix test — simulating a project site`);
  console.log(`  http://127.0.0.1:${PORT}${PREFIX}/\n`);
});
