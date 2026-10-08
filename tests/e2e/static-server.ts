import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

export interface StaticSite {
  url: string;
  /** Publie une « nouvelle version » : sw.js change de contenu. */
  publishUpdate(): void;
  close(): Promise<void>;
}

/** Hébergeur statique minimal sur un port libre : dist/ tel qu'il serait mis en ligne. */
export async function serveDist(): Promise<StaticSite> {
  const root = join(import.meta.dirname, '..', '..', 'dist');
  let version = 1;
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^[\\/]+/, '');
    const file = join(root, path || 'index.html');
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    readFile(file).then(
      (body) => {
        const out = path === 'sw.js' && version > 1 ? Buffer.concat([body, Buffer.from(`\n// v${version}\n`)]) : body;
        res.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-cache',
        });
        res.end(out);
      },
      () => res.writeHead(404).end(),
    );
  });
  await new Promise<void>((r) => server.listen(0, 'localhost', r));
  const { port } = server.address() as AddressInfo;
  return {
    // localhost : contexte sécurisé, service worker autorisé sans HTTPS
    url: `http://localhost:${port}/`,
    publishUpdate: () => version++,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
