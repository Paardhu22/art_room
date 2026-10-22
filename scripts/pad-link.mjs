// Pad link — relays pen input from a phone (the pad) to the Art Grid on the computer (the host).
// A tiny WebSocket server with no dependencies: phone and host join the same room code,
// and every text message from one side is passed to the other side untouched.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ROOM = /^[A-Z0-9]{4,8}$/;
const PEER_ID = /^[a-z0-9]{4,12}$/;
const MAX_MESSAGE = 4 * 1024 * 1024;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const rooms = new Map(); // room code → Set of peers

// What kind of link an interface is, judged by its name (Linux, macOS and Windows naming).
function linkKind(name) {
  if (/^(bnep|bt|pan)|bluetooth/i.test(name)) return 'bluetooth';
  if (/^(usb|rndis|enx|enp\d+s\d+(f\d+)?u)|usb|rndis|iphone/i.test(name)) return 'usb';
  if (/^(wl|wlan)|wi-?fi|wireless/i.test(name)) return 'wifi';
  if (/^(docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|utun|zt|tailscale|wg|lxc|lxd)/i.test(name)) return 'virtual';
  return 'ethernet';
}

// This computer's addresses a phone could reach, with the kind of link each one is.
export function addresses() {
  const list = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) continue;
      const kind = linkKind(name);
      if (kind !== 'virtual') list.push({ name, address: entry.address, kind });
    }
  }
  return list;
}

const json = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
};

// Requests from a page on another site must not reach the pad endpoints.
function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch (_) { return false; }
}

// `adb reverse` makes the phone's own localhost:PORT reach this server over the USB cable.
function adbReverse(port) {
  return new Promise(resolve => {
    execFile(process.env.ADB || 'adb', ['reverse', `tcp:${port}`, `tcp:${port}`], { timeout: 6000 }, (error, stdout, stderr) => {
      if (!error) { resolve({ ok: true }); return; }
      const text = `${stderr || ''} ${error.message || ''}`;
      if (error.code === 'ENOENT') resolve({ ok: false, reason: 'no-adb' });
      else if (/unauthori[sz]ed/i.test(text)) resolve({ ok: false, reason: 'unauthorized' });
      else if (/more than one/i.test(text)) resolve({ ok: false, reason: 'many' });
      else if (/no devices|not found|offline/i.test(text)) resolve({ ok: false, reason: 'no-device' });
      else resolve({ ok: false, reason: 'error', detail: text.trim().slice(0, 200) });
    });
  });
}

// Handles /pad-link/* HTTP requests. Returns false for any other path.
export function handlePadRequest(request, response, { port, lan }) {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (!pathname.startsWith('/pad-link/')) return false;
  if (!sameOrigin(request)) { json(response, 403, { ok: false }); return true; }
  if (pathname === '/pad-link/info' && request.method === 'GET') {
    json(response, 200, { port: port(), lan, addresses: addresses() });
  } else if (pathname === '/pad-link/adb' && request.method === 'POST') {
    // Only the computer itself may run adb.
    if (!LOOPBACK.has(request.socket.remoteAddress)) { json(response, 403, { ok: false, reason: 'remote' }); return true; }
    adbReverse(port()).then(result => json(response, 200, result));
  } else {
    json(response, 404, { ok: false });
  }
  return true;
}

// ---------- WebSocket framing ----------
function frame(opcode, payload) {
  const length = payload.length;
  let head;
  if (length < 126) {
    head = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([head, payload]);
}

function sendText(peer, text) {
  if (!peer.socket.destroyed && peer.socket.writable) peer.socket.write(frame(0x1, Buffer.from(text)));
}

function close(peer, code = 1000) {
  if (peer.closed) return;
  peer.closed = true;
  const body = Buffer.alloc(2);
  body.writeUInt16BE(code, 0);
  if (peer.socket.writable) peer.socket.end(frame(0x8, body));
  else peer.socket.destroy();
}

// Splits incoming bytes into frames; client frames are always masked.
function readFrames(peer, chunk) {
  peer.buffer = peer.buffer.length ? Buffer.concat([peer.buffer, chunk]) : chunk;
  for (;;) {
    const b = peer.buffer;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    if (!(b[1] & 0x80)) { close(peer, 1002); return; }
    let length = b[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (b.length < 4) return;
      length = b.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(MAX_MESSAGE)) { close(peer, 1009); return; }
      length = Number(big);
      offset = 10;
    }
    if (length > MAX_MESSAGE) { close(peer, 1009); return; }
    if (b.length < offset + 4 + length) return;
    const mask = b.subarray(offset, offset + 4);
    const data = Buffer.from(b.subarray(offset + 4, offset + 4 + length));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    peer.buffer = b.subarray(offset + 4 + length);
    if (!handleFrame(peer, fin, opcode, data)) return;
  }
}

