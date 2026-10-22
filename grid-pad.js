// Grid Pad — lets a phone write on the Art Grid. The phone (pad/index.html) sends pen samples
// through the local server's relay; this side turns them into ink exactly like the pen tool's,
// so undo, the eraser, saving and SVG export all treat them the same.
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ROOM_KEY = 'art-room:pad-room';
  const MODE_KEY = 'art-room:pad-mode';
  const ON_KEY = 'art-room:pad-on';
  const ERASER = 12; // screen pixels, as with the pen tool's eraser
  const onThisComputer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

  const $ = sel => document.querySelector(sel);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round1 = v => Math.round(v * 10) / 10;
  const round2 = v => Math.round(v * 100) / 100;
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* storage can be unavailable */ } }
  };

  const STEPS = {
    cable: [
      'Plug your phone into this computer with a USB cable.',
      'Android: turn on <b>USB debugging</b> (Settings → Developer options) and allow this computer when the phone asks.',
      'Scan the code with the phone, or open the address below in its browser.'
    ],
    bluetooth: [
      'Pair the phone with this computer in Bluetooth settings.',
      'On the phone, turn on <b>Bluetooth tethering</b> (Android: Hotspot &amp; tethering · iPhone: Personal Hotspot), then connect this computer to it.',
      'Scan the code with the phone.'
    ],
    wifi: [
      'Put the phone on the same Wi‑Fi network as this computer.',
      'Scan the code with the phone, or open the address below in its browser.'
    ]
  };
  const LAN_HINT = 'The server only accepts connections from this computer right now. Stop it and start it with <code>npm run pad</code> so the phone can reach it.';
  const ADB_PROBLEMS = {
    'no-adb': 'adb isn’t installed, so the cable can’t carry the link by itself. Install Android platform-tools, or turn on USB tethering on the phone and start the server with <code>npm run pad</code>.',
    'no-device': 'No phone found over USB yet. Plug it in and turn on USB debugging.',
    unauthorized: 'The phone hasn’t trusted this computer yet. Tap <b>Allow</b> on the USB debugging prompt.',
    many: 'More than one Android device is plugged in. Unplug the others.',
    remote: 'Open the Art Grid on the computer the phone is plugged into.'
  };
  const TRANSPORT = { usb: 'USB', bluetooth: 'Bluetooth', wifi: 'Wi‑Fi', ethernet: 'the network' };

  function attach(host) {
    const { randomCode, connect } = window.PadShared;
    const GI = window.GridInk;

    const pop = $('#phone-pop');
    const button = $('#pen-phone');
    const dot = $('#phone-dot');
    const modeButtons = [...pop.querySelectorAll('[data-mode]')];

    let room = store.get(ROOM_KEY);
    if (!/^[A-Z0-9]{4}$/.test(room || '')) {
      room = randomCode(4);
      store.set(ROOM_KEY, room);
    }
    $('#phone-code').textContent = room;
    let mode = store.get(MODE_KEY);
    if (!['cable', 'bluetooth', 'wifi'].includes(mode)) mode = 'cable';

    let active = false;
    let link = null;
    let linkState = 'off';
    let info = null; // /pad-link/info, or false when this server has no pad link
    let adb = null;
    let pollTimer = 0;

    const pads = new Map(); // pad id → { id, name, host, el, pos, down, erasing, seen, rtt, color, greeted, fade }
    const live = new Map(); // "pad:stroke" → { pad, stroke, path } or { pad, erase: true, erased }
    const strokeIds = new WeakMap();
    const origins = new WeakMap(); // stroke → "pad:stroke", so the phone can drop its own preview
    let nextStrokeId = 1;
    const sent = new Set(); // strokes the phones already have

    const idOf = stroke => {
      if (!strokeIds.has(stroke)) strokeIds.set(stroke, nextStrokeId++);
      return strokeIds.get(stroke);
    };
    const send = (msg, keep = false) => link && link.send(msg, keep);

    // ---------- Keeping the phone's copy in step ----------
    function viewMessage() {
      const v = host.view();
      return { t: 'view', ox: v.ox, oy: v.oy, vw: v.w / v.scale, vh: v.h / v.scale, W: v.w, min: host.minScale, max: host.maxScale };
    }

    const wire = s => ({ i: idOf(s), o: origins.get(s) || '', c: s.c, w: s.w, h: s.h, p: s.p });
    let lastView = '';
    let lastItems = '';
    let syncQueued = false;

    // Strokes added or removed since the phones last heard.
    function flushInk() {
      const ink = new Set(host.ink());
      const add = [];
      const del = [];
      for (const s of sent) if (!ink.has(s)) { sent.delete(s); del.push(idOf(s)); }
      for (const s of ink) if (!sent.has(s)) { sent.add(s); add.push(wire(s)); }
      if (add.length || del.length) send({ t: 'ink', add, del });
    }

    // Called by the Art Grid after anything changes; the work happens once per frame.
    function sync() {
      if (!pads.size || syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(() => {
        syncQueued = false;
        if (!pads.size) return;
        flushInk();
        const view = viewMessage();
        const viewKey = [view.ox, view.oy, view.vw, view.vh].map(n => n.toFixed(2)).join();
        if (viewKey !== lastView) { lastView = viewKey; send(view); }
        const list = host.items();
        const itemsKey = JSON.stringify(list);
        if (itemsKey !== lastItems) { lastItems = itemsKey; send({ t: 'items', list }); }
        for (const pad of pads.values()) placeCursor(pad);
      });
    }

    // A phone just arrived (or this page reloaded): send it everything.
    function welcome(pad) {
      flushInk(); // the other phones first catch up, so `sent` matches the ink for everyone
      send({ t: 'cfg', to: pad.id, colors: host.colors, pen: host.penSizes, marker: host.markerSizes, eraser: ERASER, grid: host.cell });
      send({ ...viewMessage(), to: pad.id });
      send({ t: 'items', to: pad.id, list: host.items() });
      send({ t: 'ink', to: pad.id, reset: true, add: host.ink().map(wire), del: [] });
    }

    // ---------- Cursors: where each phone's pen is ----------
    function placeCursor(pad) {
      const now = performance.now();
      const on = pad.pos && (pad.down || now - pad.seen < 1200);
      pad.el.classList.toggle('is-on', !!on);
      pad.el.classList.toggle('is-down', !!(on && pad.down && !pad.erasing));
      pad.el.classList.toggle('is-erase', !!(on && pad.erasing));
      if (pad.color) pad.el.style.setProperty('--c', pad.color);
      if (pad.pos) {
        // Inside the canvas, so it moves with it; scaled back so it stays the same size on screen.
        pad.el.style.transform = `translate(${pad.pos.x}px, ${pad.pos.y}px) scale(${1 / host.view().scale})`;
      }
      clearTimeout(pad.fade);
      if (on && !pad.down) pad.fade = setTimeout(() => placeCursor(pad), 1300);
    }

    // ---------- Pen input from the phones ----------
    function points(list) {
      const out = [];
      if (!Array.isArray(list)) return out;
      for (let i = 0; i + 2 < list.length && out.length < 9000; i += 3) {
        const [u, v, p] = [list[i], list[i + 1], list[i + 2]];
        if (!Number.isFinite(u) || !Number.isFinite(v) || Math.abs(u) > 50 || Math.abs(v) > 50) continue;
        out.push(u, v, Number.isFinite(p) ? clamp(p, 0, 1) : 0.5);
      }
      return out;
    }

    let drawQueued = false;
    function drawLive() {
      drawQueued = false;
      for (const entry of live.values()) {
        if (!entry.path || !entry.dirty) continue;
        entry.dirty = false;
        if (!entry.path.isConnected) host.liveLayer.append(entry.path); // undo redraws the ink layer
        entry.path.setAttribute('d', GI.pathD(entry.stroke));
      }
    }

    function extend(entry, pts) {
      const v = host.view();
      let erased = 0;
      for (let i = 0; i < pts.length; i += 3) {
        const x = v.ox + (pts[i] * v.w) / v.scale;
        const y = v.oy + (pts[i + 1] * v.h) / v.scale;
        entry.pad.pos = { x, y };
        entry.pad.seen = performance.now();
        if (entry.erase) { erased += host.erase(x, y, ERASER / v.scale, entry); continue; }
        const p = entry.stroke.p;
        const n = p.length;
        if (n >= 3 && (x - p[n - 3]) ** 2 + (y - p[n - 2]) ** 2 < (0.5 / v.scale) ** 2) continue;
        p.push(round1(x), round1(y), round2(pts[i + 2]));
      }
      if (erased) host.save();
      if (entry.path) {
        entry.dirty = true;
        if (!drawQueued) { drawQueued = true; requestAnimationFrame(drawLive); }
      }
      placeCursor(entry.pad);
    }

    function strokeDown(pad, msg) {
      const key = `${pad.id}:${msg.s}`;
      if (live.has(key)) return;
      let entry;
      if (msg.tool === 'eraser') {
        entry = { pad, erase: true, erased: false };
      } else {
        const marker = msg.tool === 'marker';
        const size = [0, 1, 2].includes(msg.z) ? msg.z : 1;
        const color = host.colors.includes(msg.c) ? msg.c : host.colors[0];
        const px = (marker ? host.markerSizes : host.penSizes)[size];
        const stroke = { c: color, w: round2(px / host.view().scale), h: marker ? 1 : 0, p: [] };
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('fill', color);
        if (marker) path.setAttribute('class', 'is-marker');
        host.liveLayer.append(path);
        entry = { pad, stroke, path, dirty: false };
        pad.color = color;
      }
      live.set(key, entry);
      pad.down = true;
      pad.erasing = !!entry.erase;
      extend(entry, points(msg.pts));
    }

    function finish(entry, key, cancel) {
      const { pad } = entry;
      pad.down = [...live.values()].some(e => e.pad === pad);
      pad.erasing = false;
      placeCursor(pad);
      if (entry.erase) return;
      if (cancel || !entry.stroke.p.length) { entry.path.remove(); return; }
      if (!entry.path.isConnected) host.liveLayer.append(entry.path);
      origins.set(entry.stroke, key);
      host.commit(entry.stroke, entry.path);
    }

    function strokeUp(pad, msg, cancel) {
      const key = `${pad.id}:${msg.s}`;
      const entry = live.get(key);
      if (!entry) return;
      if (msg.pts) extend(entry, points(msg.pts));
      live.delete(key);
      finish(entry, key, cancel);
    }

    function hover(pad, msg) {
      if (Number.isFinite(msg.u) && Number.isFinite(msg.v)) {
        const v = host.view();
        pad.pos = { x: v.ox + (msg.u * v.w) / v.scale, y: v.oy + (msg.v * v.h) / v.scale };
        pad.seen = performance.now();
      } else if (!pad.down) {
        pad.seen = 0;
      }
      placeCursor(pad);
    }

    // A phone pinched or panned: it sends the view it wants.
    function padView(msg) {
      if (![msg.ox, msg.oy, msg.vw].every(Number.isFinite) || msg.vw <= 0) return;
      host.setView(msg.ox, msg.oy, host.view().w / msg.vw);
    }

    // ---------- Phones coming and going ----------
    function transportOf(pad) {
      if (['localhost', '127.0.0.1', '[::1]'].includes(pad.host)) return 'USB cable';
      const match = info && info.addresses.find(a => a.address === pad.host);
      return match ? TRANSPORT[match.kind] || 'the network' : 'the network';
    }

    function addPad(id) {
      const el = document.createElement('div');
      el.className = 'pad-cursor';
      el.setAttribute('aria-hidden', 'true');
      host.world.append(el);
      const pad = { id, name: 'Phone', host: '', el, pos: null, down: false, erasing: false, seen: 0, rtt: null, color: null, greeted: false, fade: 0 };
      pads.set(id, pad);
      return pad;
    }

    function dropPad(pad) {
      for (const [key, entry] of live) {
        if (entry.pad !== pad) continue;
        live.delete(key);
        finish(entry, key, false); // keep what was written before the phone went away
      }
      clearTimeout(pad.fade);
      pad.el.remove();
      pads.delete(pad.id);
    }

    function onHello(msg) {
      const pad = pads.get(msg.id) || addPad(msg.id);
      pad.name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 40) : 'Phone';
      pad.host = typeof msg.host === 'string' ? msg.host.slice(0, 64) : '';
      welcome(pad);
      if (!pad.greeted) {
        pad.greeted = true;
        host.toast(`${pad.name} connected over ${transportOf(pad)}. Write on the phone.`);
        showPanel(false);
      }
      updateStatus();
      holdScreen();
    }

    function onPeers(msg) {
      const ids = new Set((Array.isArray(msg.pads) ? msg.pads : []).filter(id => typeof id === 'string'));
      for (const pad of [...pads.values()]) if (!ids.has(pad.id)) dropPad(pad);
      for (const id of ids) if (!pads.has(id)) addPad(id);
      updateStatus();
      holdScreen();
    }

    function onMessage(msg) {
      if (msg.t === 'peers') { onPeers(msg); return; }
      if (msg.t === 'replaced') {
        // Another tab took over this room; leave the setting on for that tab.
        stopLink();
        active = false;
        updateStatus();
        host.toast('The phone pad moved to another tab.');
        return;
      }
      if (typeof msg.id !== 'string') return;
      if (msg.t === 'hi') { onHello(msg); return; }
      const pad = pads.get(msg.id);
      if (!pad) return;
      switch (msg.t) {
        case 'd': strokeDown(pad, msg); break;
        case 'm': { const entry = live.get(`${pad.id}:${msg.s}`); if (entry) extend(entry, points(msg.pts)); break; }
        case 'u': strokeUp(pad, msg, false); break;
        case 'x': strokeUp(pad, msg, true); break;
        case 'h': hover(pad, msg); break;
        case 'view': padView(msg); break;
        case 'undo': host.undo(); break;
        case 'redo': host.redo(); break;
        case 'clear': host.clear(); break;
        case 'home': host.showAll(); break;
        case 'pong':
          if (Number.isFinite(msg.n)) pad.rtt = performance.now() - msg.n;
          updateStatus();
          break;
        default: break;
      }
    }

    // Round-trip time to each phone, shown here and on the phone.
    setInterval(() => {
      if (!pads.size || !link || !link.open) return;
      const rtt = {};
      for (const pad of pads.values()) if (pad.rtt != null) rtt[pad.id] = Math.round(pad.rtt);
      send({ t: 'ping', n: performance.now(), rtt });
    }, 2000);

    // Keep the screen awake while a phone is writing (where the browser allows it).
    let wakeLock = null;
    async function holdScreen() {
      const want = pads.size > 0 && document.visibilityState === 'visible';
      if (want && !wakeLock && navigator.wakeLock) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (_) { /* not allowed here; the screen may dim */ }
      } else if (!want && wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    }
    document.addEventListener('visibilitychange', holdScreen);

    // ---------- The link ----------
    function startLink() {
      if (link) return;
      link = connect({
        role: 'host',
        room,
        onMessage,
        onState(state) {
          linkState = state;
          if (state === 'open') link.send({ t: 'sync' }, false); // phones already waiting say hello
          if (state === 'closed') for (const pad of [...pads.values()]) dropPad(pad);
          updateStatus();
        }
      });
    }

    function stopLink() {
      if (link) link.stop();
      link = null;
      linkState = 'off';
      for (const pad of [...pads.values()]) dropPad(pad);
      holdScreen();
    }

    function turnOn() {
      active = true;
      store.set(ON_KEY, '1');
      poll();
    }

    function turnOff() {
      active = false;
      store.set(ON_KEY, '');
      clearTimeout(pollTimer);
      stopLink();
      showPanel(false);
      updateStatus();
    }

    // ---------- Connect panel ----------
    function updateStatus() {
      const connected = [...pads.values()].filter(p => p.greeted);
      let tone = 'off';
      let text = 'Off';
      if (active && info === false) {
        tone = 'bad';
        text = 'Needs the Art Room server';
      } else if (active && linkState !== 'open') {
        tone = 'wait';
        text = 'Starting…';
      } else if (active && connected.length === 1) {
        const [pad] = connected;
        tone = 'good';
        text = `${pad.name} · ${transportOf(pad)}${pad.rtt != null ? ` · ${Math.max(1, Math.round(pad.rtt))} ms` : ''}`;
      } else if (active && connected.length > 1) {
        tone = 'good';
        text = `${connected.length} phones writing`;
      } else if (active) {
        tone = 'wait';
        text = 'Waiting for your phone';
      }
      dot.dataset.tone = tone;
      button.title = active ? `Phone pad: ${text}` : 'Write on your phone and see it here, over cable, Bluetooth or Wi‑Fi';
      $('#phone-status').textContent = text;
      $('#phone-status').dataset.tone = tone;
      $('#phone-off').hidden = !active;
    }

    function setState(html, tone) {
      const el = $('#phone-state');
      el.innerHTML = html;
      el.dataset.tone = tone;
    }

    function stateText(text, tone) {
      const el = $('#phone-state');
      el.textContent = text;
      el.dataset.tone = tone;
    }

    function renderPanel() {
      for (const btn of modeButtons) btn.setAttribute('aria-checked', String(btn.dataset.mode === mode));
      $('#phone-steps').innerHTML = STEPS[mode].map(step => `<li>${step}</li>`).join('');
      const addresses = info ? info.addresses : [];
      const find = kinds => addresses.find(a => kinds.includes(a.kind));
      let address = null;

      if (info === false) {
        setState('The phone pad needs the Art Room server. On this computer, run <code>npm run pad</code> and open the Art Grid from it.', 'bad');
      } else if (info === null) {
        setState('Checking this computer’s connections…', 'wait');
      } else if (mode === 'cable') {
        const usb = info.lan && find(['usb']);
        if (adb && adb.ok) {
          address = 'localhost';
          setState('USB link ready. Scan the code with the phone.', 'good');
        } else if (usb) {
          address = usb.address;
          stateText(`USB tethering found (${usb.name}). Scan the code with the phone.`, 'good');
        } else if (!onThisComputer) {
          setState(ADB_PROBLEMS.remote, 'bad');
        } else if (!adb) {
          setState('Looking for a phone on the USB cable…', 'wait');
        } else if (ADB_PROBLEMS[adb.reason]) {
          setState(ADB_PROBLEMS[adb.reason], adb.reason === 'no-device' ? 'wait' : 'bad');
        } else {
          stateText(`adb couldn’t set up the link: ${adb.detail || 'unknown error'}`, 'bad');
        }
      } else if (!info.lan) {
        setState(LAN_HINT, 'bad');
      } else if (mode === 'bluetooth') {
        const bt = find(['bluetooth']);
        if (bt) {
          address = bt.address;
          stateText(`Bluetooth network ready (${bt.name}). Bluetooth adds a little delay; Cable is the most precise.`, 'good');
        } else {
          setState('Waiting for the phone’s Bluetooth network to appear on this computer…', 'wait');
        }
      } else {
        const net = find(['wifi', 'ethernet']);
        if (net) {
          address = net.address;
          stateText(`Ready on ${net.kind === 'wifi' ? 'Wi‑Fi' : 'the network'} (${net.address}).`, 'good');
        } else {
          setState('This computer isn’t on a network right now.', 'bad');
        }
      }

      const qr = $('#phone-qr');
      if (address) {
        const url = `http://${address}:${info.port}/pad/#${room}`;
        const code = window.QR.encode(url, 'M');
        qr.classList.remove('is-waiting');
        qr.innerHTML = `<svg viewBox="-1 -1 ${code.size + 2} ${code.size + 2}" shape-rendering="crispEdges" aria-hidden="true"><path d="${window.QR.svgPath(code)}"/></svg>`;
        $('#phone-url').textContent = `${address}:${info.port}/pad`;
      } else {
        qr.classList.add('is-waiting');
        qr.replaceChildren();
        $('#phone-url').textContent = '';
      }
    }

    // Looks at this computer's connections (and runs adb for the cable) every few seconds
    // while the panel is open. The link to the relay starts once the server answers.
    async function poll() {
      clearTimeout(pollTimer);
      if (!active) return;
      try {
        const response = await fetch('/pad-link/info', { cache: 'no-store' });
        info = response.ok ? await response.json() : false;
      } catch (_) {
        info = false;
      }
      if (info && mode === 'cable' && onThisComputer && !pop.hidden) {
        try {
          const response = await fetch('/pad-link/adb', { method: 'POST', cache: 'no-store' });
          adb = await response.json();
        } catch (_) {
          adb = null;
        }
      }
      if (!active) return;
      if (info) startLink();
      if (!pop.hidden) renderPanel();
      updateStatus();
      if (!pop.hidden || !info) pollTimer = setTimeout(poll, pop.hidden ? 10000 : 3000);
    }

    function showPanel(open) {
      pop.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        renderPanel();
        poll();
      }
    }

    button.addEventListener('click', () => {
      if (!active) { turnOn(); showPanel(true); return; }
      showPanel(pop.hidden);
    });
    $('#phone-close').addEventListener('click', () => showPanel(false));
    $('#phone-off').addEventListener('click', turnOff);

    for (const btn of modeButtons) {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        store.set(MODE_KEY, mode);
        adb = null;
        renderPanel();
        poll();
      });
    }
    // Arrow keys move between the three modes, like any radio group.
    pop.querySelector('.phone-modes').addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = modeButtons[(modeButtons.findIndex(b => b.dataset.mode === mode) + step + 3) % 3];
      next.focus();
      next.click();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !pop.hidden) showPanel(false);
    });
    document.addEventListener('pointerdown', e => {
      if (!pop.hidden && !e.target.closest('.grid-phone, #pen-phone')) showPanel(false);
    });

    // The phone pad stays on across reloads until it's turned off.
    if (store.get(ON_KEY) === '1') turnOn();
    updateStatus();

    return { sync };
  }

  window.GridPad = { attach };
})();
