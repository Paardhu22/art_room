import { column, steps } from "../architecture.js";
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
    masonry,
    arch,
    rock,
    grass,
  } = a;
  a.start("#d9c5aa");
  const backdrop = [
    [300, 58],
    [550, 70],
    [640, 150],
    [790, 102],
    [1045, 171],
    [1090, 1030],
    [240, 1060],
  ];
  wash(backdrop, "#d0a581", 0.75, 4);
  for (let i = 0; i < 130; i++) {
    const yy = r(90, 958),
      xx = r(340, 1010),
      len = r(30, 230);
    curve(
      [
        [xx, yy],
        [xx + len * 0.25, yy - 12],
        [xx + len * 0.65, yy + 8],
        [xx + len, yy - 1],
      ],
      "#a9795b",
      r(0.5, 1.4),
      0.25,
    );
  }
  // The cut-rock monument: a restrained architectural fantasy, not a traced image.
  const fx = 433,
    fy = 885,
    fw = 439;
  wash(
    [
      [fx - 37, fy + 29],
      [fx - 27, 355],
      [fx + 110, 297],
      [fx + 242, 302],
      [fx + fw + 31, 375],
      [fx + fw + 32, fy + 29],
    ],
    "#b7785d",
    0.85,
    2,
  );
  rect(fx + 13, fy - 245, fw - 26, 244, "#91664f", ink, 0.8);
  rect(fx + 39, fy - 224, fw - 77, 224, "#9f7156", ink, 0.8);
  arch(fx + 173, fy - 183, 94, 183, "#4d4235");
  for (let i = 0; i < 6; i++)
    column(a, fx + 28 + i * 77, fy, 210, 26, "#d2a17d");
  steps(a, fx - 10, fy + 2, fw + 18, 5, 6, "#cba17d");
  rect(fx - 14, fy - 242, fw + 28, 23, "#d3a680", ink, 0.9);
  rect(fx - 23, fy - 250, fw + 46, 7, "#ae7b59", ink, 0.8);
  for (let xx = fx - 5; xx < fx + fw; xx += 14) {
    rect(xx, fy - 236, 5, 14, "#9b6e53", null);
    line(
      [
        [xx + 7, fy - 230],
        [xx + 10, fy - 230],
      ],
      ink,
      0.6,
      0.6,
    );
  }
  // Upper niches flank a circular tholos, with layered broken pediments.
  rect(fx + 8, fy - 433, fw - 16, 182, "#ad7c5e", ink, 0.7);
  for (const xx of [fx + 32, fx + 99, fx + fw - 99, fx + fw - 32])
    column(a, xx, fy - 256, 144, 21, "#d5aa83");
  for (const xx of [fx + 44, fx + fw - 119]) {
    poly(
      [
        [xx - 21, fy - 408],
        [xx + 36, fy - 459],
        [xx + 91, fy - 408],
      ],
      "#c99c76",
      ink,
      0.8,
    );
    poly(
      [
        [xx - 8, fy - 411],
        [xx + 35, fy - 447],
        [xx + 79, fy - 411],
      ],
      "#946c50",
      ink,
      0.6,
    );
    arch(xx + 18, fy - 379, 38, 89, "#755c44");
    ellipse(xx + 38, fy - 346, 6, 8, "#b58c66", ink, 0.6);
    poly(
      [
        [xx + 38, fy - 338],
        [xx + 28, fy - 312],
        [xx + 47, fy - 312],
      ],
      "#bc9772",
      ink,
      0.6,
    );
  }
  const cx = fx + fw / 2;
  ellipse(cx, fy - 423, 65, 18, "#ae7f5d", ink, 0.8);
  for (let i = 0; i < 5; i++) {
    const xx = cx - 53 + i * 26.5;
    column(a, xx, fy - 269, 135, 16, "#ddaf85");
  }
  ellipse(cx, fy - 415, 72, 14, "#d3a47a", ink, 0.8);
  ellipse(cx, fy - 431, 76, 14, "#bb895e", ink, 0.9);
  poly(
    [
      [cx - 71, fy - 433],
      [cx, fy - 478],
      [cx + 71, fy - 433],
    ],
    "#d7ac80",
    ink,
    0.8,
  );
  ellipse(cx, fy - 481, 14, 6, "#9f7757", ink, 0.8);
  rect(cx - 6, fy - 503, 12, 23, "#cfab80", ink, 0.8);
  ellipse(cx, fy - 505, 12, 10, "#d6b185", ink, 0.8);
  for (let i = 0; i < 65; i++) {
    const xx = r(fx, fx + fw),
      yy = r(fy - 460, fy);
    line(
      [
        [xx, yy],
        [xx + r(3, 12), yy + r(-2, 2)],
      ],
      "#6f503e",
      0.5,
      0.18,
    );
  }
  // Sand and a curling trail lead from the foreground into the monument.
  wash(
    [
      [36, 938],
      [420, 900],
      [940, 876],
      [1164, 996],
      [1164, 1116],
      [36, 1116],
    ],
    "#d3b28a",
    0.85,
    4,
  );
  wash(
    [
      [434, 1116],
      [560, 1028],
      [658, 970],
      [704, 915],
      [789, 918],
      [755, 989],
      [701, 1055],
      [669, 1116],
    ],
    "#e9cfa1",
    0.8,
    2,
  );
  const left = [
    [36, 36],
    [342, 36],
    [376, 159],
    [326, 269],
    [407, 352],
    [355, 446],
    [421, 535],
    [390, 639],
    [446, 741],
    [385, 842],
    [435, 953],
    [36, 1088],
  ];
  const right = [
    [1033, 36],
    [1164, 36],
    [1164, 1116],
    [944, 1029],
    [909, 910],
    [957, 812],
    [917, 716],
    [967, 606],
    [914, 496],
    [976, 365],
    [928, 273],
    [981, 166],
  ];
  wash(left, "#b37b5a", 0.95, 5);
  wash(right, "#ba8060", 0.98, 4);
  hatch(left, "#754d3e", 13, 0.16, -0.12);
  hatch(right, "#76513d", 10, 0.15, 0.16);
  // Long sedimentary strata follow canyon walls rather than a generic texture.
  for (let i = 0; i < 115; i++) {
    const y = 54 + i * 9.2;
    curve(
      [
        [36, y],
        [105, y - 21],
        [242, y + 29],
        [381 + r(-32, 22), y + 10],
      ],
      i % 5 ? "#7e5741" : "#e2b68b",
      r(0.5, 1.7),
      i % 5 ? 0.38 : 0.65,
    );
    curve(
      [
        [955 + r(-20, 15), y],
        [1006, y - 13],
        [1110, y + 28],
        [1170, y + 11],
      ],
      i % 5 ? "#845841" : "#e7b48a",
      r(0.5, 1.5),
      i % 5 ? 0.38 : 0.65,
    );
  }
  for (let i = 0; i < 20; i++) {
    const x = r(75, 330);
    curve(
      [
        [x, 80],
        [x + 30, 340],
        [x - 20, 680],
        [x + 35, 1000],
      ],
      "#694c3a",
      r(0.6, 1.4),
      0.25,
    );
  }
  for (let i = 0; i < 38; i++)
    rock(r(70, 1140), r(992, 1105), r(9, 34), r(5, 16), "#b69371");
  for (const [x, y] of [
    [585, 994],
    [611, 1004],
    [670, 938],
  ]) {
    ellipse(x, y - 10, 3, 4, ink);
    line(
      [
        [x, y - 5],
        [x, y + 10],
      ],
      ink,
      2,
      0.85,
    );
    line(
      [
        [x, y + 10],
        [x - 4, y + 20],
      ],
      ink,
      1,
      0.85,
    );
    line(
      [
        [x, y + 10],
        [x + 5, y + 18],
      ],
      ink,
      1,
      0.85,
    );
  }
  const camel = (x, y, s) => {
    ellipse(x, y - 10 * s, 20 * s, 7 * s, "#8b6547", ink, 0.7);
    curve(
      [
        [x - 10 * s, y - 13 * s],
        [x - 4 * s, y - 30 * s],
        [x + 4 * s, y - 30 * s],
        [x + 10 * s, y - 13 * s],
      ],
      "#8b6547",
      7 * s,
      0.9,
    );
    line(
      [
        [x + 17 * s, y - 11 * s],
        [x + 25 * s, y - 28 * s],
        [x + 34 * s, y - 26 * s],
      ],
      ink,
      3 * s,
      0.8,
    );
    for (const k of [-13, -7, 8, 13])
      line(
        [
          [x + k * s, y - 4 * s],
          [x + (k - 3) * s, y + 18 * s],
        ],
        ink,
        1.4 * s,
        0.9,
      );
  };
  camel(732, 1027, 0.8);
  camel(795, 1001, 0.55);
  for (let i = 0; i < 15; i++)
    grass(r(50, 1140), r(1050, 1114), r(0.4, 0.8), "#8b8a64");
  a.finish(
    "A city in the rose stone",
    "Petra · sandstone & the long passage",
    "04",
  );
}
