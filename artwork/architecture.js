// Reusable architectural vocabulary; compositions and layouts live in each scene.
export function column(a, x, y, h, w = 24, col = "#e8d6af", broken = false) {
  const { poly, line, ellipse, rect, mix, ink, r } = a;
  const shaft = [
    [x - w * 0.43, y],
    [x + w * 0.43, y],
    [x + w * 0.32, y - h],
    [x - w * 0.32, y - h],
  ];
  poly(shaft, col, ink, 1);
  poly(
    [
      [x, y],
      [x + w * 0.43, y],
      [x + w * 0.32, y - h],
      [x, y - h],
    ],
    mix(col, ink, 0.22),
    null,
    0,
    0.65,
  );
  for (let i = 0; i < 7; i++) {
    const u = (i + 0.6) / 7;
    line(
      [
        [x - w * 0.4 + w * 0.8 * u, y - 4],
        [x - w * 0.3 + w * 0.6 * u, y - h + 3],
      ],
      ink,
      0.65,
      0.45,
    );
  }
  for (let yy = y - h + 27; yy < y - 8; yy += r(24, 38))
    line(
      [
        [x - w * 0.35, yy],
        [x + w * 0.35, yy],
      ],
      ink,
      0.55,
      0.3,
    );
  rect(x - w * 0.65, y, w * 1.3, 7, col, ink, 0.8);
  ellipse(x, y, w * 0.56, 3, col, ink, 0.7);
  if (!broken) {
    rect(x - w * 0.58, y - h - 7, w * 1.16, 8, col, ink, 0.8);
    rect(x - w * 0.72, y - h - 13, w * 1.44, 5, col, ink, 0.8);
  } else
    line(
      [
        [x - w * 0.32, y - h],
        [x - w * 0.13, y - h + 5],
        [x + w * 0.1, y - h - 3],
        [x + w * 0.32, y - h],
      ],
      ink,
      1,
      0.8,
    );
}

export function house(
  a,
  x,
  y,
  w,
  h,
  depth = 35,
  wall = "#e2bc8c",
  roof = "#b06040",
  windows = 3,
) {
  const { poly, rect, line, ink, mix, r } = a;
  const side = [
    [x + w, y],
    [x + w + depth, y - depth * 0.58],
    [x + w + depth, y - h - depth * 0.58],
    [x + w, y - h],
  ];
  poly(side, mix(wall, ink, 0.2), ink, 0.9);
  rect(x, y - h, w, h, wall, ink, 0.9);
  const frontRoof = [
    [x - 8, y - h],
    [x + w + 7, y - h],
    [x + w * 0.55, y - h - 31],
    [x + w * 0.18, y - h - 31],
  ];
  poly(frontRoof, roof, ink, 0.9);
  poly(
    [
      [x + w + 7, y - h],
      [x + w + depth + 7, y - h - depth * 0.58],
      [x + w * 0.55 + depth, y - h - 31 - depth * 0.58],
      [x + w * 0.55, y - h - 31],
    ],
    mix(roof, ink, 0.17),
    ink,
    0.8,
  );
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    line(
      [
        [x - 8 + (w + 15) * t, y - h],
        [x + w * 0.18 + w * 0.37 * t, y - h - 31],
      ],
      ink,
      0.55,
      0.4,
    );
  }
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    line(
      [
        [x - 8 + (w * 0.18 + 8) * t, y - h - 31 * t],
        [x + w + 7 - (w * 0.45 + 7) * t, y - h - 31 * t],
      ],
      ink,
      0.6,
      0.45,
    );
  }
  const rows = Math.max(1, Math.floor(h / 40));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < windows; i++) {
      const xx = x + ((i + 0.5) * w) / windows - 5,
        yy = y - h + 15 + (j * (h - 15)) / rows;
      rect(xx, yy, 10, 16, "#455753", ink, 0.6);
      line(
        [
          [xx - 3, yy],
          [xx - 3, yy + 16],
        ],
        roof,
        2,
        0.6,
      );
      line(
        [
          [xx + 13, yy],
          [xx + 13, yy + 16],
        ],
        roof,
        2,
        0.6,
      );
      line(
        [
          [xx - 2, yy + 17],
          [xx + 12, yy + 17],
        ],
        ink,
        0.9,
        0.7,
      );
    }
  if (r() > 0.4)
    rect(x + w * 0.57, y - h - 37, 8, 17, mix(wall, ink, 0.1), ink, 0.7);
  for (let yy = y - 9; yy > y - h + 5; yy -= 15)
    line(
      [
        [x + w, yy],
        [x + w + depth, yy - depth * 0.58],
      ],
      ink,
      0.45,
      0.14,
    );
}

