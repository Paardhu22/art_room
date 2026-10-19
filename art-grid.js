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

  world.style.width = `${WORLD_WIDTH}px`;
  world.style.height = `${WORLD_HEIGHT}px`;

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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = {
          view: { panX, panY, scale },
          items: [...items.values()].map(({ el, canvas, parsed, token, ...rest }) => rest)
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
      if (e.button !== 0) return;
      e.stopPropagation();
      if (e.target.closest('.item-del')) return;
      select(item.id);
      drag = e.target.closest('.item-resize')
        ? { kind: 'resize', item, sx: e.clientX, sy: e.clientY, w: item.w, h: item.h }
        : { kind: 'move', item, sx: e.clientX, sy: e.clientY, x: item.x, y: item.y };
      viewport.setPointerCapture(e.pointerId);
    });

    el.addEventListener('focus', () => select(item.id));
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

  function addItem(data, { selectIt = true } = {}) {
    const item = { id: `i${Date.now().toString(36)}${(uid++).toString(36)}`, z: ++zCounter, ...data };
    items.set(item.id, item);
    buildEl(item);
    fit(item);
    paint(item);
    if (selectIt) select(item.id);
    save();
    return item;
  }

  function removeItem(id) {
    const item = items.get(id);
    if (!item) return;
    item.el.remove();
    items.delete(id);
    if (selectedId === id) select(null);
    save();
  }

  function addArt(sceneId, worldX, worldY, extra = {}) {
    const scene = sceneById[sceneId];
    if (!scene) return;
    const size = ART_CELLS * CELL;
    return addItem({
      type: 'art', scene: sceneId, seed: scene.seed,
      x: worldX - size / 2, y: worldY - size / 2, w: size, h: size, ...extra
    });
  }

  function addEquation(presetId, worldX, worldY) {
    const preset = GM.PRESETS.find(p => p.id === presetId) || GM.PRESETS[0];
    const w = preset.cells[0] * CELL;
    const h = preset.cells[1] * CELL;
    return addItem({
      type: 'eq', text: preset.text, cpu: preset.cpu, rough: 1.2, wob: rand32(),
      axes: true, ticks: true, labels: false,
      x: worldX - w / 2, y: worldY - h / 2, w, h
    });
  }

  const INK = GM.COLORS[0];

  function addText(worldX, worldY, text = '') {
    const w = 24 * CELL;
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
    item.seed = rand32();
    drawArt(item);
    syncInspector();
    save();
  });
  $('#art-original').addEventListener('click', () => {
    const item = items.get(selectedId);
    if (!item || item.type !== 'art') return;
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

  // ---------- Pointer handling (pan / move / resize) ----------
  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    select(null);
    drag = { kind: 'pan', sx: e.clientX - panX, sy: e.clientY - panY };
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('dblclick', e => {
    const hit = e.target.closest('.grid-item');
    if (hit) {
      const item = items.get(hit.dataset.id);
      if (item && item.type === 'text') textFields.text.focus();
      return;
    }
    const p = clientToWorld(e.clientX, e.clientY);
    addText(snap(p.x), snap(p.y));
  });

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

  viewport.addEventListener('pointermove', e => {
    if (!drag) return;
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

  const stopDrag = e => {
    if (!drag) return;
    const finished = drag;
    drag = null;
    viewport.classList.remove('is-dragging');
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
    if (finished.kind === 'resize' && finished.item.type !== 'art') paint(finished.item);
    save();
  };
  viewport.addEventListener('pointerup', stopDrag);
  viewport.addEventListener('pointercancel', stopDrag);

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
    if (e.key === 'Escape') {
      if (!pop.hidden) closePop(); else select(null);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) {
      e.preventDefault();
      removeItem(selectedId);
    }
  });

  // ---------- Tray ----------
  const trayButtons = { art: $('#tray-art'), eq: $('#tray-eq') };

  function openPop(panel) {
    pop.hidden = false;
    for (const section of pop.querySelectorAll('[data-panel]')) section.hidden = section.dataset.panel !== panel;
    for (const [name, btn] of Object.entries(trayButtons)) btn.setAttribute('aria-expanded', String(name === panel));
  }

  function closePop() {
    pop.hidden = true;
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
    addText(snap(p.x - 12 * CELL), snap(p.y - CELL));
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

    const finish = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (!ghost) {
        const c = viewCenter();
        const w = clientToWorld(c.x, c.y);
        place(w.x, w.y);
        return;
      }
      ghost.remove();
      // The pop-up is see-through to the pointer while dragging, so this finds what's underneath.
      const over = ev.type === 'pointercancel' ? null : document.elementFromPoint(ev.clientX, ev.clientY);
      pop.classList.remove('is-dragging');
      if (!over || !viewport.contains(over)) return;
      const w = clientToWorld(ev.clientX, ev.clientY);
      place(w.x, w.y);
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
    btn.addEventListener('pointerdown', e => trayDrag(e, { cellsW: ART_CELLS, cellsH: ART_CELLS, ghostImage: scene.thumb, place }));
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

  // ---------- Start ----------
  window.addEventListener('resize', apply);
  const saved = load();
  if (saved) {
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
})();
