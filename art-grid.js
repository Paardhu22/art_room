(() => {
  'use strict';

  // The dot grid is the ruler: everything snaps to its dots (one cell = 24px).
  const CELL = 24;
  const WORLD_COLS = 333;
  const WORLD_ROWS = 250;
  const WORLD_WIDTH = WORLD_COLS * CELL;
  const WORLD_HEIGHT = WORLD_ROWS * CELL;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 2;
  const STORE_KEY = 'art-room:grid:v2';
  const ART_CELLS = 15;
  const ART_MIN = 6;
  const ART_MAX = 60;
  const EQ_MIN = [8, 6];
  const EQ_MAX = 60;
  // The scenes draw a framed picture on a 1200px sheet; this is the picture area.
  const CROP = { x: 62, y: 38, size: 1076 };

  const $ = sel => document.querySelector(sel);
  const viewport = $('#canvas-viewport');
  const world = $('#canvas-world');
  const inspector = $('#inspector');
  const pop = $('#tray-pop');
  const toastEl = $('#grid-toast');
  const GM = window.GridMath;

  const GI = window.GridInk;
  const penBar = $('#pen-bar');

  world.style.width = `${WORLD_WIDTH}px`;
  world.style.height = `${WORLD_HEIGHT}px`;

  // Ink lives in its own SVG layer above the items, in canvas coordinates.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const inkSvg = document.createElementNS(SVG_NS, 'svg');
  inkSvg.setAttribute('class', 'ink-layer');
  inkSvg.setAttribute('width', WORLD_WIDTH);
  inkSvg.setAttribute('height', WORLD_HEIGHT);
  inkSvg.setAttribute('aria-hidden', 'true');
  world.append(inkSvg);

  // JavaScript artworks = the collection entries that have a live sketch.
  const scenes = (window.ARTWORKS || []).filter(a => a.sketch).map(a => ({
    id: a.id,
    title: a.title,
    label: a.label,
    thumb: `assets/artworks/${a.id}-480.webp`,
    original: a.original,
    seed: Number(new URL(a.sketch, location.href).searchParams.get('seed')) || 1
  }));
  const sceneById = Object.fromEntries(scenes.map(s => [s.id, s]));

  // ---------- State ----------
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let selectedId = null;
  let zCounter = 1;
  let uid = 0;
  const items = new Map();

  // Pen state. Strokes are plain data (see grid-ink.js); their <path>s are tracked on the side.
  let ink = [];
  const inkEls = new WeakMap();
  let tool = 'select'; // 'select' | 'pen' | 'highlighter' | 'eraser'
  let penLocked = false; // "Move items" was picked on purpose, so the pen stops auto-switching
  let penBarOpen = false;
  let fingerInk = false;
  let penToastShown = false;
  const inkStyle = { color: GM.COLORS[0], size: 1 };
  const PEN_SIZES = [1.6, 3, 6]; // screen pixels
  const MARKER_SIZES = [12, 20, 32];
  let phonePad = null; // a phone writing on this grid (grid-pad.js), once attached

  const rand32 = () => (crypto.getRandomValues(new Uint32Array(1))[0] || 1);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const snap = v => Math.round(v / CELL) * CELL;
  const cells = px => Math.round(px / CELL);
  const svgX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  // ---------- Persistence ----------
  let saveTimer = 0;
  function save() {
    if (phonePad) phonePad.sync(); // the phone mirrors the ink, items and view
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = {
          view: { panX, panY, scale },
          items: [...items.values()].map(({ el, canvas, parsed, token, ...rest }) => rest),
          ink
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (_) { /* storage can be unavailable; the canvas still works */ }
    }, 300);
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return data && Array.isArray(data.items) ? data : null;
    } catch (_) {
      return null;
    }
  }

  // ---------- Undo / redo ----------
  // Snapshots of everything on the canvas, taken just before a change.
  const undoStack = [];
  const redoStack = [];
  let coalesceTimer = 0;

  const snapshot = () => ({
    items: [...items.values()].map(({ el, canvas, parsed, token, ...rest }) => ({ ...rest })),
    ink: ink.slice()
  });

  function updateHistoryButtons() {
    $('#undo').disabled = !undoStack.length;
    $('#redo').disabled = !redoStack.length;
  }

  function record() {
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  // Typing and sliders fire many times; one undo step per burst.
  function recordCoalesced() {
    if (!coalesceTimer) record();
    clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => { coalesceTimer = 0; }, 900);
  }

  function restore(snap) {
    select(null);
    for (const item of items.values()) item.el.remove();
    items.clear();
    for (const data of snap.items) addItem({ ...data }, { selectIt: false, record: false });
    ink = snap.ink.slice();
    renderInk();
    save();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateHistoryButtons();
  }

  // ---------- Ink layer ----------
  function addInkEl(stroke) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', GI.pathD(stroke));
    path.setAttribute('fill', stroke.c);
    if (stroke.h) path.setAttribute('class', 'is-marker');
    inkSvg.append(path);
    inkEls.set(stroke, path);
    return path;
  }

  function renderInk() {
    inkSvg.replaceChildren();
    for (const stroke of ink) addInkEl(stroke);
  }

  // ---------- Pan & zoom ----------
  function clampAxis(pan, worldSize, viewSize) {
    const scaled = worldSize * scale;
    if (scaled <= viewSize) return (viewSize - scaled) / 2;
    return Math.min(0, Math.max(viewSize - scaled, pan));
  }

  function apply() {
    panX = clampAxis(panX, WORLD_WIDTH, viewport.clientWidth);
    panY = clampAxis(panY, WORLD_HEIGHT, viewport.clientHeight);
    world.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    $('#zoom-label').textContent = `${Math.round(scale * 100)}%`;
    save();
  }

  function center(newScale = scale) {
    scale = newScale;
    panX = (viewport.clientWidth - WORLD_WIDTH * scale) / 2;
    panY = (viewport.clientHeight - WORLD_HEIGHT * scale) / 2;
    apply();
  }

  function zoomAt(next, clientX, clientY) {
    const clamped = clamp(next, MIN_SCALE, MAX_SCALE);
    if (clamped === scale) return;
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    panX = x - ((x - panX) * clamped) / scale;
    panY = y - ((y - panY) * clamped) / scale;
    scale = clamped;
    apply();
  }

  // Fit everything on the board into view, or centre the empty canvas.
  function showAll() {
    const boxes = [...items.values()].map(i => [i.x, i.y, i.x + i.w, i.y + i.h]).concat(ink.map(GI.bounds));
    if (!boxes.length) { center(1); return; }
    const x0 = Math.min(...boxes.map(b => b[0]));
    const y0 = Math.min(...boxes.map(b => b[1]));
    const x1 = Math.max(...boxes.map(b => b[2]));
    const y1 = Math.max(...boxes.map(b => b[3]));
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    scale = clamp(Math.min((w * 0.8) / (x1 - x0 || 1), (h * 0.7) / (y1 - y0 || 1), 1.5), MIN_SCALE, MAX_SCALE);
    panX = w / 2 - ((x0 + x1) / 2) * scale;
    panY = h / 2 - ((y0 + y1) / 2) * scale;
    apply();
  }

  const viewCenter = () => {
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  function clientToWorld(cx, cy) {
    const rect = viewport.getBoundingClientRect();
    return { x: (cx - rect.left - panX) / scale, y: (cy - rect.top - panY) / scale };
  }

  // ---------- Items ----------
  function placeEl(item) {
    item.el.style.left = `${item.x}px`;
    item.el.style.top = `${item.y}px`;
    item.el.style.width = `${item.w}px`;
    item.el.style.height = `${item.h}px`;
    item.el.style.zIndex = item.z;
  }

  // Everything lives on whole grid cells, inside the canvas.
  function fit(item) {
    item.w = Math.max(CELL, snap(item.w));
    item.h = Math.max(CELL, snap(item.h));
    item.x = clamp(snap(item.x), 0, WORLD_WIDTH - item.w);
    item.y = clamp(snap(item.y), 0, WORLD_HEIGHT - item.h);
    placeEl(item);
  }

  function buildEl(item) {
    const el = document.createElement('div');
    el.className = `grid-item item-${item.type}`;
    el.dataset.id = item.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', item.type === 'art' ? sceneById[item.scene].title : item.type === 'text' ? 'Scribbled text' : 'Equation sketch');
    item.el = el;

    const body = document.createElement('div');
    body.className = 'item-body';
    item.canvas = document.createElement('canvas');
    body.append(item.canvas);
    el.append(body);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'item-del';
    del.setAttribute('aria-label', 'Remove from canvas');
    del.innerHTML = svgX;
    del.addEventListener('click', () => removeItem(item.id));
    const handle = document.createElement('span');
    handle.className = 'item-resize';
    handle.setAttribute('aria-hidden', 'true');
    el.append(del, handle);

    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType !== 'pen') return;
      if (inkMode(e)) return; // annotating: let the canvas take this stroke, even over an item
      e.stopPropagation();
      if (e.target.closest('.item-del')) return;
      select(item.id);
      const base = { item, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
      drag = e.target.closest('.item-resize')
        ? { ...base, kind: 'resize', w: item.w, h: item.h }
        : { ...base, kind: 'move', x: item.x, y: item.y };
      viewport.setPointerCapture(e.pointerId);
    });

    // Focus selects (keyboard users), but a pen or mouse press while inking must not.
    el.addEventListener('focus', () => { if (tool === 'select') select(item.id); });
    el.addEventListener('keydown', e => {
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const move = moves[e.key];
      if (!move || e.target !== el) return;
      e.preventDefault();
      e.stopPropagation();
      const step = (e.shiftKey ? 5 : 1) * CELL;
      item.x += move[0] * step;
      item.y += move[1] * step;
      fit(item);
      save();
    });

    world.append(el);
    return el;
  }

  function addItem(data, { selectIt = true, record: rec = true } = {}) {
    if (rec) record();
    const item = { id: `i${Date.now().toString(36)}${(uid++).toString(36)}`, z: ++zCounter, ...data };
    items.set(item.id, item);
    buildEl(item);
    fit(item);
    paint(item);
    if (selectIt) {
      select(item.id);
      if (item.type !== 'art') inspector.classList.remove('is-collapsed');
    }
    save();
    return item;
  }

  function removeItem(id) {
    const item = items.get(id);
    if (!item) return;
    record();
    item.el.remove();
    items.delete(id);
    if (selectedId === id) select(null);
    save();
  }

  // On a small screen, new things start smaller so they fit in view (and shrink with zoom-in).
  function fitCells(wanted) {
    const room = Math.min(viewport.clientWidth, viewport.clientHeight * 0.8) * 0.8 / scale;
    return Math.max(6, Math.min(wanted, Math.floor(room / CELL)));
  }

  function addArt(sceneId, worldX, worldY, extra = {}) {
    const scene = sceneById[sceneId];
    if (!scene) return;
    const size = fitCells(ART_CELLS) * CELL;
    return addItem({
      type: 'art', scene: sceneId, seed: scene.seed,
      x: worldX - size / 2, y: worldY - size / 2, w: size, h: size, ...extra
    });
  }

  function addEquation(presetId, worldX, worldY) {
    const preset = GM.PRESETS.find(p => p.id === presetId) || GM.PRESETS[0];
    // Smaller on a phone: shrink the box and the graph scale together so the plot still fits.
    // Halving keeps the tick numbers round (every 2 cells = 4, 8, 12…) instead of 6.15 and 12.31.
    const ratio = fitCells(preset.cells[0]) >= preset.cells[0] ? 1 : 0.5;
    const w = Math.round(preset.cells[0] * ratio) * CELL;
    const h = Math.round(preset.cells[1] * ratio) * CELL;
    return addItem({
      type: 'eq', text: preset.text, cpu: preset.cpu * ratio, rough: 1.2, wob: rand32(),
      axes: true, ticks: true, labels: false,
      x: worldX - w / 2, y: worldY - h / 2, w, h
    });
  }

  const INK = GM.COLORS[0];

  function addText(worldX, worldY, text = '') {
    const w = fitCells(24) * CELL;
    const item = addItem({
      type: 'text', text, size: 2, color: INK, rough: 1.2, wob: rand32(),
      x: worldX, y: worldY, w, h: 2 * CELL
    });
    focusWriting();
    return item;
  }

  function focusWriting() {
    // The inspector opens on the next frame's layout; focus once it's visible.
    requestAnimationFrame(() => textFields.text.focus());
  }

  function duplicate(id) {
    const src = items.get(id);
    if (!src) return;
    const { el, canvas, parsed, token, id: _id, z, ...data } = src;
    addItem({ ...data, x: src.x + CELL * 2, y: src.y + CELL * 2 });
  }

  // Redraw whatever an item shows, at its current size.
  function paint(item) {
    if (item.type === 'eq') drawEq(item);
    else if (item.type === 'text') drawText(item);
    else drawArt(item);
  }

  // ---------- Equations ----------
  function drawEq(item) {
    if (!item.parsed) item.parsed = GM.parseAll(item.text);
    GM.drawPlot(item.canvas, {
      width: item.w, height: item.h, ratio: 2, cpu: item.cpu, cell: CELL,
      rough: item.rough, seed: item.wob, axes: item.axes, ticks: item.ticks, labels: item.labels,
      parsed: item.parsed
    });
  }

  // ---------- Scribbled text ----------
  // The box grows with the writing: width is yours, height follows the lines.
  function drawText(item) {
    const layout = GM.layoutScribble(item.text, item.size, item.w, CELL);
    item.h = layout.cells * CELL;
    fit(item);
    GM.drawScribble(item.canvas, {
      width: item.w, height: item.h, ratio: 2, text: item.text, size: item.size,
      color: item.color, rough: item.rough, seed: item.wob, cell: CELL, layout
    });
  }

  // ---------- JavaScript artwork (drawn live, not an image) ----------
  const artCache = new Map();
  let renderChain = Promise.resolve();

  async function renderSheet(scene, seed) {
    const key = `${scene.id}:${seed}`;
    if (artCache.has(key)) return artCache.get(key);
    const crop = document.createElement('canvas');
    crop.width = crop.height = CROP.size;
    try {
      const [{ atelier }, mod] = await Promise.all([
        import('./artwork/engine.js'),
        import(`./artwork/scenes/${scene.id}.js`)
      ]);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sheet = document.createElement('canvas');
      mod.draw(atelier(sheet, seed));
      crop.getContext('2d').drawImage(sheet, CROP.x, CROP.y, CROP.size, CROP.size, 0, 0, CROP.size, CROP.size);
    } catch (error) {
      // Opened from a file: modules can't load, so use the saved render of the original seed.
      console.error(error);
      if (seed !== scene.seed) throw error;
      const img = new Image();
      img.src = scene.original;
      await img.decode();
      crop.getContext('2d').drawImage(img, CROP.x, CROP.y, CROP.size, CROP.size, 0, 0, CROP.size, CROP.size);
    }
    artCache.set(key, crop);
    if (artCache.size > 16) artCache.delete(artCache.keys().next().value);
    return crop;
  }

  function drawArt(item) {
    const scene = sceneById[item.scene];
    const token = (item.token = (item.token || 0) + 1);
    item.el.classList.add('is-busy');
    renderChain = renderChain.then(async () => {
      if (!items.has(item.id) || token !== item.token) return;
      try {
        const sheet = await renderSheet(scene, item.seed);
        if (!items.has(item.id) || token !== item.token) return;
        item.canvas.width = item.canvas.height = CROP.size;
        item.canvas.getContext('2d').drawImage(sheet, 0, 0);
        item.el.classList.remove('is-busy');
        if (selectedId === item.id) syncInspector();
      } catch (error) {
        console.error(error);
        item.el.classList.remove('is-busy');
        toast('Drawing a new variation needs the site served over http — run npm start.');
        if (item.seed !== scene.seed) { item.seed = scene.seed; drawArt(item); }
      }
    });
  }

  // ---------- Selection & inspector ----------
  function select(id) {
    const prev = items.get(selectedId);
    if (prev) prev.el.classList.remove('is-selected');
    // A scribble box left empty is just clutter, so it goes away when you click off it.
    const abandoned = prev && prev.type === 'text' && !prev.text.trim() && prev.id !== id ? prev : null;
    selectedId = id && items.has(id) ? id : null;
    if (selectedId) {
      const item = items.get(selectedId);
      item.z = ++zCounter;
      item.el.style.zIndex = item.z;
      item.el.classList.add('is-selected');
    }
    if (abandoned) {
      abandoned.el.remove();
      items.delete(abandoned.id);
      save();
    }
    syncInspector();
  }

  const eqFields = {
    text: $('#eq-text'), preset: $('#eq-preset'), cpu: $('#eq-cpu'), rough: $('#eq-rough'),
    ticks: $('#eq-ticks'), axes: $('#eq-axes'), labels: $('#eq-labels'), errors: $('#eq-errors')
  };

  const textFields = {
    text: $('#tx-text'), size: $('#tx-size'), rough: $('#tx-rough'), colors: $('#tx-colors')
  };

  function showErrors(item) {
    eqFields.errors.replaceChildren(...(item.parsed || []).filter(p => p.error).map(p => {
      const li = document.createElement('li');
      li.textContent = `Line ${p.line}: ${p.error}`;
      return li;
    }));
  }

  function syncInspector() {
    const item = items.get(selectedId);
    inspector.hidden = !item;
    $('#exp-item').disabled = !item;
    if (!item) return;
    for (const section of inspector.querySelectorAll('[data-for]')) section.hidden = section.dataset.for !== item.type;
    const size = `${cells(item.w)} × ${cells(item.h)} cells`;
    if (item.type === 'art') {
      const scene = sceneById[item.scene];
      $('#insp-kicker').textContent = `JavaScript artwork · ${scene.label}`;
      $('#insp-title').textContent = scene.title;
      $('#art-meta').textContent = `${size} · seed ${item.seed}${item.seed === scene.seed ? ' (original)' : ''}`;
      $('#art-atelier').href = `artwork/studio.html?scene=${encodeURIComponent(scene.id)}&seed=${item.seed}`;
    } else if (item.type === 'text') {
      $('#insp-kicker').textContent = `Scribble · ${size}`;
      $('#insp-title').textContent = 'Write it out';
      if (document.activeElement !== textFields.text) textFields.text.value = item.text;
      if (document.activeElement !== textFields.size) textFields.size.value = item.size;
      textFields.rough.value = item.rough;
      for (const sw of textFields.colors.children) sw.setAttribute('aria-pressed', String(sw.dataset.color === item.color));
    } else {
      $('#insp-kicker').textContent = `Equation sketch · ${size}`;
      $('#insp-title').textContent = 'Plot it, roughly';
      if (document.activeElement !== eqFields.text) eqFields.text.value = item.text;
      if (document.activeElement !== eqFields.cpu) eqFields.cpu.value = item.cpu;
      eqFields.rough.value = item.rough;
      eqFields.ticks.checked = item.ticks;
      eqFields.axes.checked = item.axes;
      eqFields.labels.checked = item.labels;
      showErrors(item);
    }
  }

  function withEq(fn) {
    const item = items.get(selectedId);
    if (!item || item.type !== 'eq') return;
    recordCoalesced();
    fn(item);
    drawEq(item);
    showErrors(item);
    save();
  }

  eqFields.text.addEventListener('input', () => withEq(item => { item.text = eqFields.text.value; item.parsed = GM.parseAll(item.text); }));
  eqFields.cpu.addEventListener('input', () => withEq(item => {
    const v = parseFloat(eqFields.cpu.value);
    if (v >= 0.1 && v <= 20) item.cpu = v;
  }));
  eqFields.rough.addEventListener('input', () => withEq(item => { item.rough = parseFloat(eqFields.rough.value); }));
  for (const key of ['ticks', 'axes', 'labels']) {
    eqFields[key].addEventListener('change', () => withEq(item => { item[key] = eqFields[key].checked; }));
  }
  $('#eq-resketch').addEventListener('click', () => withEq(item => { item.wob = rand32(); }));
  for (const preset of GM.PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    eqFields.preset.append(option);
  }
  eqFields.preset.addEventListener('change', () => {
    const preset = GM.PRESETS.find(p => p.id === eqFields.preset.value);
    eqFields.preset.value = '';
    if (!preset) return;
    withEq(item => { item.text = preset.text; item.cpu = preset.cpu; item.parsed = GM.parseAll(item.text); });
    syncInspector();
  });

  function withText(fn) {
    const item = items.get(selectedId);
    if (!item || item.type !== 'text') return;
    recordCoalesced();
    fn(item);
    drawText(item);
    syncInspectorSize(item);
    save();
  }

  textFields.text.addEventListener('input', () => withText(item => { item.text = textFields.text.value; }));
  textFields.size.addEventListener('input', () => withText(item => {
    const v = Math.round(parseFloat(textFields.size.value));
    if (v >= 1 && v <= 6) item.size = v;
  }));
  textFields.rough.addEventListener('input', () => withText(item => { item.rough = parseFloat(textFields.rough.value); }));
  $('#tx-resketch').addEventListener('click', () => withText(item => { item.wob = rand32(); }));
  for (const color of GM.COLORS) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.dataset.color = color;
    sw.style.background = color;
    sw.setAttribute('aria-label', `Ink ${color}`);
    sw.addEventListener('click', () => {
      withText(item => { item.color = color; });
      syncInspector();
    });
    textFields.colors.append(sw);
  }

  $('#art-variation').addEventListener('click', () => {
    const item = items.get(selectedId);
    if (!item || item.type !== 'art') return;
    record();
    item.seed = rand32();
    drawArt(item);
    syncInspector();
    save();
  });
  $('#art-original').addEventListener('click', () => {
    const item = items.get(selectedId);
    if (!item || item.type !== 'art') return;
    record();
    item.seed = sceneById[item.scene].seed;
    drawArt(item);
    syncInspector();
    save();
  });

  $('#insp-duplicate').addEventListener('click', () => selectedId && duplicate(selectedId));
  $('#insp-delete').addEventListener('click', () => selectedId && removeItem(selectedId));
  $('#insp-save').addEventListener('click', () => {
    const item = items.get(selectedId);
    if (!item || item.el.classList.contains('is-busy')) return;
    // Export on paper with the dots, the way it looks on the grid.
    const out = document.createElement('canvas');
    if (item.type === 'eq') {
      GM.drawPlot(out, {
        width: item.w, height: item.h, ratio: 2, cpu: item.cpu, cell: CELL, rough: item.rough, seed: item.wob,
        axes: item.axes, ticks: item.ticks, labels: item.labels, dots: true, parsed: item.parsed
      });
    } else if (item.type === 'text') {
      GM.drawScribble(out, {
        width: item.w, height: item.h, ratio: 2, text: item.text, size: item.size,
        color: item.color, rough: item.rough, seed: item.wob, cell: CELL, dots: true
      });
    } else {
      out.width = out.height = CROP.size;
      out.getContext('2d').drawImage(item.canvas, 0, 0);
    }
    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.type === 'art' ? `${item.scene}-${item.seed}` : item.type === 'text' ? 'scribble' : 'equation-sketch'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });

  // ---------- Pointer handling: pan, move, resize, pinch and ink ----------
  const touches = new Map();
  let pinch = null;
  let penDown = false;
  let lastPenUp = 0;
  let inkGesture = null;
  let lastTap = null;
  let lastDoubleTap = 0;

  const effectiveTool = e => (e.pointerType === 'pen' && tool === 'select' && !penLocked ? 'pen' : tool);

  // 'draw' | 'erase' | null — what this pointer should do on the canvas right now.
  function inkMode(e) {
    const pen = e.pointerType === 'pen';
    if (pen && (e.buttons & (2 | 32))) return 'erase'; // the pen's side button, or its eraser end
    const t = effectiveTool(e);
    if (t === 'select') return null;
    const canInk = pen || e.pointerType === 'mouse' || (e.pointerType === 'touch' && fingerInk);
    if (!canInk) return null;
    return t === 'eraser' ? 'erase' : 'draw';
  }

  // Capture phase, so it runs before any item sees the touch: palm rejection and pinch.
  viewport.addEventListener('pointerdown', e => {
    if (e.pointerType === 'pen') { penDown = true; return; }
    if (e.pointerType !== 'touch') return;
    if (penDown || performance.now() - lastPenUp < 450) {
      e.stopPropagation(); // a resting palm, not a finger
      e.preventDefault();
      return;
    }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) beginPinch();
    if (touches.size >= 2) e.stopPropagation();
  }, true);

  const pointerEnd = e => {
    if (e.pointerType === 'pen') {
      penDown = false;
      lastPenUp = performance.now();
    } else if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (pinch && touches.size < 2) pinch = null;
    }
  };
  window.addEventListener('pointerup', pointerEnd, true);
  window.addEventListener('pointercancel', pointerEnd, true);

  function beginPinch() {
    cancelGestures();
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, scale, panX, panY };
  }

  function updatePinch() {
    const [a, b] = [...touches.values()];
    if (!a || !b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const rect = viewport.getBoundingClientRect();
    const next = clamp((pinch.scale * d) / pinch.d, MIN_SCALE, MAX_SCALE);
    // The spot that began under the fingers' midpoint stays under it.
    const wx = (pinch.mx - rect.left - pinch.panX) / pinch.scale;
    const wy = (pinch.my - rect.top - pinch.panY) / pinch.scale;
    scale = next;
    panX = mx - rect.left - wx * next;
    panY = my - rect.top - wy * next;
    apply();
  }

  // A second finger landed: whatever one finger was doing is over.
  function cancelGestures() {
    if (inkGesture) endInk(true);
    if (drag) finishDrag();
  }

  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType !== 'pen') return;
    if (pinch) return;
    const mode = inkMode(e);
    if (mode) { beginInk(e, mode); return; }
    select(null);
    drag = {
      kind: 'pan', pid: e.pointerId, sx: e.clientX - panX, sy: e.clientY - panY,
      x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false
    };
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(e.pointerId);
  });

  // Pen barrel button and long-press would otherwise open the browser's menu.
  viewport.addEventListener('contextmenu', e => e.preventDefault());

  viewport.addEventListener('dblclick', e => {
    if (performance.now() - lastDoubleTap < 700) return; // already handled as a double-tap
    const hit = e.target.closest('.grid-item');
    if (hit) {
      const item = items.get(hit.dataset.id);
      if (item && item.type === 'text') textFields.text.focus();
      return;
    }
    if (tool !== 'select') return;
    const p = clientToWorld(e.clientX, e.clientY);
    addText(snap(p.x), snap(p.y));
  });

  function registerTap(e) {
    const now = performance.now();
    if (lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
      lastTap = null;
      lastDoubleTap = now;
      const p = clientToWorld(e.clientX, e.clientY);
      addText(snap(p.x), snap(p.y));
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  let redrawQueued = false;
  function queueRedraw(item) {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => { redrawQueued = false; if (items.has(item.id)) paint(item); });
  }

  function syncInspectorSize(item) {
    const size = `${cells(item.w)} × ${cells(item.h)} cells`;
    if (item.type === 'eq') $('#insp-kicker').textContent = `Equation sketch · ${size}`;
    else if (item.type === 'text') $('#insp-kicker').textContent = `Scribble · ${size}`;
    else $('#art-meta').textContent = `${size} · seed ${item.seed}${item.seed === sceneById[item.scene].seed ? ' (original)' : ''}`;
  }

  // ----- Ink gestures -----
  const round1 = v => Math.round(v * 10) / 10;

  function beginInk(e, mode) {
    if (e.pointerType === 'pen' && tool === 'select' && !penLocked) {
      showPenBar(true);
      setTool('pen');
      if (!penToastShown) {
        penToastShown = true;
        toast('Pen tools on. Fingers still pan, pinch and move things.');
      }
    }
    select(null);
    viewport.setPointerCapture(e.pointerId);
    inkGesture = { pid: e.pointerId, mode, stroke: null, path: null, erased: false };
    if (mode === 'draw') {
      const marker = tool === 'highlighter';
      const px = marker ? MARKER_SIZES[inkStyle.size] : PEN_SIZES[inkStyle.size];
      inkGesture.stroke = { c: inkStyle.color, w: round1((px / scale) * 100) / 100, h: marker ? 1 : 0, p: [] };
      inkGesture.path = document.createElementNS(SVG_NS, 'path');
      inkGesture.path.setAttribute('fill', inkStyle.color);
      if (marker) inkGesture.path.setAttribute('class', 'is-marker');
      inkSvg.append(inkGesture.path);
    }
    addInkPoints(e);
  }

  function addInkPoints(e) {
    const g = inkGesture;
    const batch = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of batch.length ? batch : [e]) {
      const w = clientToWorld(ev.clientX, ev.clientY);
      if (g.mode === 'erase') { eraseAt(w.x, w.y); continue; }
      const p = g.stroke.p;
      const n = p.length;
      if (n >= 3 && (w.x - p[n - 3]) ** 2 + (w.y - p[n - 2]) ** 2 < (0.9 / scale) ** 2) continue;
      const pressure = ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5;
      p.push(round1(w.x), round1(w.y), Math.round(pressure * 100) / 100);
    }
    if (g.mode === 'draw') g.path.setAttribute('d', GI.pathD(g.stroke));
  }

  // `gesture` remembers whether this stroke of the eraser has already made an undo step.
  function eraseAt(x, y, gesture = inkGesture, radius = 12 / scale) {
    let removed = 0;
    for (let i = ink.length - 1; i >= 0; i--) {
      if (!GI.hits(ink[i], x, y, radius)) continue;
      if (!gesture.erased) { record(); gesture.erased = true; }
      const [gone] = ink.splice(i, 1);
      const path = inkEls.get(gone);
      if (path) path.remove();
      removed++;
    }
    return removed;
  }

  function endInk(discard) {
    const g = inkGesture;
    inkGesture = null;
    if (!g) return;
    try { viewport.releasePointerCapture(g.pid); } catch (_) { /* already released */ }
    if (g.mode === 'draw') {
      if (discard || !g.stroke.p.length) {
        g.path.remove();
      } else {
        record();
        ink.push(g.stroke);
        inkEls.set(g.stroke, g.path);
      }
    }
    save();
  }

  // ----- Move / resize / pan -----
  viewport.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { updatePinch(); return; }
    if (inkGesture) {
      if (e.pointerId === inkGesture.pid) addInkPoints(e);
      return;
    }
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
      drag.moved = true;
      if (drag.kind !== 'pan') record();
    }
    if (drag.kind === 'pan') {
      panX = e.clientX - drag.sx;
      panY = e.clientY - drag.sy;
      apply();
      return;
    }
    const { item } = drag;
    const dx = (e.clientX - drag.sx) / scale;
    const dy = (e.clientY - drag.sy) / scale;
    if (drag.kind === 'move') {
      item.x = drag.x + dx;
      item.y = drag.y + dy;
      fit(item);
    } else if (item.type === 'art') {
      const next = clamp(cells(drag.w + Math.max(dx, dy)), ART_MIN, ART_MAX);
      item.w = item.h = next * CELL;
      fit(item);
    } else if (item.type === 'text') {
      item.w = clamp(cells(drag.w + dx), 3, 80) * CELL;
      fit(item);
      queueRedraw(item);
    } else {
      item.w = clamp(cells(drag.w + dx), EQ_MIN[0], EQ_MAX) * CELL;
      item.h = clamp(cells(drag.h + dy), EQ_MIN[1], EQ_MAX) * CELL;
      fit(item);
      queueRedraw(item);
    }
    if (item.id === selectedId) syncInspectorSize(item);
  });

  function finishDrag(e) {
    const finished = drag;
    if (!finished) return;
    drag = null;
    viewport.classList.remove('is-dragging');
    try { viewport.releasePointerCapture(finished.pid); } catch (_) { /* already released */ }
    if (finished.kind === 'resize' && finished.item.type !== 'art') paint(finished.item);
    if (e && tool === 'select' && finished.kind === 'pan' && !finished.moved && e.pointerType === 'touch' && performance.now() - finished.t0 < 350) {
      registerTap(e);
    }
    save();
  }

  const stopPointer = e => {
    if (inkGesture && e.pointerId === inkGesture.pid) { endInk(e.type === 'pointercancel'); return; }
    if (drag && e.pointerId === drag.pid) finishDrag(e);
  };
  viewport.addEventListener('pointerup', stopPointer);
  viewport.addEventListener('pointercancel', stopPointer);

  // Wheel / trackpad scroll pans; Ctrl (or pinch) + wheel zooms.
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(scale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
      apply();
    }
  }, { passive: false });

  viewport.addEventListener('keydown', e => {
    if (e.target !== viewport) return;
    const step = 80;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    panX += moves[e.key][0];
    panY += moves[e.key][1];
    apply();
  });

  document.addEventListener('keydown', e => {
    const typing = e.target.closest && e.target.closest('input, textarea, select, button, a');
    const editing = e.target.closest && e.target.closest('input, textarea, select'); // text fields keep their own undo
    if ((e.ctrlKey || e.metaKey) && !editing && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
    } else if (e.key === 'Escape') {
      if (!pop.hidden) closePop(); else select(null);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) {
      e.preventDefault();
      removeItem(selectedId);
    }
  });

  // ---------- Tray ----------
  const trayButtons = { art: $('#tray-art'), eq: $('#tray-eq'), export: $('#tray-export') };

  function openPop(panel) {
    pop.hidden = false;
    penBar.hidden = true;
    for (const section of pop.querySelectorAll('[data-panel]')) section.hidden = section.dataset.panel !== panel;
    for (const [name, btn] of Object.entries(trayButtons)) btn.setAttribute('aria-expanded', String(name === panel));
  }

  function closePop() {
    pop.hidden = true;
    penBar.hidden = !penBarOpen;
    for (const btn of Object.values(trayButtons)) btn.setAttribute('aria-expanded', 'false');
  }

  for (const [name, btn] of Object.entries(trayButtons)) {
    btn.addEventListener('click', () => {
      if (!pop.hidden && btn.getAttribute('aria-expanded') === 'true') closePop(); else openPop(name);
    });
  }

  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !e.target.closest('.grid-pop, .grid-tray')) closePop();
  });

  $('#tray-write').addEventListener('click', () => {
    closePop();
    const c = viewCenter();
    const p = clientToWorld(c.x, c.y);
    addText(snap(p.x - (fitCells(24) * CELL) / 2), snap(p.y - CELL));
  });

  // ---------- Pen bar ----------
  const trayPen = $('#tray-pen');
  const sizeBtns = [];
  const colorBtns = [];

  function setTool(next) {
    tool = next;
    for (const name of ['select', 'pen', 'highlighter', 'eraser']) viewport.classList.toggle(`tool-${name}`, name === next);
    for (const btn of penBar.querySelectorAll('[data-tool]')) btn.setAttribute('aria-pressed', String(btn.dataset.tool === next));
    if (next !== 'select') select(null);
    renderSizes();
  }

  function showPenBar(open) {
    penBarOpen = open;
    penBar.hidden = !open || !pop.hidden;
    trayPen.setAttribute('aria-pressed', String(open));
  }

  function renderSizes() {
    const marker = tool === 'highlighter';
    sizeBtns.forEach((btn, i) => {
      const px = marker ? MARKER_SIZES[i] : PEN_SIZES[i];
      btn.firstElementChild.style.width = btn.firstElementChild.style.height = `${Math.min(22, 4 + px * (marker ? 0.45 : 1.6))}px`;
      btn.setAttribute('aria-pressed', String(i === inkStyle.size));
    });
  }

  trayPen.addEventListener('click', () => {
    penLocked = false;
    if (penBarOpen) { showPenBar(false); setTool('select'); } else { closePop(); showPenBar(true); setTool('pen'); }
  });

  for (const btn of penBar.querySelectorAll('[data-tool]')) {
    btn.addEventListener('click', () => {
      penLocked = btn.dataset.tool === 'select';
      setTool(btn.dataset.tool);
    });
  }

  for (const color of GM.COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pen-swatch';
    btn.style.background = color;
    btn.setAttribute('aria-label', `Ink ${color}`);
    btn.addEventListener('click', () => {
      inkStyle.color = color;
      colorBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      if (tool === 'select' || tool === 'eraser') { penLocked = false; setTool('pen'); }
    });
    colorBtns.push(btn);
    $('#pen-colors').append(btn);
  }
  colorBtns[0].setAttribute('aria-pressed', 'true');

  PEN_SIZES.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', ['Thin', 'Medium', 'Thick'][i]);
    btn.append(document.createElement('i'));
    btn.addEventListener('click', () => { inkStyle.size = i; renderSizes(); });
    sizeBtns.push(btn);
    $('#pen-sizes').append(btn);
  });

  $('#pen-finger').addEventListener('click', e => {
    fingerInk = !fingerInk;
    e.currentTarget.setAttribute('aria-pressed', String(fingerInk));
    toast(fingerInk ? 'Finger draws now. Use two fingers to pan and zoom.' : 'Only the pen draws. Fingers pan, pinch and move things.');
  });

  function clearInk() {
    if (!ink.length) return;
    record();
    ink = [];
    renderInk();
    save();
    toast('Ink cleared. Undo brings it back.');
  }

  $('#pen-clear').addEventListener('click', clearInk);

  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);

  $('#insp-collapse').addEventListener('click', () => {
    const collapsed = inspector.classList.toggle('is-collapsed');
    $('#insp-collapse').setAttribute('aria-expanded', String(!collapsed));
  });

  $('#zoom-in').addEventListener('click', () => { const c = viewCenter(); zoomAt(scale * 1.25, c.x, c.y); });
  $('#zoom-out').addEventListener('click', () => { const c = viewCenter(); zoomAt(scale / 1.25, c.x, c.y); });
  $('#zoom-label').addEventListener('click', () => { const c = viewCenter(); zoomAt(1, c.x, c.y); });
  $('#view-center').addEventListener('click', () => center());

  // Press on a tray card: tap places it in the middle, drag drops it wherever you let go.
  function trayDrag(e, { cellsW, cellsH, ghostImage, place }) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;

    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.style.width = `${cellsW * CELL * scale}px`;
        ghost.style.height = `${cellsH * CELL * scale}px`;
        ghost.style.backgroundImage = `url("${ghostImage}")`;
        document.body.append(ghost);
        pop.classList.add('is-dragging');
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }
    };

    const placeAndClose = (x, y) => {
      place(x, y);
      if (window.matchMedia('(max-width: 700px)').matches) closePop(); // the sheet covers the canvas on a phone
    };

    const finish = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (!ghost) {
        const c = viewCenter();
        const w = clientToWorld(c.x, c.y);
        placeAndClose(w.x, w.y);
        return;
      }
      ghost.remove();
      // The pop-up is see-through to the pointer while dragging, so this finds what's underneath.
      const over = ev.type === 'pointercancel' ? null : document.elementFromPoint(ev.clientX, ev.clientY);
      pop.classList.remove('is-dragging');
      if (!over || !viewport.contains(over)) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      placeAndClose(w.x, w.y);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  function tapToPlace(btn, place) {
    btn.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const c = viewCenter();
      const w = clientToWorld(c.x, c.y);
      place(w.x, w.y);
    });
  }

  for (const scene of scenes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Add ${scene.title}`);
    const img = document.createElement('img');
    img.src = scene.thumb;
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = scene.title;
    btn.append(img, label);
    const place = (x, y) => addArt(scene.id, x, y);
    btn.addEventListener('pointerdown', e => trayDrag(e, { get cellsW() { return fitCells(ART_CELLS); }, get cellsH() { return fitCells(ART_CELLS); }, ghostImage: scene.thumb, place }));
    tapToPlace(btn, place);
    $('#pop-art').append(btn);
  }
  if (!scenes.length) $('#pop-art').textContent = 'No JavaScript artworks found.';

  for (const preset of GM.PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Add ${preset.name} equation sketch`);
    const canvas = document.createElement('canvas');
    // Preview on its own little dot grid, at the same cells-per-unit as the real thing.
    const cell = 120 / Math.max(preset.cells[0], preset.cells[1]);
    GM.drawPlot(canvas, {
      width: 120, height: 120, ratio: 2, cpu: preset.cpu, cell, rough: 0.8,
      seed: 7, axes: true, ticks: false, labels: false, dots: true, parsed: GM.parseAll(preset.text)
    });
    const label = document.createElement('span');
    label.textContent = preset.name;
    btn.append(canvas, label);
    const place = (x, y) => addEquation(preset.id, x, y);
    btn.addEventListener('pointerdown', e => trayDrag(e, {
      cellsW: preset.cells[0], cellsH: preset.cells[1], ghostImage: canvas.toDataURL(), place
    }));
    tapToPlace(btn, place);
    $('#pop-eq').append(btn);
  }

  // ---------- SVG export ----------
  const xmlEsc = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // One self-contained SVG: paper and dots (optional), every item, then the ink on top.
  // 1 SVG unit = 1 canvas pixel, cropped to what's actually there.
  function buildSvg(list, strokes, withGrid) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const grow = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    for (const item of list) grow(item.x, item.y, item.x + item.w, item.y + item.h);
    for (const stroke of strokes) grow(...GI.bounds(stroke));
    if (!Number.isFinite(x0)) return null;
    x0 = Math.max(0, Math.floor((x0 - CELL) / CELL) * CELL);
    y0 = Math.max(0, Math.floor((y0 - CELL) / CELL) * CELL);
    x1 = Math.min(WORLD_WIDTH, Math.ceil((x1 + CELL) / CELL) * CELL);
    y1 = Math.min(WORLD_HEIGHT, Math.ceil((y1 + CELL) / CELL) * CELL);
    const w = x1 - x0;
    const h = y1 - y0;

    const parts = [];
    if (withGrid) {
      parts.push(
        `<defs><pattern id="dots" x="-12" y="-12" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.5" fill="#cfc9ba"/></pattern></defs>`,
        `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f8f6f0"/>`,
        `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="url(#dots)"/>`
      );
    }

    for (const item of [...list].sort((a, b) => a.z - b.z)) {
      const at = `transform="translate(${item.x} ${item.y})"`;
      if (item.type === 'art') {
        const blend = withGrid ? ' style="mix-blend-mode:multiply"' : '';
        parts.push(`<image x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" href="${item.canvas.toDataURL('image/jpeg', 0.95)}"${blend}><title>${xmlEsc(sceneById[item.scene].title)}</title></image>`);
      } else if (item.type === 'eq') {
        if (!item.parsed) item.parsed = GM.parseAll(item.text);
        parts.push(`<g ${at}>${GM.plotSvg({
          width: item.w, height: item.h, cpu: item.cpu, cell: CELL, rough: item.rough, seed: item.wob,
          axes: item.axes, ticks: item.ticks, labels: item.labels, parsed: item.parsed
        })}</g>`);
      } else {
        parts.push(`<g ${at}>${GM.scribbleSvg({
          width: item.w, height: item.h, text: item.text, size: item.size,
          color: item.color, rough: item.rough, seed: item.wob, cell: CELL
        })}</g>`);
      }
    }

    if (strokes.length) {
      parts.push('<g id="ink">');
      for (const s of strokes) {
        parts.push(`<path d="${GI.pathD(s)}" fill="${s.c}"${s.h ? ' opacity="0.35" style="mix-blend-mode:multiply"' : ''}/>`);
      }
      parts.push('</g>');
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><title>Art Room — Art Grid</title>${parts.join('')}</svg>\n`;
  }

  function download(markup, name) {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBoard() {
    const svg = buildSvg([...items.values()].filter(i => i.type !== 'text' || i.text.trim()), ink, $('#exp-grid').checked);
    if (!svg) { toast('Nothing on the board yet.'); return; }
    download(svg, 'art-grid.svg');
  }

  function exportItem() {
    const item = items.get(selectedId);
    if (!item) return;
    // Ink drawn over the item travels with it.
    const over = ink.filter(s => {
      const [a, b, c, d] = GI.bounds(s);
      return c >= item.x && a <= item.x + item.w && d >= item.y && b <= item.y + item.h;
    });
    const name = item.type === 'art' ? `${item.scene}-${item.seed}` : item.type === 'text' ? 'scribble' : 'equation-sketch';
    download(buildSvg([item], over, $('#exp-grid').checked), `${name}.svg`);
  }

  $('#exp-board').addEventListener('click', exportBoard);
  $('#exp-item').addEventListener('click', exportItem);

  // ---------- Start ----------
  window.addEventListener('resize', apply);
  if (window.matchMedia('(max-width: 700px)').matches) inspector.classList.add('is-collapsed');
  const saved = load();
  if (saved) {
    ink = (Array.isArray(saved.ink) ? saved.ink : []).filter(st => st && Array.isArray(st.p) && st.p.length % 3 === 0 && typeof st.c === 'string');
    renderInk();
    for (const data of saved.items) {
      if (data.type === 'art' && !sceneById[data.scene]) continue;
      if (!['art', 'eq', 'text'].includes(data.type)) continue;
      const item = addItem(data, { selectIt: false });
      zCounter = Math.max(zCounter, item.z);
    }
    const v = saved.view || {};
    if (Number.isFinite(v.scale)) {
      scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
      panX = Number.isFinite(v.panX) ? v.panX : 0;
      panY = Number.isFinite(v.panY) ? v.panY : 0;
      apply();
    } else {
      center(1);
    }
  } else {
    center(1);
  }
  renderSizes();
  updateHistoryButtons();

  // ---------- Phone pad ----------
  // A phone's pen samples become ink here, just like the pen tool's (see grid-pad.js).
  if (window.GridPad) {
    phonePad = window.GridPad.attach({
      cell: CELL,
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      colors: GM.COLORS,
      penSizes: PEN_SIZES,
      markerSizes: MARKER_SIZES,
      world,
      liveLayer: inkSvg,
      view: () => ({ ox: -panX / scale, oy: -panY / scale, scale, w: viewport.clientWidth, h: viewport.clientHeight }),
      setView(ox, oy, next) {
        scale = clamp(next, MIN_SCALE, MAX_SCALE);
        panX = -ox * scale;
        panY = -oy * scale;
        apply();
      },
      ink: () => ink,
      items: () => [...items.values()].map(({ x, y, w, h }) => [x, y, w, h]),
      commit(stroke, path) {
        record();
        ink.push(stroke);
        path.setAttribute('d', GI.pathD(stroke));
        inkEls.set(stroke, path);
        save();
      },
      erase: (x, y, radius, gesture) => eraseAt(x, y, gesture, radius),
      save,
      undo,
      redo,
      clear: clearInk,
      showAll,
      toast
    });
  }
})();