export function dome(a, x, y, w, h, col = "#c7ae81") {
  const { c, ink, line, mix } = a;
  c.save();
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.bezierCurveTo(
    x - w * 0.55,
    y - h * 0.55,
    x - w * 0.18,
    y - h * 0.83,
    x,
    y - h,
  );
  c.bezierCurveTo(
    x + w * 0.18,
    y - h * 0.83,
    x + w * 0.55,
    y - h * 0.55,
    x + w / 2,
    y,
  );
  c.closePath();
  const g = c.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, mix(col, "#f3e9d5", 0.25));
  g.addColorStop(0.5, col);
  g.addColorStop(1, mix(col, ink, 0.3));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 0.9;
  c.stroke();
  c.restore();
  for (let i = -2; i <= 2; i++)
    a.curve(
      [
        [x + i * w * 0.14, y],
        [x + i * w * 0.1, y - h * 0.6],
        [x + i * w * 0.06, y - h * 0.8],
        [x, y - h],
      ],
      ink,
      0.6,
      0.35,
    );
  line(
    [
      [x, y - h],
      [x, y - h - 15],
    ],
    ink,
    1,
    0.8,
  );
  a.ellipse(x, y - h - 8, 2, 2, ink);
}

export function boat(a, x, y, size = 50, col = "#704d35", angle = 0) {
  const { c, poly, line, ellipse, ink } = a;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  ellipse(0, 7, size * 0.6, size * 0.13, "#385d63", null, 0, 0.15);
  poly(
    [
      [-size * 0.6, 0],
      [-size * 0.3, -size * 0.12],
      [size * 0.45, -size * 0.1],
      [size * 0.65, 0],
      [size * 0.35, size * 0.13],
      [-size * 0.35, size * 0.1],
    ],
    col,
    ink,
    0.9,
  );
  line(
    [
      [-size * 0.4, 0],
      [size * 0.42, 0],
    ],
    "#eedbb9",
    1.2,
    0.8,
  );
  line(
    [
      [-size * 0.1, -size * 0.09],
      [size * 0.08, size * 0.09],
    ],
    ink,
    1,
    0.7,
  );
  c.restore();
}

export function steps(a, x, y, w, n = 5, depth = 5, col = "#d7c4a2") {
  for (let i = n - 1; i >= 0; i--) {
    a.rect(
      x - i * depth,
      y + i * depth,
      w + i * depth * 2,
      depth + 1,
      col,
      a.ink,
      0.7,
    );
    for (let xx = x - i * depth + 22; xx < x + w + i * depth; xx += 34)
      a.line(
        [
          [xx, y + i * depth],
          [xx, y + (i + 1) * depth],
        ],
        a.ink,
        0.5,
        0.2,
      );
  }
}

export function flowerTree(a, x, y, size = 150, petal = "#d7a7a4") {
  const { curve, ellipse, line, r, mix, ink } = a;
  curve(
    [
      [x, y],
      [x - 12, y - size * 0.3],
      [x + 15, y - size * 0.6],
      [x - 9, y - size],
    ],
    "#715447",
    size * 0.045,
    0.9,
  );
  for (let i = 0; i < 9; i++) {
    const yy = y - size * r(0.5, 0.95),
      xx = x + r(-size * 0.5, size * 0.5);
    curve(
      [
        [x, yy + size * 0.12],
        [x, yy],
        [xx, yy - size * 0.07],
        [xx, yy - size * 0.2],
      ],
      ink,
      r(1, 3),
      0.75,
    );
  }
  for (let i = 0; i < 280; i++) {
    const ang = r(Math.PI * 2),
      rad = Math.sqrt(r()) * size * 0.55,
      xx = x + Math.cos(ang) * rad,
      yy = y - size * 0.82 + Math.sin(ang) * rad * 0.55;
    ellipse(
      xx,
      yy,
      r(2, 7),
      r(2, 5),
      mix(petal, "#f6e4d6", r(0.1, 0.7)),
      null,
      0,
      r(0.35, 0.8),
    );
    if (i % 7 === 0) ellipse(xx, yy, 1, 1, ink, null, 0, 0.35);
  }
  for (let i = 0; i < 550; i++) {
    const angle = r(Math.PI * 2),
      rad = Math.sqrt(r()) * size * 0.52,
      xx = x + Math.cos(angle) * rad,
      yy = y - size * 0.82 + Math.sin(angle) * rad * 0.55;
    ellipse(
      xx,
      yy,
      r(1, 3),
      r(1, 2),
      mix(petal, "#f5e7d4", r(0.1, 0.65)),
      null,
      0,
      r(0.4, 0.8),
    );
    if (i % 8 === 0)
      line(
        [
          [xx, yy],
          [xx + 2, yy - 2],
        ],
        ink,
        0.4,
        0.35,
      );
  }
  for (let i = 0; i < 14; i++) {
    const yy = y - size * 0.12 - i * size * 0.045;
    line(
      [
        [x - 3, yy],
        [x + r(0, 4), yy - size * 0.03],
      ],
      ink,
      0.6,
      0.45,
    );
  }
}
