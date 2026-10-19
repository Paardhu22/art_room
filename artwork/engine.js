// A deterministic pen-and-watercolour atelier. Every mark is Canvas 2D code.
export function atelier(canvas, seed = 42719) {
  canvas.width = canvas.height = 1200;
  const c = canvas.getContext("2d", { willReadFrequently: true });
  let state = seed >>> 0;
  const r = (a = 1, b) => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return b === undefined ? v * a : a + v * (b - a);
  };
  const ink = "#554333",
    paper = "#f2e8d3";
  const mix = (a, b, t) => {
    const n = (x) => x.match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16));
    const x = n(a),
      y = n(b);
    return (
      "#" +
      x
        .map((v, i) =>
          Math.round(v + (y[i] - v) * t)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  };
  const hash = (x, y) => {
    let v = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const i = Math.floor(x),
      j = Math.floor(y),
      u = x - i,
      v = y - j,
      s = u * u * (3 - 2 * u),
      t = v * v * (3 - 2 * v);
    return (
      (hash(i, j) * (1 - s) + hash(i + 1, j) * s) * (1 - t) +
      (hash(i, j + 1) * (1 - s) + hash(i + 1, j + 1) * s) * t
    );
  };
  function path(pts, close = false) {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
    if (close) c.closePath();
  }
  function line(pts, col = ink, w = 0.8, alpha = 0.8) {
    c.save();
    c.strokeStyle = col;
    c.lineWidth = w;
    c.globalAlpha = alpha;
    c.lineJoin = "round";
    c.lineCap = "round";
    path(pts);
    c.stroke();
    c.restore();
  }
  function poly(pts, fill, stroke = ink, w = 0.8, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    path(pts, true);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = w;
      c.lineJoin = "round";
      c.stroke();
    }
    c.restore();
  }
  function ellipse(x, y, rx, ry, fill, stroke = null, w = 0.7, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.lineWidth = w;
      c.strokeStyle = stroke;
      c.stroke();
    }
    c.restore();
  }
  function curve(pts, col = ink, w = 1, alpha = 0.8) {
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i += 3)
      c.bezierCurveTo(...pts[i], ...pts[i + 1], ...pts[i + 2]);
    c.stroke();
    c.restore();
  }
  function rect(x, y, w, h, fill, stroke = ink, weight = 0.7, alpha = 1) {
    poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      fill,
      stroke,
      weight,
      alpha,
    );
  }
  function wash(pts, col, alpha = 0.5, bleed = 3) {
    // Several translucent, irregularly overlapping edges imitate pigment pooling.
    c.save();
    path(pts, true);
    c.clip();
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]),
      x = Math.min(...xs),
      y = Math.min(...ys),
      w = Math.max(...xs) - x,
      h = Math.max(...ys) - y;
    const grad = c.createLinearGradient(x, y, x + w * 0.7, y + h);
    grad.addColorStop(0, mix(col, paper, 0.17));
    grad.addColorStop(0.65, col);
    grad.addColorStop(1, mix(col, ink, 0.13));
    c.fillStyle = grad;
    c.globalAlpha = alpha;
    c.fillRect(x, y, w, h);
    const n = Math.min(1100, Math.ceil((w * h) / 380));
    for (let i = 0; i < n; i++) {
      const xx = r(x, x + w),
        yy = r(y, y + h);
      ellipse(
        xx,
        yy,
        r(1, 12),
        r(0.7, 6),
        r() > 0.5 ? col : paper,
        null,
        0,
        r(0.01, 0.055),
      );
    }
    c.restore();
    if (bleed)
      for (let i = 0; i < 3; i++)
        poly(
          pts.map(([xx, yy]) => [xx + r(-bleed, bleed), yy + r(-bleed, bleed)]),
          col,
          null,
          0,
          alpha * 0.045,
        );
  }
  function hatch(pts, col = ink, spacing = 7, alpha = 0.17, angle = -0.6) {
    c.save();
    path(pts, true);
    c.clip();
    c.translate(600, 600);
    c.rotate(angle);
    for (let x = -1800; x < 1800; x += spacing)
      line(
        [
          [x, -1800],
          [x, 1800],
        ],
        col,
        0.65,
        alpha,
      );
    c.restore();
  }
  function arch(x, y, w, h, col = "#594c3b", alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.bezierCurveTo(x, y - w * 0.13, x + w, y - w * 0.13, x + w, y + w / 2);
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();
  }
  function masonry(pts, step = 22, col = ink, alpha = 0.22) {
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]),
      x0 = Math.min(...xs),
      y0 = Math.min(...ys),
      x1 = Math.max(...xs),
      y1 = Math.max(...ys);
    c.save();
    path(pts, true);
    c.clip();
    for (let y = y0; y < y1; y += step) {
      line(
        [
          [x0, y],
          [x1, y],
        ],
        col,
        0.6,
        alpha,
      );
      for (
        let x = x0 + (Math.round(y / step) % 2) * step;
        x < x1;
        x += step * 2.3
      )
        line(
          [
            [x, y],
            [x + r(-2, 2), y + step],
          ],
          col,
          0.6,
          alpha,
        );
    }
    c.restore();
  }
  function cloud(x, y, w = 180, h = 35, col = paper, alpha = 0.4) {
    for (let i = 0; i < 8; i++)
      ellipse(
        x + r(-w * 0.5, w * 0.5),
        y + r(-h * 0.2, h * 0.2),
        r(w * 0.12, w * 0.35),
        r(h * 0.35, h),
        col,
        null,
        0,
        alpha * 0.16,
      );
  }
  function mountain(points, col, opacity = 0.45) {
    const ridge = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i],
        q = points[i + 1],
        n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 10));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        ridge.push([
          p[0] + (q[0] - p[0]) * t,
          p[1] + (q[1] - p[1]) * t + Math.sin(t * Math.PI) * r(-4, 4),
        ]);
      }
    }
    ridge.push(points.at(-1));
    wash(
      [...ridge, [points.at(-1)[0], 820], [points[0][0], 820]],
      col,
      opacity,
      5,
    );
    line(ridge, mix(col, ink, 0.25), 0.65, 0.4);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      for (let j = 0; j < 5; j++) {
        const dx = (j - 2) * r(12, 25);
        line(
          [
            [x + dx * 0.1, y + 12],
            [x + dx * 0.6, y + r(40, 70)],
            [x + dx, y + r(90, 165)],
          ],
          col,
          0.65,
          0.24,
        );
      }
    }
  }
  function tree(x, y, size = 80, col = "#6c8060", kind = "round") {
    const trunk = () => {
      line(
        [
          [x, y],
          [x - 3, y - size * 0.76],
        ],
        "#64533c",
        Math.max(1, size * 0.035),
        0.9,
      );
      for (let i = 0; i < 5; i++) {
        const yy = y - size * r(0.28, 0.8);
        line(
          [
            [x, yy],
            [x + r(-size * 0.3, size * 0.3), yy - size * 0.2],
          ],
          ink,
          0.6,
          0.5,
        );
      }
    };
    if (kind === "cypress") {
      const pts = [
        [x, y - size],
        [x + size * 0.13, y - size * 0.5],
        [x + size * 0.12, y - 7],
        [x - size * 0.12, y - 7],
        [x - size * 0.15, y - size * 0.5],
      ];
      wash(pts, col, 0.85, 2);
      trunk();
      for (let i = 0; i < 20; i++) {
        const yy = r(y - size * 0.9, y - 8),
          ww = Math.sin(((y - yy) / size) * Math.PI) * size * 0.11;
        line(
          [
            [x - ww, yy],
            [x, yy - 5],
            [x + ww, yy],
          ],
          ink,
          0.6,
          0.45,
        );
      }
      return;
    }
    trunk();
    for (let i = 0; i < 55; i++) {
      const a = r(Math.PI * 2),
        rr = Math.sqrt(r()) * size * 0.4;
      const xx = x + Math.cos(a) * rr,
        yy = y - size * 0.68 + Math.sin(a) * rr * 0.67;
      ellipse(
        xx,
        yy,
        r(size * 0.06, size * 0.16),
        r(size * 0.035, size * 0.1),
        mix(col, paper, r(0.05, 0.35)),
        null,
        0,
        r(0.25, 0.7),
      );
      if (i % 2 === 0)
        curve(
          [
            [xx - 6, yy],
            [xx - 4, yy - 9],
            [xx + 4, yy - 9],
            [xx + 7, yy],
          ],
          ink,
          0.6,
          0.4,
        );
    }
    for (let i = 0; i < Math.max(40, Math.round(size * 3)); i++) {
      const angle = r(Math.PI * 2),
        rr = Math.sqrt(r()) * size * 0.48,
        xx = x + Math.cos(angle) * rr,
        yy = y - size * 0.68 + Math.sin(angle) * rr * 0.66;
      const s = r(0.6, 2.1) * Math.max(0.45, size / 180);
      line(
        [
          [xx - s, yy + s],
          [xx, yy - s],
          [xx + s * 0.8, yy],
        ],
        i % 3 ? mix(col, ink, 0.25) : mix(col, paper, 0.7),
        r(0.4, 0.9),
        r(0.3, 0.6),
      );
    }
  }
  function grass(x, y, s = 1, col = "#76815d") {
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 4 * s;
      curve(
        [
          [x, y],
          [x + dx * 0.3, y - 8 * s],
          [x + dx * 0.7, y - 15 * s],
          [x + dx, y - r(13, 24) * s],
        ],
        col,
        0.8,
        0.65,
      );
    }
  }
  function rock(x, y, w = 35, h = 20, col = "#bba889") {
    const pts = [
      [x - w * 0.55, y],
      [x - w * 0.4, y - h * 0.8],
      [x + w * 0.02, y - h],
      [x + w * 0.55, y - h * 0.18],
      [x + w * 0.4, y + h * 0.2],
    ];
    wash(pts, col, 0.7, 1);
    line([...pts, pts[0]], ink, 0.8, 0.7);
    line([pts[2], [x + w * 0.1, y], pts[4]], ink, 0.6, 0.5);
    for (let i = 0; i < 4; i++)
      line(
        [
          [x + w * 0.1 + i * 3, y - 4],
          [x + w * 0.2 + i * 3, y - h * 0.35],
        ],
        ink,
        0.6,
        0.25,
      );
  }
  function birds(x, y, n = 5, spread = 180) {
    for (let i = 0; i < n; i++) {
      const xx = x + r(-spread / 2, spread / 2),
        yy = y + r(-spread * 0.15, spread * 0.15),
        s = r(3, 8);
      curve(
        [
          [xx - s, yy],
          [xx - s * 0.4, yy - 4],
          [xx - 1, yy - 3],
          [xx, yy],
          [xx + 1, yy - 3],
          [xx + s * 0.4, yy - 4],
          [xx + s, yy],
        ],
        ink,
        0.9,
        0.65,
      );
    }
  }
  function ripples(x0, y0, x1, y1, col = "#4e7b80", n = 350) {
    for (let i = 0; i < n; i++) {
      const x = r(x0, x1),
        y = r(y0, y1),
        w = r(3, 24) * (y / 1200 + 0.3);
      line(
        [
          [x - w, y],
          [x, y - r(0.5, 2)],
          [x + w, y],
        ],
        col,
        r(0.45, 1),
        r(0.15, 0.45),
      );
    }
  }
  function ground(col = "#c7b995") {
    wash(
      [
        [36, 800],
        [1164, 760],
        [1164, 1100],
        [36, 1100],
      ],
      col,
      0.3,
      4,
    );
  }
  function start(sky = "#c4d8d4", title = "", number = "01") {
    c.fillStyle = paper;
    c.fillRect(0, 0, 1200, 1200);
    const grad = c.createLinearGradient(0, 45, 0, 1000);
    grad.addColorStop(0, mix(sky, paper, 0.6));
    grad.addColorStop(0.65, paper);
    grad.addColorStop(1, mix(paper, "#bbaa85", 0.09));
    c.fillStyle = grad;
    c.fillRect(36, 36, 1128, 1080);
    c.save();
    rect(36, 36, 1128, 1080, null, ink, 0.75, 0.4);
    c.beginPath();
    c.rect(38, 38, 1124, 1076);
    c.clip();
    return { title, number };
  }
  function finish(title, subtitle, number = "01") {
    c.restore();
    // Fine pigment granulation and rag-paper fibres, applied over the entire plate.
    const pixels = c.getImageData(0, 0, 1200, 1200),
      d = pixels.data;
    for (let y = 0; y < 1200; y++)
      for (let x = 0; x < 1200; x++) {
        const i = (y * 1200 + x) * 4,
          n = (r() - 0.5) * 8 + (noise(x * 0.18, y * 0.18) - 0.5) * 4;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
    c.putImageData(pixels, 0, 0);
    for (let i = 0; i < 1100; i++) {
      const x = r(20, 1180),
        y = r(20, 1180);
      line(
        [
          [x, y],
          [x + r(1, 4), y + r(-0.4, 0.4)],
        ],
        "#7b6849",
        0.4,
        0.065,
      );
    }
    rect(43, 43, 1114, 1066, null, ink, 0.4, 0.28);
    c.fillStyle = ink;
    c.textAlign = "left";
    c.font = "12px Georgia";
    c.fillText(`FIELD NOTES  /  PLATE ${number}`, 49, 1143);
    c.font = "italic 24px Georgia";
    c.fillText(title, 49, 1175);
    c.textAlign = "right";
    c.font = "10px monospace";
    c.fillText(subtitle.toUpperCase(), 1153, 1164);
    c.textAlign = "left";
    // Small registration ticks make each piece feel like a page in the same atlas.
    for (const x of [36, 1164])
      for (const y of [36, 1116]) {
        line(
          [
            [x - 7, y],
            [x + 7, y],
          ],
          ink,
          0.6,
          0.5,
        );
        line(
          [
            [x, y - 7],
            [x, y + 7],
          ],
          ink,
          0.6,
          0.5,
        );
      }
  }
  return {
    c,
    r,
    noise,
    mix,
    ink,
    paper,
    line,
    poly,
    ellipse,
    rect,
    curve,
    wash,
    hatch,
    arch,
    masonry,
    cloud,
    mountain,
    tree,
    grass,
    rock,
    birds,
    ripples,
    ground,
    start,
    finish,
  };
}
