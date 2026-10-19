// Grid Math — turns equations into rough, hand-drawn plots.
// No eval: expressions go through a small tokenizer + recursive-descent parser.
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: Math.log10,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    min: Math.min, max: Math.max, pow: Math.pow
  };
  const CONSTS = { pi: Math.PI, e: Math.E, tau: TAU };
  const COLORS = ['#363930', '#b76d50', '#377898', '#63684c', '#bc7668', '#7d6a9e'];
  const HAND = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';

  // ---------- Parsing ----------

  function normalize(src) {
    return src
      .toLowerCase()
      .replace(/π/g, 'pi').replace(/θ/g, 'theta')
      .replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
      .replace(/²/g, '^2').replace(/³/g, '^3');
  }

  function tokenize(src) {
    const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z_][a-z0-9_]*)|(\S))/gy;
    const out = [];
    let m;
    while (re.lastIndex < src.length && (m = re.exec(src))) {
      if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
      else out.push({ t: 'op', v: m[3] });
    }
    return out;
  }

  // Compile an expression to (env) => number. `vars` lists the names allowed in env.
  function compile(src, vars) {
    const toks = tokenize(normalize(src));
    if (!toks.length) throw new Error('Nothing to plot here');
    let i = 0;
    const isOp = v => toks[i] && toks[i].t === 'op' && toks[i].v === v;
    const describe = tok => (tok ? `“${tok.v}”` : 'the end');

    function expect(v) {
      if (!isOp(v)) throw new Error(`Expected “${v}” but found ${describe(toks[i])}`);
      i++;
    }

    function parseExpr() {
      let left = parseTerm();
      while (isOp('+') || isOp('-')) {
        const plus = toks[i++].v === '+';
        const a = left;
        const b = parseTerm();
        left = plus ? env => a(env) + b(env) : env => a(env) - b(env);
      }
      return left;
    }

    function startsAtom() {
      const tok = toks[i];
      return !!tok && (tok.t === 'num' || tok.t === 'id' || (tok.t === 'op' && tok.v === '('));
    }

    function parseTerm() {
      let left = parseUnary();
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const times = toks[i++].v === '*';
          const a = left;
          const b = parseUnary();
          left = times ? env => a(env) * b(env) : env => a(env) / b(env);
        } else if (startsAtom()) {
          const a = left;
          const b = parsePower(); // implicit multiplication: 2x, 3sin(x), (x+1)(x-1)
          left = env => a(env) * b(env);
        } else {
          return left;
        }
      }
    }

    function parseUnary() {
      if (isOp('-')) { i++; const a = parseUnary(); return env => -a(env); }
      if (isOp('+')) { i++; return parseUnary(); }
      return parsePower();
    }

    function parsePower() {
      const base = parseAtom();
      if (isOp('^')) {
        i++;
        const exp = parseUnary();
        return env => Math.pow(base(env), exp(env));
      }
      return base;
    }

    function parseAtom() {
      const tok = toks[i];
      if (!tok) throw new Error('The expression ends too early');
      if (tok.t === 'num') { i++; const n = tok.v; return () => n; }
      if (tok.t === 'id') {
        i++;
        const name = tok.v;
        if (FUNCS[name]) {
          if (!isOp('(')) throw new Error(`${name} needs brackets, like ${name}(x)`);
          i++;
          const args = [parseExpr()];
          while (isOp(',')) { i++; args.push(parseExpr()); }
          expect(')');
          const fn = FUNCS[name];
          if (args.length === 1) { const a = args[0]; return env => fn(a(env)); }
          return env => fn(...args.map(a => a(env)));
        }
        if (name in CONSTS) { const n = CONSTS[name]; return () => n; }
        if (vars.includes(name)) return env => env[name];
        throw new Error(`Unknown name “${name}”`);
      }
      if (tok.v === '(') {
        i++;
        const inner = parseExpr();
        expect(')');
        return inner;
      }
      throw new Error(`Unexpected ${describe(tok)}`);
    }

    const fn = parseExpr();
    if (i < toks.length) throw new Error(`Unexpected ${describe(toks[i])}`);
    return fn;
  }

  function matchingParen(s, start) {
    let depth = 0;
    for (let k = start; k < s.length; k++) {
      if (s[k] === '(') depth++;
      else if (s[k] === ')' && --depth === 0) return k;
    }
    return -1;
  }

  function splitTop(s, sep) {
    const parts = [];
    let depth = 0;
    let last = 0;
    for (let k = 0; k < s.length; k++) {
      if (s[k] === '(') depth++;
      else if (s[k] === ')') depth--;
      else if (s[k] === sep && depth === 0) { parts.push(s.slice(last, k)); last = k + 1; }
    }
    parts.push(s.slice(last));
    return parts;
  }

  // One line of text → { kind, ... }. Throws a friendly Error when it can't be read.
  function parseLine(raw) {
    let s = normalize(raw).replace(/#.*$/, '').trim();
    if (!s) return null;

    let range = null;
    const rm = s.match(/\[([^[\]]*)\]\s*$/);
    if (rm) {
      const parts = splitTop(rm[1], ',');
      if (parts.length !== 2) throw new Error('A range looks like [start, end]');
      range = parts.map(p => compile(p, [])({}));
      if (!(range[1] > range[0])) throw new Error('The range must end after it starts');
      s = s.slice(0, rm.index).trim();
    }

    if (s[0] === '(' && matchingParen(s, 0) === s.length - 1) {
      const parts = splitTop(s.slice(1, -1), ',');
      if (parts.length === 2) {
        return { kind: 'param', fx: compile(parts[0], ['t']), fy: compile(parts[1], ['t']), range };
      }
    }

    const eq = s.indexOf('=');
    if (eq < 0) return { kind: 'y', f: compile(s, ['x']), range };
    const lhs = s.slice(0, eq).trim().replace(/^[a-z]\((x|y|theta|t)\)$/, (m, v) => (v === 'y' ? 'x' : v === 'x' ? 'y' : 'r'));
    const rhs = s.slice(eq + 1);
    if (lhs === 'y') return { kind: 'y', f: compile(rhs, ['x']), range };
    if (lhs === 'x') return { kind: 'x', f: compile(rhs, ['y']), range };
    if (lhs === 'r') return { kind: 'polar', f: compile(rhs, ['theta', 't']), range };
    throw new Error('Start with y =, x =, r =, or write a pair like (cos(t), sin(t))');
  }

  // Text box → one entry per non-empty line, each with either `eq` or `error`.
  function parseAll(text) {
    const out = [];
    let colour = 0;
    String(text).split('\n').forEach((raw, index) => {
      if (!raw.trim()) return;
      try {
        const eq = parseLine(raw);
        if (!eq) return;
        out.push({ line: index + 1, raw: raw.trim(), eq, color: COLORS[colour++ % COLORS.length] });
      } catch (error) {
        out.push({ line: index + 1, raw: raw.trim(), error: error.message });
      }
    });
    return out;
  }

  // ---------- Sampling ----------

  // Returns polylines of [x, y] in graph units; breaks the line at gaps and asymptotes.
  function sample(eq, view) {
    const spanX = view.xmax - view.xmin;
    const spanY = view.ymax - view.ymin;
    const lines = [];
    let cur = [];
    const flush = () => { if (cur.length > 1) lines.push(cur); cur = []; };
    const BIG = 1e5;
    const push = (x, y, jump) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > BIG || Math.abs(y) > BIG) { flush(); return; }
      if (cur.length && jump) {
        const prev = cur[cur.length - 1];
        if (Math.abs(x - prev[0]) > jump * spanX || Math.abs(y - prev[1]) > jump * spanY) flush();
      }
      cur.push([x, y]);
    };

    if (eq.kind === 'y' || eq.kind === 'x') {
      const horizontal = eq.kind === 'y';
      const [a, b] = eq.range || (horizontal ? [view.xmin, view.xmax] : [view.ymin, view.ymax]);
      const n = 1200;
      for (let k = 0; k <= n; k++) {
        const u = a + ((b - a) * k) / n;
        const v = eq.f(horizontal ? { x: u } : { y: u });
        if (horizontal) push(u, v, 4); else push(v, u, 4);
      }
    } else {
      const [a, b] = eq.range || [0, TAU];
      const n = Math.min(24000, Math.max(900, Math.ceil(((b - a) / TAU) * 700)));
      for (let k = 0; k <= n; k++) {
        const t = a + ((b - a) * k) / n;
        if (eq.kind === 'polar') {
          const r = eq.f({ theta: t, t });
          push(r * Math.cos(t), r * Math.sin(t), 0);
        } else {
          push(eq.fx({ t }), eq.fy({ t }), 0);
        }
      }
    }
    flush();
    return lines;
  }

  // ---------- Rough drawing ----------

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(rnd) {
    const lattice = Array.from({ length: 256 }, () => rnd() * 2 - 1);
    return t => {
      const i = Math.floor(t);
      const f = t - i;
      const s = f * f * (3 - 2 * f);
      const a = lattice[((i % 256) + 256) % 256];
      const b = lattice[(((i + 1) % 256) + 256) % 256];
      return a + (b - a) * s;
    };
  }

  // Draw a polyline (pixels) as a wobbly pen stroke, laid down in two passes like a sketch.
  function roughStroke(ctx, pts, color, width, rough, noise, phase) {
    if (pts.length < 2) return;
    const dense = [pts[0]];
    for (let k = 1; k < pts.length; k++) {
      const last = dense[dense.length - 1];
      if (Math.hypot(pts[k][0] - last[0], pts[k][1] - last[1]) >= 1.5 || k === pts.length - 1) dense.push(pts[k]);
    }
    const passes = rough > 0.05 ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      const amp = rough * (1.1 + pass * 0.7);
      const freq = 20 + pass * 11;
      const shift = phase + pass * 91;
      let length = 0;
      ctx.beginPath();
      for (let k = 0; k < dense.length; k++) {
        if (k) length += Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]);
        const u = length / freq + shift;
        const x = dense[k][0] + noise(u) * amp;
        const y = dense[k][1] + noise(u + 53.7) * amp;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = pass ? width * 0.6 : width;
      ctx.globalAlpha = pass ? 0.5 : 0.9;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function segment(ctx, x1, y1, x2, y2, color, width, rough, noise, phase) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.ceil(len / 8));
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
    roughStroke(ctx, pts, color, width, rough, noise, phase);
  }

  const fmt = v => String(+v.toFixed(2));

  /**
   * Plot parsed equations straight onto the dot grid, in a rough hand-drawn style.
   * The canvas is transparent: the page's dots are the graph paper. One grid cell is
   * `1 / cpu` graph units, and the origin always lands exactly on a dot.
   * opts: { width, height, ratio, cpu, cell, rough, seed, axes, ticks, labels, dots, parsed }
   */
  function drawPlot(canvas, opts) {
    const {
      width, height, ratio = 2, cpu = 1, cell = 24, rough = 1.2, seed = 1,
      axes = true, ticks = true, labels = false, dots = false, parsed = []
    } = opts;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const noise = makeNoise(mulberry(seed));
    const ox = Math.round(width / 2 / cell) * cell;
    const oy = Math.round(height / 2 / cell) * cell;
    const ppu = cell * cpu;
    const view = { xmin: -ox / ppu, xmax: (width - ox) / ppu, ymin: -(height - oy) / ppu, ymax: oy / ppu };
    const toPx = (x, y) => [ox + x * ppu, oy - y * ppu];

    if (dots) {
      ctx.fillStyle = '#f8f6f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#cfc9ba';
      for (let gx = ox % cell; gx <= width; gx += cell) {
        for (let gy = oy % cell; gy <= height; gy += cell) {
          ctx.beginPath();
          ctx.arc(gx, gy, Math.max(0.7, cell / 16), 0, TAU);
          ctx.fill();
        }
      }
    }

    if (axes) {
      const ink = '#4b4e43';
      const edge = Math.max(4, cell * 0.3);
      const head = Math.max(4, cell * 0.4);
      segment(ctx, edge, oy, width - edge, oy, ink, 1.5, rough * 0.8, noise, 400);
      segment(ctx, width - edge, oy, width - edge - head * 1.6, oy - head, ink, 1.5, rough * 0.5, noise, 410);
      segment(ctx, width - edge, oy, width - edge - head * 1.6, oy + head, ink, 1.5, rough * 0.5, noise, 420);
      segment(ctx, ox, height - edge, ox, edge, ink, 1.5, rough * 0.8, noise, 430);
      segment(ctx, ox, edge, ox - head, edge + head * 1.6, ink, 1.5, rough * 0.5, noise, 440);
      segment(ctx, ox, edge, ox + head, edge + head * 1.6, ink, 1.5, rough * 0.5, noise, 450);

      // Tick marks sit on every second dot, so the numbers read straight off the grid.
      const every = 2;
      const tick = Math.max(2.5, cell * 0.17);
      ctx.fillStyle = '#7a7d70';
      ctx.font = `${Math.max(8, Math.round(cell * 0.46))}px ${HAND}`;
      for (let k = -Math.floor(ox / (every * cell)); ox + k * every * cell < width - 2 * cell; k++) {
        if (!k) continue;
        const px = ox + k * every * cell;
        if (px < cell) continue;
        segment(ctx, px, oy - tick, px, oy + tick, ink, 1.2, rough * 0.4, noise, k * 13);
        if (ticks) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(fmt((k * every) / cpu), px, Math.min(height - cell * 0.6, oy + tick + 3));
        }
      }
      for (let k = -Math.floor((height - oy) / (every * cell)); oy - k * every * cell > 2 * cell; k++) {
        if (!k) continue;
        const py = oy - k * every * cell;
        if (py > height - cell) continue;
        segment(ctx, ox - tick, py, ox + tick, py, ink, 1.2, rough * 0.4, noise, k * 17 + 90);
        if (ticks) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(fmt((k * every) / cpu), Math.max(cell, ox - tick - 3), py);
        }
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    parsed.forEach((entry, idx) => {
      if (!entry.eq) return;
      for (const poly of sample(entry.eq, view)) {
        roughStroke(ctx, poly.map(p => toPx(p[0], p[1])), entry.color, Math.max(1.4, cell * 0.1), rough, noise, 600 + idx * 131);
      }
    });
    ctx.restore();

    if (labels) {
      ctx.font = `${Math.max(9, Math.round(cell * 0.62))}px ${HAND}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let y = cell * 0.5;
      for (const entry of parsed) {
        if (!entry.eq) continue;
        ctx.fillStyle = entry.color;
        ctx.fillText(entry.raw, cell * 0.6, y);
        y += cell * 0.85;
      }
    }
  }


  // ---------- Scribble font ----------
  // A single-stroke "pen" alphabet. Units: cap height 6, x-height 4, descenders go to -2.
  // A stroke is "x,y x,y …"; a leading "~" smooths it into a curve through those points.
  const circle = (cx, cy, rx, ry) => '~' + Array.from({ length: 9 }, (_, k) => {
    const a = (k / 8) * TAU;
    return `${(cx + Math.cos(a) * rx).toFixed(2)},${(cy + Math.sin(a) * ry).toFixed(2)}`;
  }).join(' ');
  const flip = (strokes, w, h) => strokes.map(s => (s[0] === '~' ? '~' : '') + s.replace('~', '').split(' ')
    .map(p => { const [x, y] = p.split(',').map(Number); return `${(w - x).toFixed(2)},${(h - y).toFixed(2)}`; }).join(' '));

  const SIX = ['~3,5.6 2,6 1,5.4 0.2,4 0,2 0.4,0.6 1.4,0 2.6,0.2 3.4,1.2 3.4,2.4 2.6,3.4 1.4,3.6 0.4,3 0.1,2.4'];
  const BOWL_A = '~3,3.6 2.2,4 1.2,3.8 0.4,2.8 0.2,1.8 0.6,0.6 1.6,0 2.6,0.4 3.1,1.2';
  const BOWL_B = '~0.2,3.2 1.2,4 2.4,3.8 3.2,2.8 3.3,1.6 2.8,0.5 1.8,0 0.8,0.4 0.2,1';
  const BOWL_D = '~3.2,3.2 2.2,4 1,3.8 0.3,2.8 0.2,1.6 0.7,0.5 1.7,0 2.7,0.4 3.2,1';
  const ARCH = '~0.2,2.8 1,3.8 2,4 2.9,3.6 3.2,2.6 3.2,0';
  const P_BOWL = '0,0 0,6 2.4,6 3.6,5.2 3.8,4.2 3.4,3.2 2.4,2.6 0,2.6';
  const O_CAP = '~2,6 3.2,5.6 4,4 4,2 3.2,0.4 2,0 0.8,0.4 0,2 0,4 0.8,5.6 2,6';

  const GLYPH_SRC = {
    A: ['0,0 2,6 4,0', '0.9,2.4 3.1,2.4'],
    B: ['0,0 0,6 2.5,6 3.6,5.2 3.6,4.2 2.5,3.2 0,3.2', '2.5,3.2 3.8,2.4 3.8,1 2.6,0 0,0'],
    C: ['~3.8,5 2.8,6 1.4,6 0.3,5 0,3 0.3,1 1.4,0 2.8,0 3.8,1'],
    D: ['0,0 0,6', '~0,6 2,6 3.6,5 4,3 3.6,1 2,0 0,0'],
    E: ['3.8,6 0,6 0,0 3.8,0', '0,3.1 2.8,3.1'],
    F: ['3.8,6 0,6 0,0', '0,3.1 2.8,3.1'],
    G: ['~3.8,5 2.8,6 1.4,6 0.3,5 0,3 0.3,1 1.4,0 2.8,0 3.8,1 3.8,2.8 2.2,2.8'],
    H: ['0,0 0,6', '4,0 4,6', '0,3.1 4,3.1'],
    I: ['0.5,6 3.5,6', '2,6 2,0', '0.5,0 3.5,0'],
    J: ['~3,6 3,1 2.4,0 1.2,0 0.3,0.8'],
    K: ['0,0 0,6', '3.8,6 0,2.6', '1.2,3.6 4,0'],
    L: ['0,6 0,0 3.6,0'],
    M: ['0,0 0,6 2,2.6 4,6 4,0'],
    N: ['0,0 0,6 4,0 4,6'],
    O: [O_CAP],
    P: [P_BOWL],
    Q: [O_CAP, '2.4,1.4 4,-0.4'],
    R: [P_BOWL, '1.6,2.6 3.8,0'],
    S: ['~3.7,5.2 2.8,6 1.4,6 0.4,5.2 0.4,4.2 1.4,3.3 2.6,2.8 3.7,1.9 3.7,0.8 2.7,0 1.3,0 0.2,0.8'],
    T: ['0,6 4,6', '2,6 2,0'],
    U: ['~0,6 0,1.5 0.6,0.3 2,0 3.4,0.3 4,1.5 4,6'],
    V: ['0,6 2,0 4,6'],
    W: ['0,6 1,0 2,4 3,0 4,6'],
    X: ['0,6 4,0', '4,6 0,0'],
    Y: ['0,6 2,3 4,6', '2,3 2,0'],
    Z: ['0.2,6 3.8,6 0.2,0 3.8,0'],
    a: [BOWL_A, '3.1,4 3.1,0.2 3.5,0'],
    b: ['0.2,6 0.2,0', BOWL_B],
    c: ['~3.2,3.4 2.4,4 1.3,3.9 0.5,3 0.2,2 0.5,1 1.3,0.1 2.4,0 3.2,0.7'],
    d: ['3.2,6 3.2,0', BOWL_D],
    e: ['0.3,2.1 3.3,2.1', '~3.3,2.1 3.1,3.3 2.3,4 1.3,3.9 0.5,3 0.2,2 0.5,0.9 1.3,0.1 2.4,0 3.2,0.7'],
    f: ['~3.2,5.6 2.6,6 1.8,5.8 1.5,5 1.5,0', '0.3,4 3,4'],
    g: [BOWL_A, '~3.1,4 3.1,-0.6 2.6,-1.7 1.5,-2 0.5,-1.6'],
    h: ['0.2,6 0.2,0', ARCH],
    i: ['1.5,4 1.5,0', '1.5,5.3 1.5,5.5'],
    j: ['~1.8,4 1.8,-1 1.4,-1.8 0.4,-2', '1.8,5.3 1.8,5.5'],
    k: ['0.2,6 0.2,0', '3,4 0.2,1.8', '1,2.6 3.2,0'],
    l: ['1.5,6 1.5,0'],
    m: ['0.2,4 0.2,0', '~0.2,2.8 0.8,3.8 1.6,4 2.2,3.4 2.3,0', '~2.3,2.8 2.9,3.8 3.7,4 4.3,3.4 4.4,0'],
    n: ['0.2,4 0.2,0', ARCH],
    o: ['~1.7,4 2.8,3.7 3.4,2.6 3.4,1.4 2.8,0.3 1.7,0 0.6,0.3 0,1.4 0,2.6 0.6,3.7 1.7,4'],
    p: ['0.2,4 0.2,-2', BOWL_B],
    q: ['3.2,4 3.2,-2', BOWL_D],
    r: ['0.2,4 0.2,0', '~0.2,2.6 0.9,3.7 1.8,4 2.6,3.8'],
    s: ['~3,3.4 2.3,4 1.2,4 0.4,3.4 0.5,2.6 1.5,2 2.6,1.5 3,0.8 2.4,0.1 1.3,0 0.3,0.6'],
    t: ['1.4,5.5 1.4,0.7 1.9,0 2.8,0.1', '0.2,4 2.9,4'],
    u: ['~0.2,4 0.2,1 0.7,0.2 1.7,0 2.7,0.5 3.2,1.4', '3.2,4 3.2,0'],
    v: ['0,4 1.6,0 3.2,4'],
    w: ['0,4 1,0 2.1,3.2 3.2,0 4.2,4'],
    x: ['0.1,4 3.1,0', '3.1,4 0.1,0'],
    y: ['0,4 1.6,0', '3.2,4 1.2,-1.6 0.4,-2'],
    z: ['0.2,4 3,4 0.2,0 3.2,0'],
    0: ['~1.8,6 3,5.5 3.6,4 3.6,2 3,0.5 1.8,0 0.6,0.5 0,2 0,4 0.6,5.5 1.8,6'],
    1: ['0.6,4.8 1.8,6 1.8,0'],
    2: ['~0.2,4.8 0.8,5.7 1.9,6 3,5.6 3.4,4.6 2.9,3.5 0.1,0.1', '0.1,0 3.6,0'],
    3: ['~0.2,5 1,5.8 2.2,6 3.2,5.4 3.3,4.4 2.4,3.4 1.2,3.2', '~1.2,3.2 2.6,3 3.5,2.2 3.5,1 2.6,0.1 1.4,0 0.4,0.4 0,1.2'],
    4: ['2.8,0 2.8,6 0,1.8 3.8,1.8'],
    5: ['3.2,6 0.6,6 0.4,3.4', '~0.4,3.4 1.4,3.8 2.6,3.6 3.4,2.6 3.5,1.4 2.8,0.3 1.6,0 0.6,0.4 0,1.2'],
    6: SIX,
    7: ['0,6 3.6,6 1.4,0'],
    8: ['~1.8,3.2 0.7,3.6 0.4,4.6 1,5.6 1.8,6 2.7,5.6 3.2,4.6 2.8,3.6 1.8,3.2 0.5,2.6 0,1.4 0.5,0.4 1.8,0 3,0.4 3.6,1.4 3.1,2.6 1.8,3.2'],
    9: flip(SIX, 3.4, 6),
    '.': ['1,0.05 1,0.25'],
    ',': ['1.2,0.4 0.8,-0.8'],
    '!': ['1,6 1,1.6', '1,0 1,0.2'],
    '?': ['~0.2,4.8 0.8,5.8 2,6 3,5.5 3.2,4.5 2.6,3.5 1.6,2.8 1.6,1.8', '1.6,0 1.6,0.2'],
    '-': ['0.3,2.6 2.7,2.6'],
    '+': ['0.3,3 3.3,3', '1.8,1.5 1.8,4.5'],
    '=': ['0.3,2 3.3,2', '0.3,3.8 3.3,3.8'],
    '/': ['0,0 2.6,6'],
    '\\': ['0,6 2.6,0'],
    '(': ['~2,6.4 1,5 0.6,3 1,1 2,-0.4'],
    ')': ['~0.4,6.4 1.4,5 1.8,3 1.4,1 0.4,-0.4'],
    '[': ['1.8,6.4 0.6,6.4 0.6,-0.4 1.8,-0.4'],
    ']': ['0.6,6.4 1.8,6.4 1.8,-0.4 0.6,-0.4'],
    '|': ['1,6.4 1,-0.8'],
    ':': ['1,3.8 1,4', '1,0 1,0.2'],
    ';': ['1,3.8 1,4', '1,0.4 0.6,-0.8'],
    "'": ['1,6 0.8,4.8'],
    '"': ['0.6,6 0.4,4.8', '1.8,6 1.6,4.8'],
    '*': ['1.6,4.6 1.6,1.6', '0.3,3.9 2.9,2.3', '0.3,2.3 2.9,3.9'],
    '_': ['0,-0.6 3.6,-0.6'],
    '%': ['0,0 3.4,6', circle(0.7, 5.2, 0.6, 0.7), circle(2.7, 0.8, 0.6, 0.7)],
    '<': ['3,4.6 0.4,3 3,1.4'],
    '>': ['0.4,4.6 3,3 0.4,1.4'],
    '^': ['0.4,4.2 1.8,6 3.2,4.2'],
    '°': [circle(1, 5.2, 0.8, 0.8)],
    '×': ['0.3,4.2 3.1,1.2', '0.3,1.2 3.1,4.2'],
    '÷': ['0.3,3 3.3,3', '1.8,4.4 1.8,4.5', '1.8,1.5 1.8,1.6'],
    'π': ['0,4.2 3.6,4.2', '1,4.2 0.8,0', '2.6,4.2 2.7,0.2 3.2,0'],
    '√': ['0,2.8 0.7,2.4 1.7,0 2.8,5.6 5,5.6'],
    '{': ['~2,6.4 1,5 0.6,3 1,1 2,-0.4'],
    '}': ['~0.4,6.4 1.4,5 1.8,3 1.4,1 0.4,-0.4']
  };

  // Catmull-Rom through the points (open, or closed when the last point repeats the first).
  function spline(pts) {
    const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    const n = pts.length;
    const at = k => (closed ? pts[((k % (n - 1)) + (n - 1)) % (n - 1)] : pts[Math.max(0, Math.min(n - 1, k))]);
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      for (let s = 0; s < 8; s++) {
        const t = s / 8;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[n - 1]);
    return out;
  }

  const GLYPHS = {};
  for (const [ch, strokes] of Object.entries(GLYPH_SRC)) {
    const parsedStrokes = strokes.map(src => {
      const smooth = src[0] === '~';
      const pts = src.replace('~', '').split(' ').map(p => p.split(',').map(Number));
      return smooth ? spline(pts) : pts;
    });
    const w = Math.max(0.8, ...parsedStrokes.flat().map(p => p[0]));
    GLYPHS[ch] = { strokes: parsedStrokes, w };
  }

  const GAP = 1.25;
  const SPACE = 2.4;
  const advance = ch => (ch === ' ' ? SPACE : (GLYPHS[ch] || GLYPHS['?']).w + GAP);

  // Word-wrap text into lines that fit `widthPx`, and work out how many grid cells tall it is.
  function layoutScribble(text, size, widthPx, cell = 24) {
    const u = (size * cell) / 6;
    const maxU = Math.max(4, (widthPx - 8) / u);
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = [];
      let lineW = 0;
      const flush = () => { lines.push({ chars: line, w: lineW }); line = []; lineW = 0; };
      for (const word of para.split(' ')) {
        const chars = Array.from(word);
        const wordW = chars.reduce((s, ch) => s + advance(ch), 0);
        if (line.length && lineW + SPACE + wordW > maxU) flush();
        else if (line.length) { line.push(' '); lineW += SPACE; }
        for (const ch of chars) {
          const adv = advance(ch);
          if (line.length && lineW + adv > maxU) flush();
          line.push(ch);
          lineW += adv;
        }
      }
      flush();
    }
    const below = Math.max(1, Math.ceil(size / 3));
    const pitch = size + below;
    return { lines, u, pitch, cells: Math.max(2, size + (lines.length - 1) * pitch + below) };
  }

  function resample(pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    return out;
  }

  /**
   * Scribble text onto a transparent canvas, letter by letter, with a wobbly pen.
   * opts: { width, height, ratio, text, size (cap height in cells), color, rough, seed, cell, dots, layout }
   */
  function drawScribble(canvas, opts) {
    const { width, height, ratio = 2, text, size = 2, color = '#363930', rough = 1.2, seed = 1, cell = 24, dots = false } = opts;
    const layout = opts.layout || layoutScribble(text, size, width, cell);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (dots) {
      ctx.fillStyle = '#f8f6f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#cfc9ba';
      for (let gx = 0; gx <= width; gx += cell) {
        for (let gy = 0; gy <= height; gy += cell) {
          ctx.beginPath();
          ctx.arc(gx, gy, Math.max(0.7, cell / 16), 0, TAU);
          ctx.fill();
        }
      }
    }

    const { u, pitch, lines } = layout;
    const rnd = mulberry(seed);
    const noise = makeNoise(mulberry(seed ^ 0x9e3779b9));
    const pen = 1.1 + size * 0.55;
    const amp = rough * (0.5 + size * 0.3);
    lines.forEach((line, row) => {
      const base = (size + row * pitch) * cell;
      let x = 4;
      for (const ch of line.chars) {
        const glyph = ch === ' ' ? null : GLYPHS[ch] || GLYPHS['?'];
        if (glyph) {
          // Every letter is a little different: tipped, nudged, a touch bigger or smaller.
          const tilt = (rnd() - 0.5) * 0.12 * Math.min(rough + 0.3, 2);
          const lift = (rnd() - 0.5) * 0.35 * Math.min(rough + 0.3, 2);
          const grow = 1 + (rnd() - 0.5) * 0.1;
          const cx = glyph.w / 2;
          const cos = Math.cos(tilt);
          const sin = Math.sin(tilt);
          const phase = rnd() * 300;
          glyph.strokes.forEach((stroke, si) => {
            const pts = resample(stroke.map(([gx, gy]) => {
              const rx = (gx - cx) * cos - gy * sin + cx;
              const ry = (gx - cx) * sin + gy * cos;
              return [x + rx * u * grow, base - (ry + lift) * u * grow];
            }), 3);
            roughStroke(ctx, pts, color, pen, amp, noise, phase + si * 17);
          });
        }
        x += advance(ch) * u + (rnd() - 0.5) * 0.12 * u;
      }
    });
  }

  // cpu = grid cells per graph unit; cells = default size [w, h] in grid cells.
  const PRESETS = [
    { id: 'wave', name: 'Wave', cpu: 2, cells: [24, 20], text: 'y = 2sin(x)\ny = 0.5cos(3x) - 3' },
    { id: 'heart', name: 'Heart', cpu: 0.5, cells: [20, 20], text: '(16sin(t)^3, 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))' },
    { id: 'rose', name: 'Rose', cpu: 2, cells: [20, 20], text: 'r = 5cos(4theta)' },
    { id: 'spiral', name: 'Spiral', cpu: 1, cells: [20, 20], text: 'r = 0.25theta [0, 12pi]' },
    { id: 'butterfly', name: 'Butterfly', cpu: 2, cells: [20, 20], text: 'r = e^cos(theta) - 2cos(4theta) + sin(theta/12)^5 [0, 24pi]' },
    { id: 'lissajous', name: 'Lissajous', cpu: 2, cells: [24, 24], text: '(5sin(3t), 5sin(2t))' },
    { id: 'parabolas', name: 'Parabolas', cpu: 1, cells: [20, 20], text: 'y = x^2/3 - 3\nx = y^2/3 - 3\ny = x^3/8' },
    { id: 'circles', name: 'Circles', cpu: 2, cells: [20, 20], text: '(2cos(t), 2sin(t))\n(4cos(t), 4sin(t))\n(cos(t) + 2, sin(t) - 2)' }
  ];

  window.GridMath = { parseAll, drawPlot, drawScribble, layoutScribble, PRESETS, COLORS };
})();
