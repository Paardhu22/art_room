import { column } from "../architecture.js";
export function draw(a) {
  const {
    c,
    r,
    ink,
    paper,
    mix,
    poly,
    line,
    rect,
    ellipse,
    curve,
    wash,
    hatch,
    arch,
    tree,
  } = a;
  a.start("#c5d3c7");
  a.cloud(605, 197, 390, 36, paper, 0.85);
  a.mountain(
    [
      [300, 356],
      [420, 314],
      [530, 344],
      [635, 298],
      [766, 331],
      [895, 308],
    ],
    "#91a58a",
    0.25,
  );
  // The entire composition shares a single perspective centre at (600, 535).
  const floor = [
    [36, 1116],
    [330, 705],
    [870, 705],
    [1164, 1116],
  ];
  wash(floor, "#d7c8a8", 0.85, 1);
  const floorPoint = (u, v) => {
    const y = 705 + 411 * v,
      w = 540 + 588 * v;
    return [600 + (u - 0.5) * w, y];
  };
  for (let row = 0; row < 13; row++)
    for (let col = 0; col < 21; col++) {
      const u = col / 21,
        v0 = Math.pow(row / 13, 1.4),
        v1 = Math.pow((row + 1) / 13, 1.4);
      const points = [
        floorPoint(u, v0),
        floorPoint(u + 1 / 21, v0),
        floorPoint(u + 1 / 21, v1),
        floorPoint(u, v1),
      ];
      poly(
        points,
        (row + col) % 3 === 0 ? "#abac8f" : "#e3d5b5",
        ink,
        0.4,
        0.75,
      );
      if ((row + col) % 3 === 0) {
        const centre = floorPoint(u + 0.5 / 21, (v0 + v1) / 2),
          s = (v1 - v0) * 130;
        const star = [];
        for (let j = 0; j < 16; j++) {
          const rad = j % 2 ? s * 0.45 : s;
          star.push([
            centre[0] + Math.cos((j * Math.PI) / 8) * rad,
            centre[1] + Math.sin((j * Math.PI) / 8) * rad * 0.55,
          ]);
        }
        poly(star, "#597f7d", null, 0, 0.75);
      }
    }
  // Rear arcade and carved, tiled entrance.
  rect(317, 355, 566, 355, "#dec9a5", ink, 1);
  rect(308, 343, 584, 17, "#bb9970", ink, 1);
  for (let x = 321; x < 883; x += 22)
    poly(
      [
        [x, 343],
        [x + 11, 332],
        [x + 22, 343],
      ],
      "#b58e63",
      ink,
      0.6,
    );
  rect(321, 644, 557, 63, "#6d8d83", ink, 0.7);
  for (let x = 328; x < 880; x += 15)
    for (let y = 650; y < 706; y += 15)
      poly(
        [
          [x, y - 5],
          [x + 5, y],
          [x, y + 5],
          [x - 5, y],
        ],
        "#d5cba9",
        ink,
        0.35,
        0.9,
      );
  for (let i = 0; i < 7; i++) {
    const x = 335 + i * 78;
    if (i === 3) continue;
    arch(x, 460, 54, 183, "#79785b");
    arch(x + 5, 468, 44, 175, "#89937b");
    column(a, x - 2, 646, 149, 9, "#e2cfaa");
    column(a, x + 57, 646, 149, 9, "#e2cfaa");
    rect(x + 5, 422, 44, 18, "#c6ad85", ink, 0.5);
    for (let xx = x + 8; xx < x + 49; xx += 5)
      line(
        [
          [xx, 424],
          [xx, 437],
        ],
        ink,
        0.5,
        0.4,
      );
  }
  arch(537, 440, 126, 256, "#5f7565");
  arch(547, 454, 106, 242, "#8a9278");
  arch(564, 476, 72, 220, "#485e50");
  // Muqarnas-like bands are drawn as many small pendants around the main arch.
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 23; i++) {
      const t = i / 22,
        angle = Math.PI + Math.PI * t,
        x = 600 + Math.cos(angle) * (72 + j * 7),
        y = 503 + Math.sin(angle) * (73 + j * 7);
      poly(
        [
          [x - 3, y],
          [x, y + 8],
          [x + 3, y],
          [x, y - 4],
        ],
        "#e9d6b1",
        ink,
        0.45,
      );
    }
  for (let k = 0; k < 14; k++)
    line(
      [
        [333, 374 + k * 4],
        [868, 374 + k * 4],
      ],
      "#aa916d",
      0.45,
      0.3,
    );
  function side(right = false) {
    const point = (t, v) => {
      const x = 36 + 294 * t,
        y = 1116 - 411 * t,
        top = 133 + 222 * t;
      return [right ? 1200 - x : x, y + (top - y) * v];
    };
    const outer = [point(0, 0), point(1, 0), point(1, 1), point(0, 1)];
    wash(outer, right ? "#cdb58d" : "#bda886", 0.98, 0.8);
    line([...outer, outer[0]], ink, 0.9, 0.8);
    const lower = [
      point(0, 0.02),
      point(1, 0.02),
      point(1, 0.2),
      point(0, 0.2),
    ];
    poly(lower, "#78928a", ink, 0.8);
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 48; i++) {
        const t = (i + 0.5) / 48,
          v = 0.03 + j * 0.021,
          p = point(t, v),
          s = (1 - t) * 3.4 + 1;
        poly(
          [
            [p[0], p[1] - s],
            [p[0] + s, p[1]],
            [p[0], p[1] + s],
            [p[0] - s, p[1]],
          ],
          (i + j) % 2 ? "#d8caa6" : "#4d7979",
          null,
          0,
          0.85,
        );
      }
    for (let bay = 0; bay < 4; bay++) {
      const t0 = bay / 4 + 0.035,
        t1 = (bay + 1) / 4 - 0.035,
        mid = (t0 + t1) / 2;
      c.save();
      c.beginPath();
      c.moveTo(...point(t0, 0.2));
      c.lineTo(...point(t0, 0.65));
      c.bezierCurveTo(
        ...point(t0 - 0.015, 0.79),
        ...point(mid - 0.04, 0.89),
        ...point(mid, 0.9),
      );
      c.bezierCurveTo(
        ...point(mid + 0.04, 0.89),
        ...point(t1 + 0.015, 0.79),
        ...point(t1, 0.65),
      );
      c.lineTo(...point(t1, 0.2));
      c.closePath();
      c.fillStyle = right ? "#929078" : "#6c7661";
      c.fill();
      c.strokeStyle = ink;
      c.lineWidth = 0.9;
      c.stroke();
      c.restore();
      for (let j = 0; j < 23; j++) {
        const t = t0 + ((t1 - t0) * j) / 22,
          v = 0.65 + Math.sin((j / 22) * Math.PI) * 0.25,
          p = point(t, v);
        ellipse(p[0], p[1], r(1.5, 3), r(2, 4), "#e3ccaa", ink, 0.35);
      }
    }
    for (let j = 0; j <= 4; j++) {
      const t = j / 4,
        p0 = point(t, 0.2),
        p1 = point(t, 0.65),
        w = 16 - 11 * t;
      line([p0, p1], "#e7d5b6", w, 0.97);
      line(
        [
          [p0[0] + w * 0.3, p0[1]],
          [p1[0] + w * 0.3, p1[1]],
        ],
        "#b3a581",
        w * 0.22,
        0.9,
      );
      poly(
        [
          [p1[0] - w, p1[1] + 7],
          [p1[0] + w, p1[1] + 7],
          [p1[0] + w * 1.3, p1[1] - 6],
          [p1[0] - w * 1.3, p1[1] - 6],
        ],
        "#d2bd95",
        ink,
        0.6,
      );
      line(
        [
          [p0[0] - w, p0[1]],
          [p0[0] + w, p0[1]],
        ],
        ink,
        0.8,
        0.8,
      );
    }
    for (let j = 0; j < 5; j++)
      line(
        [point(0, 0.935 + j * 0.008), point(1, 0.935 + j * 0.008)],
        ink,
        0.65,
        0.55,
      );
    for (let i = 0; i < 63; i++) {
      const t = (i + 0.5) / 63,
        p = point(t, 0.97),
        s = 3.5 - t * 2;
      poly(
        [
          [p[0] - s, p[1]],
          [p[0], p[1] - s * 2],
          [p[0] + s, p[1]],
          [p[0], p[1] + s * 2],
        ],
        "#75836a",
        ink,
        0.4,
      );
    }
    // Terracotta roof strips above the gallery.
    poly(
      [
        point(0, 1),
        point(1, 1),
        [right ? 900 : 300, 326],
        [right ? 1164 : 36, 96],
      ],
      "#a97e56",
      ink,
      0.9,
    );
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      line(
        [
          point(t, 1),
          [right ? 1200 - (36 + 264 * t) : 36 + 264 * t, 96 + 230 * t],
        ],
        ink,
        0.65,
        0.55,
      );
    }
  }
  side(false);
  side(true);
  // A long pool, its cream rim, and reflected arches.
  const rim = [
      [440, 1058],
      [531, 713],
      [669, 713],
      [799, 1058],
    ],
    pool = [
      [460, 1037],
      [541, 724],
      [659, 724],
      [778, 1037],
    ];
  poly(rim, "#e9d9b9", ink, 1);
  wash(pool, "#4f8687", 0.85, 0.5);
  line([...pool, pool[0]], "#63775d", 0.8, 0.9);
  c.save();
  c.beginPath();
  pool.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.closePath();
  c.clip();
  for (let i = 0; i < 300; i++) {
    const x = r(450, 790),
      y = r(725, 1040);
    line(
      [
        [x, y],
        [x + r(2, 24), y],
      ],
      r() > 0.4 ? "#cad7bd" : "#315f66",
      r(0.5, 1.2),
      0.4,
    );
  }
  c.restore();
  ellipse(601, 774, 54, 13, "#d2c9a7", ink, 0.8);
  rect(595, 738, 12, 35, "#d3c7a5", ink, 0.7);
  ellipse(601, 738, 32, 8, "#e4d6b5", ink, 0.7);
  for (let i = 0; i < 7; i++)
    curve(
      [
        [601, 733],
        [580 + i * 7, 704],
        [571 + i * 9, 719],
        [563 + i * 12, 770],
      ],
      "#dce5d6",
      0.8,
      0.75,
    );
  // Orange trees in stone planters, with foliage drawn leaf by leaf.
  for (const [x, y, s] of [
    [347, 1025, 154],
    [901, 1025, 158],
    [444, 796, 81],
    [777, 796, 82],
  ]) {
    ellipse(x, y, (30 * s) / 150, (9 * s) / 150, "#b99f78", ink, 0.8);
    tree(x, y - 2, s, "#6e8960");
    for (let i = 0; i < 20; i++) {
      const ang = r(Math.PI * 2),
        rr = Math.sqrt(r()) * s * 0.31;
      ellipse(
        x + Math.cos(ang) * rr,
        y - s * 0.7 + Math.sin(ang) * rr * 0.7,
        s * 0.022,
        s * 0.025,
        "#cd9251",
        ink,
        0.35,
        0.85,
      );
    }
  }
  a.birds(644, 231, 4, 150);
  a.finish(
    "The courtyard holds the light",
    "Andalusia · tile, orange & still water",
    "10",
  );
}
