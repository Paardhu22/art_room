import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { addresses, handlePadRequest, handlePadUpgrade } from './pad-link.mjs';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? '../dist/' : '../', import.meta.url));
const port = Number(process.env.PORT || 4300);
// --lan lets a phone on the same Wi-Fi, Bluetooth or USB-tethered network reach the phone pad.
const lan = process.argv.includes('--lan');
const host = process.env.HOST || (lan ? '0.0.0.0' : '127.0.0.1');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (request, response) => {
  if (handlePadRequest(request, response, { port: () => server.address().port, lan: !['127.0.0.1', 'localhost', '::1'].includes(host) })) return;
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const segments = pathname.split('/');
    if (segments.some(segment => segment.startsWith('.')) || pathname.includes('\0') || pathname.includes('\\')) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const file = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(`${path.resolve(root)}${path.sep}`)) { response.writeHead(404); response.end('Not found'); return; }
    const info = await stat(file);
    if (info.isDirectory()) {
      // /pad → /pad/, so the folder's page loads its files relative to itself.
      response.writeHead(301, { Location: `${encodeURI(pathname)}/` }); response.end(); return;
    }
    if (!info.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    const data = request.method === 'HEAD' ? null : await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(data);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500);
    response.end('Unable to open this page.');
  }
});
server.on('upgrade', (request, socket) => {
  if (!handlePadUpgrade(request, socket)) socket.destroy();
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Try PORT=${port + 1} npm start.` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Art Room → http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}${process.argv.includes('--dist') ? ' (production build)' : ''}`);
  if (host !== '0.0.0.0') return;
  for (const { address, kind } of addresses()) console.log(`  phone pad (${kind}) → http://${address}:${port}/pad/`);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300).unref(); // open phone pad links don't hold the server up
  });
}
