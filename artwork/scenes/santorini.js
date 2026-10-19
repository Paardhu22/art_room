import { dome, boat } from "../architecture.js";
export function draw(a) {
  const {
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
    rock,
  } = a;
  a.start("#c3d5d4");
  wash(
    [
      [36, 322],
      [1164, 322],
      [1164, 1116],
      [36, 1116],
    ],
    "#447e99",
    0.7,
    2,
  );
  a.mountain(
    [
      [36, 400],
      [160, 373],
      [310, 386],
      [470, 350],
      [603, 374],
      [766, 343],
      [1164, 387],
    ],
    "#7a9ca2",
    0.35,
  );
  a.ripples(40, 430, 1150, 1100, "#345e7a", 1500);
  for (let i = 0; i < 35; i++) {
    const y = r(430, 880),
      x = r(38, 620);
    line(
      [
        [x, y],
        [x + r(7, 60), y],
      ],
      "#e7dac0",
      r(0.5, 1.4),
      0.35,
    );
  }
  a.cloud(245, 198, 350, 40, paper, 0.7);
  a.cloud(790, 164, 300, 23, paper, 0.6);
  const land = [
    [1164, 409],
    [1030, 375],
    [943, 400],
    [835, 476],
    [745, 518],
    [647, 603],
    [573, 728],
    [444, 786],
    [335, 890],
    [272, 1032],
    [396, 1116],
    [1164, 1116],
  ];
  wash(land, "#d6bf93", 0.95, 3);
  hatch(land, "#9b8263", 12, 0.11, -0.3);
  for (let i = 0; i < 20; i++)
    rock(
      306 + i * 16,
      1012 + Math.sin(i * 0.2) * 50,
      r(23, 43),
      r(18, 35),
      "#b4a282",
    );
  const buildings = [];
  function home(x, y, w, h, depth = 30) {
    const wall = r() > 0.35 ? "#f3ead5" : "#e8ddc5";
    const front = [
        [x, y],
        [x + w, y],
        [x + w, y - h],
        [x, y - h],
      ],
      side = [
        [x + w, y],
        [x + w + depth, y - depth * 0.58],
        [x + w + depth, y - h - depth * 0.58],
        [x + w, y - h],
      ];
    wash(side, "#b9cac2", 0.95, 0.6);
    line([...side, side[0]], ink, 0.75, 0.75);
    hatch(side, ink, 7, 0.1, -0.6);
    poly(front, wall, ink, 0.85);
    poly(
      [
        [x - 3, y - h],
        [x + w + 3, y - h],
        [x + w + depth + 3, y - h - depth * 0.58],
        [x + depth, y - h - depth * 0.58],
      ],
      "#faf0d9",
      ink,
      0.8,
    );
    line(
      [
        [x - 4, y - h - 3],
        [x + w + 3, y - h - 3],
        [x + w + depth + 3, y - h - depth * 0.58 - 3],
      ],
      "#f9f0df",
      4,
      0.9,
    );
    arch(x + w * 0.42, y - h * 0.46, w * 0.2, h * 0.46, "#3b748d");
    for (let k = 0; k < 2; k++) {
      const xx = x + 13 + k * (w - 35);
      rect(xx, y - h + 15, 13, 18, "#4e8b9b", ink, 0.6);
      line(
        [
          [xx - 2, y - h + 34],
          [xx + 15, y - h + 34],
        ],
        "#a6c8c5",
        2,
        0.8,
      );
    }
    if (w > 75) {
      for (let k = 0; k < 7; k++)
        line(
          [
            [x + 8 + (k * (w - 16)) / 6, y - h - 2],
            [x + 8 + (k * (w - 16)) / 6, y - h - 15],
          ],
          "#8b8972",
          0.65,
          0.7,
        );
      line(
        [
          [x + 6, y - h - 16],
          [x + w - 6, y - h - 16],
        ],
        "#8b8972",
        1,
        0.8,
      );
    }
    for (let i = 0; i < 8; i++)
      line(
        [
          [r(x + 4, x + w - 4), y - r(4, 11)],
          [r(x + 4, x + w - 4), y - r(4, 11)],
        ],
        ink,
        0.4,
        0.12,
      );
    if (r() > 0.6) {
      ellipse(x + w * 0.2, y - h - 9, 8, 4, "#c78460", ink, 0.6);
      tree(x + w * 0.2, y - h - 11, 25, "#7e936e");
    }
  }
  const rows = [
    [
      [974, 451, 69, 62],
      [1054, 444, 82, 65],
      [895, 484, 68, 64],
    ],
    [
      [834, 557, 75, 79],
      [927, 549, 90, 81],
      [1025, 542, 91, 72],
    ],
    [
      [711, 649, 85, 83],
      [807, 642, 86, 79],
      [915, 645, 75, 85],
      [1014, 637, 93, 92],
    ],
    [
      [608, 751, 94, 87],
      [719, 744, 81, 91],
      [819, 741, 82, 94],
      [1073, 743, 68, 83],
    ],
    [
      [508, 856, 95, 100],
      [625, 855, 76, 87],
      [730, 849, 83, 93],
      [838, 850, 91, 107],
      [1037, 854, 93, 98],
    ],
    [
      [407, 957, 91, 94],
      [526, 969, 83, 105],
      [638, 977, 100, 104],
      [770, 974, 100, 90],
      [931, 987, 90, 105],
      [1056, 982, 72, 91],
    ],
    [
      [384, 1091, 112, 96],
      [536, 1105, 100, 96],
      [690, 1105, 96, 104],
      [840, 1098, 103, 87],
      [1005, 1107, 117, 109],
    ],
  ];
  // Small church on the upper ridge.
  rect(1017, 314, 75, 118, "#eee6d1", ink, 0.9);
  dome(a, 1054, 313, 83, 60, "#397c9d");
  line(
    [
      [1054, 248],
      [1054, 229],
    ],
    ink,
    1,
    0.9,
  );
  line(
    [
      [1047, 235],
      [1061, 235],
    ],
    ink,
    1,
    0.9,
  );
  arch(1041, 376, 25, 56, "#3f7188");
  for (const row of rows) for (const b of row) home(...b);
  // Main blue-domed chapel, placed in front of the mid-terrace buildings.
  const cx = 949,
    cy = 810;
  rect(cx - 71, cy - 151, 142, 151, "#f8ecd5", ink, 1);
  poly(
    [
      [cx + 71, cy],
      [cx + 111, cy - 22],
      [cx + 111, cy - 166],
      [cx + 71, cy - 151],
    ],
    "#b7cac5",
    ink,
    0.8,
  );
  dome(a, cx, cy - 153, 157, 108, "#3e7d9d");
  line(
    [
      [cx, cy - 267],
      [cx, cy - 291],
    ],
    ink,
    1.7,
    0.9,
  );
  line(
    [
      [cx - 10, cy - 283],
      [cx + 10, cy - 283],
    ],
    ink,
    1.7,
    0.9,
  );
  arch(cx - 20, cy - 90, 40, 90, "#396981");
  for (const dx of [-46, 37]) arch(cx + dx, cy - 128, 14, 25, "#537c85");
  // A separate open bell wall and a white stone stairway descending toward the sea.
  rect(1089, 535, 32, 141, "#f0e6d0", ink, 0.8);
  arch(1094, 545, 22, 36, "#777d68");
  poly(
    [
      [1083, 536],
      [1105, 511],
      [1128, 536],
    ],
    "#f6e9cf",
    ink,
    0.8,
  );
  ellipse(1105, 565, 6, 7, "#9d8660", ink, 0.6);
  const stairs = [
    [439, 984],
    [484, 932],
    [575, 912],
    [601, 867],
    [694, 848],
    [704, 797],
    [795, 775],
    [806, 721],
  ];
  for (let j = 0; j < stairs.length - 1; j++) {
    const p = stairs[j],
      q = stairs[j + 1],
      dx = q[0] - p[0],
      dy = q[1] - p[1];
    poly(
      [
        [p[0] - 9, p[1] + 7],
        [p[0] + 16, p[1] + 17],
        [q[0] + 16, q[1] + 17],
        [q[0] - 9, q[1] + 7],
      ],
      "#f5e9d0",
      ink,
      0.65,
    );
    for (let k = 0; k < 9; k++) {
      const t = k / 9;
      line(
        [
          [p[0] + dx * t - 8, p[1] + dy * t + 7],
          [p[0] + dx * t + 16, p[1] + dy * t + 17],
        ],
        "#a49a80",
        0.75,
        0.7,
      );
    }
  }
  for (const [x, y, w] of [
    [713, 706, 81],
    [530, 924, 77],
    [864, 930, 90],
  ])
    for (let i = 0; i < 90; i++) {
      const xx = x + r(-5, w),
        yy = y + r(-13, 12);
      ellipse(
        xx,
        yy,
        r(1, 4),
        r(1, 3),
        r() > 0.5 ? "#bd7786" : "#d1979d",
        null,
        0,
        0.75,
      );
    }
  for (const [x, y] of [
    [144, 748],
    [232, 581],
    [114, 978],
  ]) {
    boat(a, x, y, 38, "#e9e3ce", 0.1);
    poly(
      [
        [x, y - 4],
        [x, y - 64],
        [x - 27, y - 6],
      ],
      "#f4e9ce",
      ink,
      0.65,
    );
    line(
      [
        [x, y],
        [x, y - 68],
      ],
      ink,
      0.8,
      0.8,
    );
  }
  a.birds(465, 260, 5, 160);
  a.finish(
    "Blue hour, white walls",
    "Santorini · limestone & Prussian blue",
    "05",
  );
}
