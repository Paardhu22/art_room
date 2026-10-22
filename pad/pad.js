// Pen Pad — the phone side. Every pen sample goes to the Art Grid the moment it happens. The
// phone shows the grid's visible area as a dark field of blue dots that glow around the pen,
// with a light copy of the grid's ink so you can see where you are writing.
(() => {
  'use strict';

  const { randomCode, connect } = window.PadShared;
  const GI = window.GridInk;
  const PREFS_KEY = 'art-room:pad-prefs';
  const CODE_KEY = 'art-room:pad-code';
  const TAU = Math.PI * 2;
  // pointerrawupdate hands over pen samples as soon as they arrive, not once per frame.
  // Browsers only offer it on secure pages, such as localhost over the USB cable.
  const MOVE = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove';
  const id = randomCode(8, 'abcdefghijkmnpqrstuvwxyz23456789');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const $ = sel => document.querySelector(sel);
  const surface = $('#surface');
  const field = $('#field');
  const canvas = $('#canvas');
  const fctx = field.getContext('2d');
  const ctx = canvas.getContext('2d', { desynchronized: true });
  const noteEl = $('#note');
  const statusEl = $('#status');
  const statusText = $('#status-text');
  const stylePop = $('#style-pop');
  const morePop = $('#more-pop');

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r5 = v => Math.round(v * 100000) / 100000;
  const r2 = v => Math.round(v * 100) / 100;
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* storage can be unavailable */ } }
  };

  const prefs = { tool: 'pen', color: '', size: 1, finger: false };
  try { Object.assign(prefs, JSON.parse(store.get(PREFS_KEY) || '{}')); } catch (_) { /* defaults */ }
  if (!['pen', 'marker', 'eraser'].includes(prefs.tool)) prefs.tool = 'pen';
  if (![0, 1, 2].includes(prefs.size)) prefs.size = 1;
  prefs.finger = prefs.finger === true;
  const savePrefs = () => store.set(PREFS_KEY, JSON.stringify(prefs));

  let deviceName = /iPhone/.test(navigator.userAgent) ? 'iPhone'
    : /iPad/.test(navigator.userAgent) ? 'iPad'
      : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Pad';
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['model'])
      .then(v => { if (v.model) deviceName = v.model; })
      .catch(() => {});
  }

  // The Art Grid's inks are dark, made for paper. On black they're drawn lighter and a little
  // richer, keeping their hue, so each colour is still recognisable.
  const tints = new Map();
  function tint(hex) {
    if (!tints.has(hex)) {
      const m = /^#([0-9a-f]{6})$/i.exec(hex);
      const n = m ? parseInt(m[1], 16) : 0x363930;
      const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      const l = (max + min) / 2;
      const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
      let h = 0;
      if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = Math.round(h * 60 + 360) % 360;
      tints.set(hex, `hsl(${h} ${Math.round(Math.min(1, s * 1.5) * 100)}% ${Math.round(Math.max(l, 0.72) * 100)}%)`);
    }
    return tints.get(hex);
  }

  // ---------- State ----------
  let link = null;
  let linkState = 'connecting';
  let hostPresent = false;
  let cfg = null; // the grid's palette and sizes: { colors, pen, marker, eraser, grid }
  let view = null; // the grid's visible area in canvas units: { ox, oy, vw, vh, W, min, max }
  let items = []; // [x, y, w, h] of the grid's artworks, equations and writing
  let box = { left: 0, top: 0 };
  let sw = 1;
  let sh = 1;
  let dpr = 1;
  let fdpr = 1;
  let rect = { x: 0, y: 0, w: 1, h: 1 }; // where the grid's screen sits on the phone
  const mirror = new Map(); // grid stroke id → { st, path, b }
  const pending = new Map(); // "pad:stroke" → { st, path, t }: shown until the grid confirms it
  let seq = 0;
  let current = null;
  let tip = null; // { x, y, down, t } in surface px
  let rtt = null;
  let penSeen = false;
  let penDown = false;
  let lastPenAt = 0; // last time the pen was seen, touching or hovering
  const touches = new Map();
  let gesture = null;
  let gestureEndAt = -Infinity;
  let raf = 0;
  let expireTimer = 0;

  const ready = () => !!view && !!cfg && hostPresent;
  const local = e => ({ x: e.clientX - box.left, y: e.clientY - box.top });
  const toWorld = (x, y) => ({ x: view.ox + ((x - rect.x) / rect.w) * view.vw, y: view.oy + ((y - rect.y) / rect.h) * view.vh });

  // ---------- Layout ----------
  function layout() {
    const r = surface.getBoundingClientRect();
    box = r;
    sw = Math.max(1, r.width);
    sh = Math.max(1, r.height);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    fdpr = Math.min(2, dpr); // the dots don't need the full resolution
    canvas.width = Math.round(sw * dpr);
    canvas.height = Math.round(sh * dpr);
    field.width = Math.round(sw * fdpr);
    field.height = Math.round(sh * fdpr);
    // The grid's screen, letterboxed into the phone with the same shape.
    const aspect = view ? view.vw / view.vh : 16 / 9;
    const m = 10;
    let w = sw - m * 2;
    let h = w / aspect;
    if (h > sh - m * 2) {
      h = sh - m * 2;
      w = h * aspect;
    }
    rect = { x: (sw - w) / 2, y: (sh - h) / 2, w: Math.max(1, w), h: Math.max(1, h) };
    $('#turn').hidden = !(sh > sw && sh - (rect.y + rect.h) > 70);
    redraw();
    wakeField();
  }

  // ---------- The dot field: dots glow around the pen, ripple where it lands, and warm along its path ----------
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(220, 242, 255, 1)');
    grad.addColorStop(0.1, 'rgba(130, 200, 255, 0.95)');
    grad.addColorStop(0.32, 'rgba(50, 125, 255, 0.35)');
    grad.addColorStop(1, 'rgba(20, 60, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  })();

  const LEVELS = 6;
  const LEVEL_COLORS = Array.from({ length: LEVELS }, (_, l) =>
    `rgba(${74 + l * 18}, ${128 + l * 20}, ${232 + l * 4}, ${0.38 + l * 0.11})`);
  let ripples = [];
  const heat = new Map(); // dot key → 0..1, fades out
  const hkey = (i, j) => (i + 32768) * 65536 + (j + 32768);
  const twinkle = (i, j) => ((Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) >>> 0) % 628 / 100;
  const gridSize = () => (cfg ? cfg.grid : 24);

  function ripple(wx, wy, k) {
    if (calm.matches) return;
    ripples.push({ x: wx, y: wy, t: performance.now() / 1000, k });
    if (ripples.length > 8) ripples.shift();
  }

  function warm(wx, wy) {
    const g = gridSize();
    const ci = Math.round(wx / g);
    const cj = Math.round(wy / g);
    for (let j = cj - 2; j <= cj + 2; j++) {
      for (let i = ci - 2; i <= ci + 2; i++) {
        const f = Math.exp(-((i * g - wx) ** 2 + (j * g - wy) ** 2) / (g * g * 1.4)) * 0.9;
        if (f < 0.05) continue;
        const key = hkey(i, j);
        if ((heat.get(key) || 0) < f) heat.set(key, f);
      }
    }
  }

  function drawField(t, now) {
    fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
    fctx.clearRect(0, 0, sw, sh);
    fctx.beginPath();
    fctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    fctx.fillStyle = '#030814';
    fctx.fill();
    if (!view) return;
    fctx.save();
    fctx.clip();
    const k = rect.w / view.vw; // phone px per canvas px
    const g = gridSize();
    let mult = 1;
    while (g * mult * k < 11) mult *= 2; // zoomed out: thin the dots out
    const gw = g * mult;
    const gs = gw * k;
    const still = calm.matches;
    const sources = [];
    if (tip && (tip.down || now - tip.t < 1200)) {
      const r = tip.down ? 70 : 56;
      sources.push({ x: tip.x, y: tip.y, r2: r * r, reach: 9 * r * r, k: tip.down ? 0.95 : 0.8, push: tip.down ? 1.5 : 2.5 });
    }
    const rings = [];
    for (const r of ripples) {
      const age = t - r.t;
      const strength = r.k * (1 - age / 1.2) ** 1.5;
      if (strength > 0.01) rings.push({ x: rect.x + (r.x - view.ox) * k, y: rect.y + (r.y - view.oy) * k, r: age * 260, w: 22, k: strength });
    }
    const radius = clamp(gs / 18, 0.8, 1.6);
    const levels = Array.from({ length: LEVELS }, () => new Path2D());
    const bright = [];
    const i0 = Math.floor(view.ox / gw);
    const i1 = Math.ceil((view.ox + view.vw) / gw);
    const j0 = Math.floor(view.oy / gw);
    const j1 = Math.ceil((view.oy + view.vh) / gw);
    for (let j = j0; j <= j1; j++) {
      const rowY = rect.y + (j * gw - view.oy) * k;
      for (let i = i0; i <= i1; i++) {
        let x = rect.x + (i * gw - view.ox) * k;
        let y = rowY;
        let e = 0;
        let px = 0;
        let py = 0;
        for (const s of sources) {
          const dx = x - s.x;
          const dy = y - s.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > s.reach) continue;
          const f = Math.exp(-d2 / s.r2) * s.k;
          e += f;
          if (!still && d2 > 1) {
            const d = Math.sqrt(d2);
            px += (dx / d) * f * s.push;
            py += (dy / d) * f * s.push;
          }
        }
        for (const r of rings) {
          const b = (Math.hypot(x - r.x, y - r.y) - r.r) / r.w;
          if (b > -3 && b < 3) e += Math.exp(-b * b) * r.k;
        }
        if (heat.size) e += heat.get(hkey(i * mult, j * mult)) || 0;
        if (!still) {
          // A slow band of light drifts across, and each dot twinkles a little.
          const wave = Math.sin(i * mult * 0.09 + j * mult * 0.055 - t * 0.45);
          if (wave > 0.7) e += (wave - 0.7) * 0.42;
          e += 0.035 * (1 + Math.sin(t * 1.6 + twinkle(i, j)));
        }
        x += px;
        y += py;
        if (e < 0.3) {
          const path = levels[Math.min(LEVELS - 1, Math.floor((e / 0.3) * LEVELS))];
          path.moveTo(x + radius, y);
          path.arc(x, y, radius, 0, TAU);
        } else {
          bright.push(x, y, e);
        }
      }
    }
    for (let l = 0; l < LEVELS; l++) {
      fctx.fillStyle = LEVEL_COLORS[l];
      fctx.fill(levels[l]);
    }
    fctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < bright.length; n += 3) {
      const e = Math.min(1.8, bright[n + 2]);
      const size = Math.max(10, gs) * (0.9 + e * 1.5);
      fctx.globalAlpha = Math.min(1, e * 0.9);
      fctx.drawImage(sprite, bright[n] - size / 2, bright[n + 1] - size / 2, size, size);
    }
    fctx.globalAlpha = 1;
    fctx.globalCompositeOperation = 'source-over';
    fctx.restore();
  }

  let fieldRaf = 0;
  let fieldTimer = 0;
  let lastT = 0;

  function wakeField() {
    if (fieldRaf || document.visibilityState !== 'visible') return;
    clearTimeout(fieldTimer);
    fieldTimer = 0;
    fieldRaf = requestAnimationFrame(fieldFrame);
  }

  function fieldFrame(now) {
    fieldRaf = 0;
    const t = now / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 1 / 60;
    lastT = t;
    if (heat.size) {
      const fade = Math.exp(-dt / 0.9);
      for (const [key, v] of heat) {
        if (v * fade < 0.02) heat.delete(key);
        else heat.set(key, v * fade);
      }
    }
    ripples = ripples.filter(r => t - r.t < 1.2);
    drawField(t, now);
    const busy = heat.size || ripples.length || gesture || (tip && (tip.down || now - tip.t < 1300));
    if (busy) {
      wakeField();
    } else if (!calm.matches) {
      // Nothing going on: keep a gentle shimmer at a low frame rate to spare the battery.
      fieldTimer = setTimeout(() => { fieldTimer = 0; wakeField(); }, 90);
    }
  }

  // ---------- Ink and outlines ----------
  function redraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function fill(stroke, path, alpha) {
    ctx.globalAlpha = stroke.h ? 0.45 : alpha;
    ctx.fillStyle = tint(stroke.c);
    ctx.fill(path);
  }

  function draw(now) {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sw, sh);
    const showTip = tip && (tip.down || now - tip.t < 1200);

    if (view) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
      ctx.clip();
      const k = rect.w / view.vw;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (rect.x - view.ox * k), dpr * (rect.y - view.oy * k));
      // The grid's artworks and writing, as faint outlines.
      ctx.beginPath();
      for (const [x, y, w, h] of items) ctx.rect(x, y, w, h);
      ctx.fillStyle = 'rgba(92, 150, 235, 0.07)';
      ctx.fill();
      ctx.lineWidth = 1 / k;
      ctx.strokeStyle = 'rgba(140, 180, 240, 0.35)';
      ctx.stroke();
      const x1 = view.ox + view.vw;
      const y1 = view.oy + view.vh;
      for (const m of mirror.values()) {
        if (m.b[2] < view.ox || m.b[0] > x1 || m.b[3] < view.oy || m.b[1] > y1) continue;
        fill(m.st, m.path, 0.95);
      }
      for (const p of pending.values()) fill(p.st, p.path, 0.95);
      if (current && current.st && current.st.p.length) fill(current.st, new Path2D(GI.pathD(current.st)), 1);
      ctx.restore();

      // The eraser's reach, as it will be on the grid.
      const erasing = current ? current.tool === 'eraser' : prefs.tool === 'eraser';
      if (showTip && erasing && cfg) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, Math.max(4, (cfg.eraser * rect.w) / view.W), 0, TAU);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(220, 230, 250, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.strokeStyle = view ? 'rgba(92, 170, 255, 0.45)' : 'rgba(92, 170, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Strokes the grid never confirmed (the link dropped, say) don't linger.
    for (const [key, p] of pending) if (now - p.t > 4000) pending.delete(key);
    if (!expireTimer && (pending.size || (tip && !tip.down && now - tip.t < 1300))) {
      expireTimer = setTimeout(() => { expireTimer = 0; redraw(); }, 250);
    }
  }

  // ---------- Sending pen samples ----------
  // Each sample is [u, v, pressure], where u and v run 0–1 across the grid's visible area.
  function samples(e) {
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const out = [];
    for (const ev of list.length ? list : [e]) {
      const x = ev.clientX - box.left;
      const y = ev.clientY - box.top;
      const u = (x - rect.x) / rect.w;
      const v = (y - rect.y) / rect.h;
      const p = ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5;
      out.push(r5(u), r5(v), r2(p));
      const w = toWorld(x, y);
      if (current.st) current.st.p.push(r2(w.x), r2(w.y), r2(p));
      warm(w.x, w.y);
      tip = { x, y, down: true, t: performance.now() };
    }
    redraw();
    wakeField();
    return out;
  }

  function beginStroke(e) {
    // The pen's eraser end or its side button erases, whatever tool is picked.
    const erase = prefs.tool === 'eraser' || (e.pointerType === 'pen' && (e.buttons & (2 | 32)) !== 0);
    const tool = erase ? 'eraser' : prefs.tool;
    const px = (tool === 'marker' ? cfg.marker : cfg.pen)[prefs.size];
    const gridScale = view.W / view.vw;
    current = {
      s: ++seq,
      pid: e.pointerId,
      touch: e.pointerType === 'touch',
      t0: performance.now(),
      tool,
      st: erase ? null : { c: prefs.color, w: r2(px / gridScale), h: tool === 'marker' ? 1 : 0, p: [] }
    };
    try { surface.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
    const pts = samples(e);
    link.send({ t: 'd', id, s: current.s, tool, c: prefs.color, z: prefs.size, pts });
    const w = toWorld(tip.x, tip.y);
    ripple(w.x, w.y, erase ? 0.35 : 0.6);
    holdScreen();
  }

  function finishStroke(cancel) {
    const c = current;
    current = null;
    if (!c) return;
    link.send({ t: cancel ? 'x' : 'u', id, s: c.s });
    if (!cancel && c.st && c.st.p.length) {
      pending.set(`${id}:${c.s}`, { st: c.st, path: new Path2D(GI.pathD(c.st)), t: performance.now() });
    }
    if (c.touch) tip = null;
    else if (tip) tip = { ...tip, down: false, t: performance.now() };
    redraw();
    wakeField();
  }

  let hoverQueued = false;
  let hoverAt = null;
  function hover(e) {
    if (!ready()) return;
    const p = local(e);
    tip = { x: p.x, y: p.y, down: false, t: performance.now() };
    hoverAt = { u: r5((p.x - rect.x) / rect.w), v: r5((p.y - rect.y) / rect.h) };
    redraw();
    wakeField();
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (hoverAt) link.send({ t: 'h', id, ...hoverAt }, false);
    });
  }

  // ---------- Panning and zooming the grid with fingers ----------
  const centroid = pts => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });

  function beginGesture() {
    const pts = [...touches.values()];
    if (!view || !pts.length) { gesture = null; return; }
    gesture = {
      c: centroid(pts),
      d: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      ox: view.ox,
      oy: view.oy,
      vw: view.vw,
      vh: view.vh
    };
    tip = null;
    redraw();
    wakeField();
  }

  let viewQueued = false;
  function sendView() {
    if (view) link.send({ t: 'view', id, ox: view.ox, oy: view.oy, vw: view.vw }, false);
  }

  function updateGesture() {
    const pts = [...touches.values()];
    if (!view || !pts.length) return;
    const c = centroid(pts);
    let vw = gesture.vw;
    if (pts.length > 1 && gesture.d > 20) {
      vw = (gesture.vw * gesture.d) / Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    }
    vw = view.W / clamp(view.W / vw, view.min, view.max);
    const vh = (vw * gesture.vh) / gesture.vw;
    // The point that started under the fingers stays under them.
    const wx = gesture.ox + ((gesture.c.x - rect.x) / rect.w) * gesture.vw;
    const wy = gesture.oy + ((gesture.c.y - rect.y) / rect.h) * gesture.vh;
    view.ox = wx - ((c.x - rect.x) / rect.w) * vw;
    view.oy = wy - ((c.y - rect.y) / rect.h) * vh;
    view.vw = vw;
    view.vh = vh;
    redraw();
    wakeField();
    if (viewQueued) return;
    viewQueued = true;
    requestAnimationFrame(() => { viewQueued = false; sendView(); });
  }

  function endGesture() {
    gesture = null;
    gestureEndAt = performance.now();
    sendView();
  }

  // ---------- Pointer input ----------
  surface.addEventListener('pointerdown', e => {
    closePops();
    if (e.pointerType === 'pen') {
      penSeen = true;
      penDown = true;
      lastPenAt = performance.now();
      // The pen wins over whatever fingers were doing.
      if (gesture) { touches.clear(); endGesture(); }
      if (current && current.touch) finishStroke(true);
    }
    if (e.pointerType === 'touch') {
      // A palm: resting while the pen writes or hovers, or too broad for a fingertip.
      if (penDown || performance.now() - lastPenAt < 500 || Math.max(e.width, e.height) > 50) return;
      touches.set(e.pointerId, local(e));
      try { surface.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
      // With a real pen around, fingers move the grid; otherwise one finger writes, two move.
      if ((penSeen && !prefs.finger) || touches.size > 1) {
        // A second finger soon after the first means a pinch, not a line.
        if (current && current.touch) finishStroke(performance.now() - current.t0 < 300);
        beginGesture();
        return;
      }
      if (gesture) return;
    } else if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    if (!ready() || current) return;
    beginStroke(e);
  });

  surface.addEventListener(MOVE, e => {
    if (e.pointerType === 'pen') lastPenAt = performance.now();
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, local(e));
      if (gesture) { updateGesture(); return; }
    }
    if (current && e.pointerId === current.pid) {
      const pts = samples(e);
      if (pts.length) link.send({ t: 'm', id, s: current.s, pts });
      return;
    }
    if (!current && (e.pointerType === 'pen' || e.pointerType === 'mouse')) hover(e);
  });

  function pointerEnd(e) {
    if (e.pointerType === 'pen') {
      penDown = false;
      lastPenAt = performance.now();
    }
    if (touches.delete(e.pointerId) && gesture) {
      if (touches.size) beginGesture(); else endGesture();
    }
    if (current && e.pointerId === current.pid) finishStroke(e.type === 'pointercancel');
  }
  surface.addEventListener('pointerup', pointerEnd);
  surface.addEventListener('pointercancel', pointerEnd);
  surface.addEventListener('pointerleave', e => {
    if (current || e.pointerType === 'touch') return;
    tip = null;
    hoverAt = null;
    if (link && ready()) link.send({ t: 'h', id }, false);
    redraw();
  });

  // No page zoom, scrolling, text selection or long-press menus while writing.
  surface.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (e.target.closest && e.target.closest('.pad-surface')) e.preventDefault();
  }, { passive: false });

  // ---------- Messages from the Art Grid ----------
  function applyCfg(msg) {
    const sizes = list => Array.isArray(list) && list.length === 3 && list.every(n => Number.isFinite(n) && n > 0);
    if (!Array.isArray(msg.colors) || !msg.colors.length || !sizes(msg.pen) || !sizes(msg.marker)) return;
    cfg = {
      colors: msg.colors.filter(c => typeof c === 'string').slice(0, 12),
      pen: msg.pen,
      marker: msg.marker,
      eraser: Number.isFinite(msg.eraser) ? msg.eraser : 12,
      grid: Number.isFinite(msg.grid) && msg.grid > 0 ? msg.grid : 24
    };
    if (!cfg.colors.includes(prefs.color)) prefs.color = cfg.colors[0];
    buildPalette();
    renderTools();
    wakeField();
  }

  function applyView(msg) {
    if (gesture || performance.now() - gestureEndAt < 300) return; // our own pinch wins
    if (![msg.ox, msg.oy, msg.vw, msg.vh, msg.W].every(Number.isFinite) || msg.vw <= 0 || msg.vh <= 0) return;
    const reshaped = !view || Math.abs(view.vw / view.vh - msg.vw / msg.vh) > 0.001;
    view = {
      ox: msg.ox,
      oy: msg.oy,
      vw: msg.vw,
      vh: msg.vh,
      W: msg.W,
      min: Number.isFinite(msg.min) ? msg.min : 0.25,
      max: Number.isFinite(msg.max) ? msg.max : 2
    };
    if (reshaped) layout(); else { redraw(); wakeField(); }
    updateStatus();
  }

  function applyInk(msg) {
    if (msg.reset) mirror.clear();
    for (const i of Array.isArray(msg.del) ? msg.del : []) mirror.delete(i);
    for (const a of Array.isArray(msg.add) ? msg.add : []) {
      if (!a || !Array.isArray(a.p) || typeof a.c !== 'string') continue;
      const st = { c: a.c, w: a.w, h: a.h, p: a.p };
      mirror.set(a.i, { st, path: new Path2D(GI.pathD(st)), b: GI.bounds(st) });
      if (a.o) pending.delete(a.o);
    }
    redraw();
  }

  function hello() {
    link.send({ t: 'hi', id, name: deviceName, host: location.hostname, raw: MOVE === 'pointerrawupdate' }, false);
  }

  function onMessage(msg) {
    if (msg.to && msg.to !== id) return;
    switch (msg.t) {
      case 'peers': {
        const present = msg.host > 0;
        if (present !== hostPresent) {
          hostPresent = present;
          if (!present) {
            if (current) finishStroke(true);
            view = null;
            items = [];
            mirror.clear();
            pending.clear();
            rtt = null;
            layout();
          }
        }
        updateStatus();
        break;
      }
      case 'sync': hello(); break;
      case 'cfg': applyCfg(msg); break;
      case 'view': applyView(msg); break;
      case 'ink': applyInk(msg); break;
      case 'items':
        items = (Array.isArray(msg.list) ? msg.list : []).filter(r => Array.isArray(r) && r.length === 4 && r.every(Number.isFinite));
        redraw();
        break;
      case 'ping':
        link.send({ t: 'pong', id, n: msg.n }, false);
        if (msg.rtt && Number.isFinite(msg.rtt[id])) { rtt = msg.rtt[id]; updateStatus(); }
        break;
      default: break;
    }
  }

  function updateStatus() {
    let tone = 'wait';
    let text = 'Connecting';
    let note = '<b>Connecting…</b>Looking for the Art Grid.';
    if (linkState === 'closed') {
      tone = 'bad';
      text = 'Offline';
      note = hostPresent
        ? '<b>Reconnecting…</b>Keep writing. Your strokes catch up when the link is back.'
        : '<b>Can’t reach the computer</b>Check the cable or network, and that the Art Room server is running.';
    } else if (linkState === 'open' && !hostPresent) {
      text = 'Waiting';
      note = '<b>Almost there</b>On your computer, open the Art Grid and choose Pen → Phone pad.';
    } else if (linkState === 'open' && ready()) {
      tone = 'good';
      text = rtt != null ? `${Math.max(1, Math.round(rtt))} ms` : 'Live';
      note = '';
    }
    statusEl.dataset.tone = tone;
    statusText.textContent = text;
    noteEl.innerHTML = note;
    noteEl.hidden = !note;
  }

  // Keep the phone's screen on while writing (where the browser allows it).
  let wakeLock = null;
  async function holdScreen() {
    if (wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) { /* not allowed here */ }
  }

  // ---------- Toolbar ----------
  const toolButtons = [...document.querySelectorAll('[data-tool]')];
  let colorButtons = [];
  const sizeButtons = [];

  function renderTools() {
    for (const btn of toolButtons) btn.setAttribute('aria-pressed', String(btn.dataset.tool === prefs.tool));
    if (prefs.color) $('#style-btn').style.setProperty('--ink', prefs.color);
    colorButtons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.color === prefs.color)));
    if (cfg) {
      const sizes = prefs.tool === 'marker' ? cfg.marker : cfg.pen;
      sizeButtons.forEach((btn, i) => {
        const d = Math.min(24, 3 + sizes[i] * (prefs.tool === 'marker' ? 0.6 : 2.4));
        btn.firstElementChild.style.width = btn.firstElementChild.style.height = `${d}px`;
      });
    }
    sizeButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === prefs.size)));
    $('#finger').setAttribute('aria-pressed', String(prefs.finger));
    redraw();
  }

  // The swatches are the Art Grid's own inks, so they arrive with the grid's settings.
  function buildPalette() {
    $('#colors').replaceChildren();
    colorButtons = cfg.colors.map(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.color = color;
      btn.setAttribute('aria-label', `Ink ${color}`);
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.color = color;
      btn.append(swatch);
      btn.addEventListener('click', () => {
        prefs.color = color;
        if (prefs.tool === 'eraser') prefs.tool = 'pen';
        savePrefs();
        renderTools();
      });
      $('#colors').append(btn);
      return btn;
    });
  }

  function closePops() {
    stylePop.hidden = true;
    morePop.hidden = true;
    $('#style-btn').setAttribute('aria-expanded', 'false');
    $('#more-btn').setAttribute('aria-expanded', 'false');
  }

  function togglePop(pop, btn) {
    const open = pop.hidden;
    closePops();
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  for (const btn of toolButtons) {
    btn.addEventListener('click', () => {
      prefs.tool = btn.dataset.tool;
      savePrefs();
      renderTools();
    });
  }

  ['Thin', 'Medium', 'Thick'].forEach((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    const size = document.createElement('span');
    size.className = 'dot';
    btn.append(size);
    btn.addEventListener('click', () => {
      prefs.size = i;
      savePrefs();
      renderTools();
    });
    sizeButtons.push(btn);
    $('#sizes').append(btn);
  });

  $('#style-btn').addEventListener('click', () => togglePop(stylePop, $('#style-btn')));
  $('#more-btn').addEventListener('click', () => togglePop(morePop, $('#more-btn')));
  $('#undo').addEventListener('click', () => link && link.send({ t: 'undo', id }));
  $('#redo').addEventListener('click', () => link && link.send({ t: 'redo', id }));
  $('#home').addEventListener('click', () => { closePops(); if (link) link.send({ t: 'home', id }); });
  $('#clear').addEventListener('click', () => { closePops(); if (link) link.send({ t: 'clear', id }); });
  $('#finger').addEventListener('click', () => {
    prefs.finger = !prefs.finger;
    savePrefs();
    renderTools();
  });
  const fullscreenBtn = $('#fullscreen');
  if (!document.documentElement.requestFullscreen) fullscreenBtn.hidden = true;
  fullscreenBtn.addEventListener('click', () => {
    closePops();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.pad-pop, #style-btn, #more-btn')) closePops();
  });

  // ---------- Pairing ----------
  function readRoom() {
    const code = decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(code) ? code : '';
  }

  function start() {
    const room = readRoom();
    if (link) { link.stop(); link = null; }
    hostPresent = false;
    view = null;
    items = [];
    mirror.clear();
    pending.clear();
    rtt = null;
    if (!room) {
      $('#gate').hidden = false;
      $('#gate-code').value = store.get(CODE_KEY) || '';
      return;
    }
    $('#gate').hidden = true;
    store.set(CODE_KEY, room);
    link = connect({
      role: 'pad',
      room,
      id,
      onMessage,
      onState(state) {
        linkState = state;
        if (state === 'open') hello();
        updateStatus();
      }
    });
    layout();
    updateStatus();
  }

  $('#gate-form').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('#gate-code').value.trim().toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(code)) location.hash = code;
  });

  window.addEventListener('hashchange', start);
  new ResizeObserver(layout).observe(surface);
  document.addEventListener('visibilitychange', () => {
    lastT = 0;
    wakeField();
    if (ready()) holdScreen();
  });
  calm.addEventListener('change', wakeField);

  renderTools();
  start();
})();
