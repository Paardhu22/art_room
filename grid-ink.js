// Grid Ink — turns pen strokes into smooth, pressure-shaped outlines and tests eraser hits.
// A stroke is plain data: { c: colour, w: base width, h: 1 for highlighter, p: [x, y, pressure, …] }.
(() => {
  'use strict';

  const fmt = v => Math.round(v * 10) / 10;

  // Pressure thins and thickens the line; the highlighter keeps one even width.
  function widthAt(stroke, i) {
    return stroke.h ? stroke.w : stroke.w * (0.35 + 1.3 * stroke.p[i * 3 + 2]);
  }

  function count(stroke) {
    return Math.floor(stroke.p.length / 3);
  }

  // Closed outline of the stroke as an SVG path, rounded at both ends.
  function pathD(stroke) {
    const n = count(stroke);
    if (!n) return '';
    const x = i => stroke.p[i * 3];
    const y = i => stroke.p[i * 3 + 1];

    if (n === 1) {
      const r = Math.max(0.5, widthAt(stroke, 0) / 2);
      return `M${fmt(x(0) - r)},${fmt(y(0))}a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(r * 2)},0a${fmt(r)},${fmt(r)} 0 1,0 ${fmt(-r * 2)},0Z`;
    }

    // Smooth the widths a little so pressure changes don't make the edge jitter.
    const radius = [];
    for (let i = 0; i < n; i++) {
      const a = widthAt(stroke, Math.max(0, i - 1));
      const b = widthAt(stroke, i);
      const c = widthAt(stroke, Math.min(n - 1, i + 1));
      radius.push((a + 2 * b + c) / 8);
    }

    const left = [];
    const right = [];
    const dirs = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let dx = x(b) - x(a);
      let dy = y(b) - y(a);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      dirs.push([dx, dy]);
      left.push([x(i) - dy * radius[i], y(i) + dx * radius[i]]);
      right.push([x(i) + dy * radius[i], y(i) - dx * radius[i]]);
    }

    const cap = (i, sign) => {
      const [dx, dy] = dirs[i];
      const r = radius[i];
      const out = [];
      for (let k = 1; k < 6; k++) {
        const t = (Math.PI * k) / 6;
        const side = sign * Math.cos(t) * r;
        const fwd = sign * Math.sin(t) * r;
        out.push([x(i) - dy * side + dx * fwd, y(i) + dx * side + dy * fwd]);
      }
      return out;
    };

    // Left edge forward, round the far end, right edge back, round the start.
    const poly = [...left, ...cap(n - 1, 1), ...right.reverse(), ...cap(0, -1).reverse()];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(poly[poly.length - 1], poly[0]);
    let d = `M${fmt(start[0])},${fmt(start[1])}`;
    for (let i = 0; i < poly.length; i++) {
      const next = poly[(i + 1) % poly.length];
      const m = mid(poly[i], next);
      d += `Q${fmt(poly[i][0])},${fmt(poly[i][1])} ${fmt(m[0])},${fmt(m[1])}`;
    }
    return `${d}Z`;
  }

  // Does the eraser (a circle of radius r at x, y) touch this stroke?
  function hits(stroke, px, py, r) {
    const n = count(stroke);
    const reach = r + (stroke.h ? stroke.w : stroke.w * 1.65) / 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, stroke.p[i * 3]);
      maxX = Math.max(maxX, stroke.p[i * 3]);
      minY = Math.min(minY, stroke.p[i * 3 + 1]);
      maxY = Math.max(maxY, stroke.p[i * 3 + 1]);
    }
    if (px < minX - reach || px > maxX + reach || py < minY - reach || py > maxY + reach) return false;
    for (let i = 0; i < n; i++) {
      const ax = stroke.p[i * 3];
      const ay = stroke.p[i * 3 + 1];
      const bx = i + 1 < n ? stroke.p[(i + 1) * 3] : ax;
      const by = i + 1 < n ? stroke.p[(i + 1) * 3 + 1] : ay;
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
      if (Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) <= reach) return true;
    }
    return false;
  }

  window.GridInk = { pathD, hits };
})();
