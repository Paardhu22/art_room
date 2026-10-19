import { steps, flowerTree, boat } from "../architecture.js";
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
    cloud,
    mountain,
    tree,
    grass,
    rock,
    ripples,
  } = a;
  a.start("#c4d8d0");
  ellipse(1000, 180, 64, 64, "#dfad88", null, 0, 0.42);
  mountain(
    [
      [35, 465],
      [150, 320],
      [250, 370],
      [405, 195],
      [540, 330],
      [690, 245],
      [850, 400],
      [1040, 290],
      [1165, 410],
    ],
    "#91aaa1",
    0.32,
  );
  mountain(
    [
      [38, 570],
      [170, 438],
      [280, 510],
      [455, 365],
      [630, 510],
      [770, 410],
      [980, 493],
      [1165, 425],
    ],
    "#6e9290",
    0.32,
  );
  for (let i = 0; i < 13; i++)
    cloud(r(70, 1150), r(345, 500), r(150, 360), r(12, 30), paper, 0.8);
  wash(
    [
      [36, 690],
      [300, 650],
      [620, 695],
      [950, 653],
      [1164, 690],
      [1164, 1115],
      [36, 1115],
    ],
    "#54888a",
    0.38,
    3,
  );
  ripples(40, 740, 1160, 1090, "#547b7c", 800);
  for (let i = 0; i < 30; i++) {
    const x = r(600, 1010),
      y = r(880, 1080);
    line(
      [
        [x - 17, y],
        [x + 26, y],
      ],
      "#ba7866",
      1,
      0.22,
    );
  }
  wash(
    [
      [36, 710],
      [200, 670],
      [410, 730],
      [550, 723],
      [660, 807],
      [1020, 835],
      [1165, 813],
      [1165, 934],
      [920, 925],
      [630, 902],
      [330, 834],
      [36, 815],
    ],
    "#b4b38a",
    0.85,
    3,
  );
  for (let i = 0; i < 19; i++)
    tree(980 + i * 14, 810 + r(-45, 35), r(75, 170), "#667c60", "cypress");
  // Five storeys, each with a separate timber frame and upturned tiled eave.
  steps(a, 555, 833, 335, 6, 7, "#c5b99a");
  for (let tier = 4; tier >= 0; tier--) {
    // Back-to-front silhouette is completed from the highest floor down.
    const level = 4 - tier,
      cy = 827 - level * 116,
      w = 312 - level * 35,
      x = 713 - w / 2,
      top = cy - 83;
    poly(
      [
        [x + w, cy],
        [x + w + 48, cy - 24],
        [x + w + 48, top - 23],
        [x + w, top],
      ],
      "#9d6450",
      ink,
      0.9,
    );
    rect(x, top, w, 83, "#b76d50", ink, 1);
    a.hatch(
      [
        [x + w, cy],
        [x + w + 48, cy - 24],
        [x + w + 48, top - 23],
        [x + w, top],
      ],
      ink,
      4,
      0.21,
      -0.3,
    );
    rect(x + 8, top + 5, w - 16, 57, "#e0bc91", ink, 0.7);
    for (let xx = x + 15; xx < x + w; xx += 24) {
      rect(xx, top + 7, 3, 62, "#9d4d37", null);
      line(
        [
          [xx + 7, top + 18],
          [xx + 7, top + 49],
        ],
        ink,
        0.8,
        0.6,
      );
      line(
        [
          [xx + 12, top + 18],
          [xx + 12, top + 49],
        ],
        ink,
        0.8,
        0.6,
      );
    }
    rect(x - 6, cy - 18, w + 12, 5, "#754d3a", ink, 0.8);
    for (let xx = x; xx < x + w; xx += 13)
      line(
        [
          [xx, cy - 19],
          [xx, cy - 34],
        ],
        "#713f2d",
        1,
        0.8,
      );
    line(
      [
        [x - 8, cy - 33],
        [x + w + 8, cy - 33],
      ],
      "#83513c",
      1.5,
      0.9,
    );
    const roof = [
      [x - 45, top - 4],
      [x - 12, top - 14],
      [x + w * 0.48, top - 61],
      [x + w + 34, top - 30],
      [x + w + 89, top - 44],
      [x + w + 64, top - 13],
      [x + w * 0.6, top + 2],
      [x + 7, top + 11],
    ];
    wash(roof, "#607c79", 0.95, 1);
    line([...roof, roof[0]], ink, 1.2, 0.95);
    for (let j = 0; j < 26; j++) {
      const t = j / 25;
      line(
        [
          [x - 36 + (w + 94) * t, top - 1 - 17 * t],
          [x + w * 0.48 + (t - 0.5) * 75, top - 59 + 12 * t],
        ],
        "#344b46",
        0.7,
        0.65,
      );
    }
    for (let k = 0; k < 4; k++)
      line(
        [
          [x - 30, top - 2 - k * 4],
          [x + w * 0.55, top - 8 - k * 8],
          [x + w + 72, top - 30 - k * 3],
        ],
        ink,
        0.6,
        0.6,
      );
    for (let xx = x + 9; xx < x + w; xx += 18) {
      curve(
        [
          [xx - 5, top + 17],
          [xx - 2, top + 23],
          [xx + 5, top + 24],
          [xx + 8, top + 17],
        ],
        ink,
        0.8,
        0.8,
      );
      line(
        [
          [xx, cy - 22],
          [xx + 7, cy - 29],
          [xx + 13, cy - 22],
        ],
        "#6e4b35",
        0.7,
        0.75,
      );
      line(
        [
          [xx, top + 10],
          [xx, top + 17],
        ],
        ink,
        1,
        0.7,
      );
    }
    for (let k = 0; k < 10; k++) {
      const yy = top + 8 + k * 6;
      line(
        [
          [x + w + 3, yy],
          [x + w + 45, yy - 22],
        ],
        ink,
        0.5,
        0.32,
      );
    }
    rect(x - 2, top + 12, w + 26, 5, "#b55e3b", ink, 0.7);
    if (level === 4) {
      line(
        [
          [713, top - 62],
          [713, top - 145],
        ],
        ink,
        2,
        0.9,
      );
      for (let yy = top - 135; yy < top - 64; yy += 10)
        ellipse(713, yy, 5, 2, "#8f7250", ink, 0.6);
    }
  }
  // Lantern path, rock-edged shoreline, and a small arched timber bridge.
  wash(
    [
      [120, 715],
      [250, 714],
      [470, 846],
      [527, 853],
      [361, 761],
      [241, 690],
    ],
    "#d4c4a1",
    0.9,
    1,
  );
  for (let i = 0; i < 24; i++)
    rock(
      120 + i * 40,
      867 + Math.sin(i * 0.5) * 37,
      r(17, 32),
      r(10, 20),
      "#aaa98d",
    );
  const bridge = [
    [222, 880],
    [260, 851],
    [305, 840],
    [350, 842],
    [397, 861],
    [432, 889],
  ];
  curve(
    [
      [222, 880],
      [285, 821],
      [353, 821],
      [432, 889],
    ],
    "#87573d",
    14,
    0.95,
  );
  curve(
    [
      [222, 866],
      [285, 807],
      [353, 807],
      [432, 875],
    ],
    ink,
    2,
    0.9,
  );
  curve(
    [
      [222, 845],
      [285, 786],
      [353, 786],
      [432, 854],
    ],
    "#8c5941",
    3,
    0.9,
  );
  for (let i = 0; i <= 13; i++) {
    const t = i / 13,
      x = 222 + 210 * t,
      y = 880 - 47 * Math.sin(t * Math.PI);
    line(
      [
        [x, y - 12],
        [x, y - 35],
      ],
      "#754735",
      2,
      0.9,
    );
  }
  for (let i = 0; i < 8; i++) {
    const x = 455 + i * 45,
      y = 806 - i * 10;
    rect(x - 2, y - 17, 4, 20, "#b5ad8d", ink, 0.6);
    rect(x - 7, y - 30, 14, 12, "#e2cfac", ink, 0.6);
    poly(
      [
        [x - 10, y - 31],
        [x, y - 40],
        [x + 10, y - 31],
      ],
      "#74816c",
      ink,
      0.7,
    );
  }
  flowerTree(a, 215, 789, 246, "#d1a1a1");
  flowerTree(a, 1030, 936, 230, "#d8a297");
  for (let i = 0; i < 80; i++) {
    const x = r(45, 1150),
      y = r(935, 1100);
    if (r() > 0.6) ellipse(x, y, r(1, 3), 1, "#d8ad9a", null, 0, 0.65);
  }
  for (let i = 0; i < 18; i++) grass(r(70, 1100), r(820, 910), r(0.5, 1.1));
  boat(a, 520, 1015, 61, "#83614b", -0.12);
  a.birds(220, 220, 5, 180);
  a.finish(
    "The pagoda after the rain",
    "Japan · vermilion, blossom & jade",
    "01",
  );
}
