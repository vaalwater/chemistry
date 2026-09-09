import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// 用法: node scripts/serve.mjs <目录> [端口]
const dir = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(dir, p));
    if (!file.startsWith(normalize(dir))) throw new Error('forbidden');
    let data;
    try {
      data = await readFile(file);
    } catch {
      // SPA fallback
      data = await readFile(join(dir, 'index.html'));
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(port, () => {
  console.log('静态预览服务器: http://localhost:' + port + ' （目录 ' + dir + '）');
});