function handleFrame(peer, fin, opcode, data) {
  if (opcode === 0x8) { close(peer); return false; }
  if (opcode === 0x9) { if (peer.socket.writable) peer.socket.write(frame(0xa, data)); return true; }
  if (opcode === 0xa) { peer.alive = true; return true; }
  if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
    if (opcode !== 0x0) peer.parts = [];
    peer.parts.push(data);
    peer.size = (opcode === 0x0 ? peer.size : 0) + data.length;
    if (peer.size > MAX_MESSAGE) { close(peer, 1009); return false; }
    if (fin) {
      const text = Buffer.concat(peer.parts).toString('utf8');
      peer.parts = [];
      peer.size = 0;
      relay(peer, text);
    }
    return true;
  }
  close(peer, 1002);
  return false;
}

// ---------- Rooms ----------
function relay(from, text) {
  from.alive = true;
  for (const peer of rooms.get(from.room) || []) {
    if (peer.role !== from.role) sendText(peer, text);
  }
}

function announce(room) {
  const peers = rooms.get(room);
  if (!peers) return;
  const list = [...peers];
  const message = JSON.stringify({
    t: 'peers',
    host: list.filter(p => p.role === 'host').length,
    pads: list.filter(p => p.role === 'pad').map(p => p.id)
  });
  for (const peer of list) sendText(peer, message);
}

function join(peer) {
  if (!rooms.has(peer.room)) rooms.set(peer.room, new Set());
  const peers = rooms.get(peer.room);
  // One host per room: the newest one takes over (say, the page was reopened in a new tab).
  if (peer.role === 'host') {
    for (const other of peers) {
      if (other.role !== 'host') continue;
      sendText(other, JSON.stringify({ t: 'replaced' }));
      peers.delete(other);
      close(other, 4000);
    }
  }
  peers.add(peer);
  announce(peer.room);
}

function leave(peer) {
  const peers = rooms.get(peer.room);
  if (!peers || !peers.delete(peer)) return;
  if (!peers.size) rooms.delete(peer.room);
  else announce(peer.room);
}

// Drop phones that went to sleep without saying goodbye.
const heartbeat = setInterval(() => {
  for (const peers of rooms.values()) {
    for (const peer of peers) {
      if (!peer.alive) { peer.socket.destroy(); continue; }
      peer.alive = false;
      if (peer.socket.writable) peer.socket.write(frame(0x9, Buffer.alloc(0)));
    }
  }
}, 15000);
heartbeat.unref();

// Handles the HTTP upgrade for /pad-link. Returns false for any other path.
export function handlePadUpgrade(request, socket) {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname !== '/pad-link') return false;
  const key = request.headers['sec-websocket-key'];
  const room = (url.searchParams.get('room') || '').toUpperCase();
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id') || '';
  const valid = key && /websocket/i.test(request.headers.upgrade || '') && ROOM.test(room) &&
    (role === 'host' || (role === 'pad' && PEER_ID.test(id))) && sameOrigin(request);
  if (!valid) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return true;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true); // pen samples go out the moment they arrive
  socket.setTimeout(0);
  const peer = { socket, room, role, id, buffer: Buffer.alloc(0), parts: [], size: 0, alive: true, closed: false };
  socket.on('data', chunk => readFrames(peer, chunk));
  socket.on('close', () => leave(peer));
  socket.on('error', () => socket.destroy());
  join(peer);
  return true;
}
