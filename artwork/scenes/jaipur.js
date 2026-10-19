import { dome, column, steps } from "../architecture.js";
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
    grass,
  } = a;
  a.start("#e0cbb0");
  ellipse(210, 208, 86, 86, "#dcaf73", null, 0, 0.32);
  a.cloud(830, 180, 410, 45, paper, 0.75);
  a.cloud(480, 249, 290, 24, paper, 0.7);
  wash(
    [
      [36, 806],
      [1164, 806],
      [1164, 1116],
      [36, 1116],
    ],
    "#d5bd8b",
    0.7,
    3,
  );
  for (let i = 0; i < 15; i++) {
    const yy = 850 + i * i * 1.3;
    line(
      [
        [36, yy],
        [1164, yy],
      ],
      "#9e8966",
      0.6,
      0.35,
    );
  }
  for (let i = -8; i < 13; i++)
    line(
      [
        [620 + i * 22, 820],
        [620 + i * 132, 1116],
      ],
      "#9e8966",
      0.7,
      0.3,
    );
  // Low side wings precede the central stepped façade.
  for (const x of [40, 958]) {
    rect(x, 570, 200, 310, "#c78e70", ink, 1);
    for (let i = 0; i < 5; i++) {
      arch(x + 15 + i * 37, 610, 21, 42, "#97765c");
      arch(x + 15 + i * 37, 709, 21, 42, "#97765c");
    }
    line(
      [
        [x - 6, 569],
        [x + 205, 569],
      ],
      "#e1bb91",
      7,
      0.9,
    );
  }
  function jharokha(x, y, w, h) {
    // Recessed arch, cream surround, scalloped hood and fine stone lattice.
    arch(x - 3, y - 3, w + 6, h + 6, "#e4bc91");
    arch(x, y, w, h, "#8c6652");
    c.save();
    c.beginPath();
    c.rect(x + 1, y + w * 0.5, w - 2, h - w * 0.5);
    c.clip();
    for (let k = -h; k < w + h; k += 7) {
      line(
        [
          [x + k, y],
          [x + k + h, y + h],
        ],
        "#d5ac83",
        0.65,
        0.9,
      );
      line(
        [
          [x + k, y],
          [x + k - h, y + h],
        ],
        "#d5ac83",
        0.65,
        0.9,
      );
    }
    c.restore();
    for (let k = 0; k < 7; k++) {
      const t = k / 6,
        xx = x + w * t,
        yy = y + w * 0.5 - Math.sin(Math.PI * t) * w * 0.5;
      ellipse(xx, yy, 2.8, 2.5, "#e6c298", ink, 0.35, 0.8);
    }
    rect(x - 5, y + h, w + 10, 4, "#d7ad84", ink, 0.5);
    for (let k = 0; k < 4; k++)
      line(
        [
          [x + (k * w) / 3, y + h + 4],
          [x + (k * w) / 3, y + h + 10],
        ],
        "#8b6852",
        1,
        0.8,
      );
  }
  for (let floor = 0; floor < 5; floor++) {
    const w = 758 - floor * 109,
      x = 220 + floor * 54.5,
      y = 867 - floor * 113,
      h = 106;
    const front = [
        [x, y],
        [x + w, y],
        [x + w, y - h],
        [x, y - h],
      ],
      side = [
        [x + w, y],
        [x + w + 48, y - 23],
        [x + w + 48, y - h - 23],
        [x + w, y - h],
      ];
    wash(front, mix("#c88468", "#e3b28c", floor * 0.08), 0.98, 0.7);
    poly(side, "#ae7057", ink, 0.8);
    hatch(side, ink, 6, 0.15, -0.5);
    line([...front, front[0]], ink, 0.9, 0.85);
    for (let k = 0; k < 3; k++)
      line(
        [
          [x - 5, y - h + k * 5],
          [x + w + 6, y - h + k * 5],
        ],
        k === 1 ? "#e7bf93" : "#98694e",
        1,
        0.85,
      );
    const n = Math.round(w / 55);
    for (let i = 0; i < n; i++) {
      const xx = x + ((i + 0.5) * w) / n;
      jharokha(xx - 14, y - h + 26, 28, 57);
      line(
        [
          [xx - 23, y - 8],
          [xx - 23, y - h + 13],
        ],
        "#deb58c",
        2,
        0.8,
      );
      ellipse(xx, y - h + 14, 3, 3, "#a47252", ink, 0.4);
      // Tiny projecting eaves cast a separate shadow over every window.
      poly(
        [
          [xx - 21, y - h + 23],
          [xx + 21, y - h + 23],
          [xx + 17, y - h + 17],
          [xx - 17, y - h + 17],
        ],
        "#e5b98a",
        ink,
        0.6,
      );
    }
    // Turned corner turrets and small domed pavilions on each terrace.
    for (const xx of [x + 5, x + w - 5]) {
      rect(xx - 16, y - h - 40, 32, 40, "#d89973", ink, 0.7);
      for (let k = 0; k < 3; k++)
        arch(xx - 12 + k * 9, y - h - 33, 6, 23, "#85674c");
      dome(a, xx, y - h - 41, 49, 31, "#be8e66");
      line(
        [
          [xx, y - h - 74],
          [xx, y - h - 86],
        ],
        ink,
        0.9,
        0.7,
      );
    }
  }
  // Central crest, medallions and a carved entrance beneath the façade.
  const topY = 867 - 4 * 113 - 106;
  dome(a, 599, topY - 12, 100, 62, "#c4946a");
  rect(572, topY - 11, 54, 29, "#d5a27b", ink, 0.7);
  jharokha(587, topY - 8, 24, 22);
  steps(a, 362, 878, 472, 4, 7, "#c8ac80");
  for (let i = 0; i < 7; i++) arch(395 + i * 55, 811, 38, 64, "#6d5a45");
  // Ornamental front screen, stone joints, and patterned parapets.
  for (let x = 230; x < 973; x += 18) {
    line(
      [
        [x, 874],
        [x, 892],
      ],
      "#a37653",
      1,
      0.7,
    );
    ellipse(x, 877, 3, 3, "#e3be92", ink, 0.4);
  }
  for (let y = 470; y < 870; y += 113)
    for (let x = 310; x < 900; x += 22) {
      line(
        [
          [x, y],
          [x + 5, y + 4],
        ],
        ink,
        0.55,
        0.25,
      );
    }
  // Street life is kept small against the enormous architecture.
  for (const [x, y, s] of [
    [251, 968, 1],
    [935, 1002, 1.1],
    [701, 1014, 0.85],
    [431, 961, 0.8],
    [862, 926, 0.7],
  ]) {
    ellipse(x, y - 21 * s, 4 * s, 5 * s, "#73553b", ink, 0.6);
    poly(
      [
        [x - 4 * s, y - 15 * s],
        [x + 5 * s, y - 15 * s],
        [x + 8 * s, y + 7 * s],
        [x - 7 * s, y + 7 * s],
      ],
      s > 1 ? "#9e654d" : "#718371",
      ink,
      0.6,
    );
    line(
      [
        [x - 2 * s, y + 7 * s],
        [x - 3 * s, y + 21 * s],
      ],
      ink,
      1,
      0.9,
    );
    line(
      [
        [x + 3 * s, y + 7 * s],
        [x + 4 * s, y + 21 * s],
      ],
      ink,
      1,
      0.9,
    );
    line(
      [
        [x - 5 * s, y + 20 * s],
        [x + 15 * s, y + 23 * s],
      ],
      ink,
      0.7,
      0.3,
    );
  }
  // Umbrella stalls, woven awnings and orange-green roadside trees.
  for (const [x, y, col] of [
    [111, 1021, "#aa7350"],
    [1053, 1009, "#7e8b66"],
    [1003, 928, "#b99a61"],
  ]) {
    line(
      [
        [x, y],
        [x, y - 58],
      ],
      ink,
      1.7,
      0.8,
    );
    poly(
      [
        [x - 39, y - 34],
        [x - 18, y - 56],
        [x + 5, y - 67],
        [x + 31, y - 51],
        [x + 43, y - 31],
      ],
      col,
      ink,
      0.9,
    );
    for (let i = 0; i < 7; i++)
      line(
        [
          [x + 3, y - 64],
          [x - 37 + i * 13, y - 33],
        ],
        ink,
        0.65,
        0.55,
      );
    rect(x - 30, y - 1, 60, 9, "#a17d55", ink, 0.7);
  }
  tree(114, 836, 175, "#7c8e68");
  tree(1081, 840, 182, "#6e8665");
  for (let i = 0; i < 18; i++)
    grass(r(55, 1140), r(1060, 1110), r(0.4, 0.7), "#938f68");
  a.birds(955, 223, 5, 130);
  a.finish(
    "A thousand small windows",
    "Jaipur · rose stone & afternoon gold",
    "06",
  );
}
