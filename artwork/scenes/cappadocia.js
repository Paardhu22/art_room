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
    grass,
    rock,
  } = a;
  a.start("#d9beb0");
  ellipse(930, 280, 86, 86, "#dbae83", null, 0, 0.37);
  for (let i = 0; i < 10; i++)
    a.cloud(r(65, 1140), r(150, 390), r(100, 310), r(9, 22), paper, 0.7);
  a.mountain(
    [
      [36, 527],
      [179, 469],
      [309, 493],
      [443, 435],
      [626, 480],
      [760, 426],
      [936, 485],
      [1080, 428],
      [1164, 475],
    ],
    "#a6a49a",
    0.45,
  );
  const bands = [
    [
      [36, 631],
      [153, 551],
      [294, 589],
      [426, 511],
      [543, 555],
      [681, 516],
      [843, 557],
      [971, 503],
      [1164, 550],
    ],
    [
      [36, 775],
      [140, 647],
      [292, 683],
      [452, 599],
      [601, 653],
      [766, 590],
      [929, 688],
      [1055, 611],
      [1164, 699],
    ],
    [
      [36, 913],
      [190, 802],
      [333, 862],
      [489, 764],
      [674, 851],
      [852, 745],
      [1004, 851],
      [1164, 797],
    ],
  ];
  for (let i = 0; i < bands.length; i++) {
    const pts = [...bands[i], [1164, 1116], [36, 1116]];
    wash(pts, ["#c9b298", "#c49e7f", "#d2b28a"][i], 0.9, 2);
    line(bands[i], ink, 0.8, 0.6);
    c.save();
    c.beginPath();
    pts.forEach((p, k) => (k ? c.lineTo(...p) : c.moveTo(...p)));
    c.closePath();
    c.clip();
    for (let j = 0; j < 62; j++) {
      const x = 36 + j * 19,
        yy = 580 + i * 130 + r(-60, 70);
      curve(
        [
          [x, yy],
          [x - 40, yy + 56],
          [x + 36, yy + 140],
          [x - 19, yy + 257],
        ],
        i === 1 ? "#8b7760" : "#a3896c",
        r(0.5, 1.2),
        0.32,
      );
    }
    c.restore();
  }
  function chimney(x, y, h, w) {
    const pts = [
      [x - w * 0.6, y],
      [x - w * 0.42, y - h * 0.24],
      [x - w * 0.33, y - h * 0.6],
      [x - w * 0.15, y - h * 0.89],
      [x + w * 0.12, y - h * 0.9],
      [x + w * 0.29, y - h * 0.57],
      [x + w * 0.39, y - h * 0.22],
      [x + w * 0.62, y],
    ];
    wash(pts, "#dfc39e", 0.98, 1);
    line([...pts, pts[0]], ink, 0.9, 0.85);
    const shade = [
      [x + w * 0.03, y - h * 0.87],
      [x + w * 0.3, y - h * 0.57],
      [x + w * 0.39, y - h * 0.22],
      [x + w * 0.62, y],
      [x + w * 0.1, y],
      [x - w * 0.05, y - h * 0.3],
    ];
    wash(shade, "#aa8869", 0.6, 0.7);
    hatch(shade, ink, 5, 0.17, -0.25);
    const cap = [
      [x - w * 0.33, y - h * 0.86],
      [x - w * 0.15, y - h * 1.03],
      [x + w * 0.1, y - h * 1.09],
      [x + w * 0.33, y - h * 0.87],
    ];
    poly(cap, "#a78c73", ink, 0.8);
    for (let k = 0; k < 6; k++)
      curve(
        [
          [x - w * 0.28 + k * w * 0.1, y - h * 0.8],
          [x - w * 0.4 + k * w * 0.15, y - h * 0.55],
          [x - w * 0.3 + k * w * 0.14, y - h * 0.2],
          [x - w * 0.5 + k * w * 0.18, y - 5],
        ],
        ink,
        0.55,
        0.38,
      );
    for (let k = 0; k < 7; k++) {
      const yy = y - h * 0.18 - k * h * 0.088;
      line(
        [
          [x - w * 0.3, yy],
          [x + w * 0.3, yy - r(1, 5)],
        ],
        "#af9170",
        0.7,
        0.45,
      );
    }
    const windowCount = h > 180 ? 3 : 2;
    for (let j = 0; j < windowCount; j++)
      arch(x - 6 + (j % 2) * 13, y - h * (0.26 + j * 0.2), 11, 15, "#78624b");
  }
  // Far-to-near ordering gives each valley its own overlapping cluster of spires.
  const spires = [];
  for (let i = 0; i < 34; i++) {
    const y = r(641, 1102),
      sc = (y - 480) / 420;
    spires.push({ x: r(65, 1135), y, h: r(105, 203) * sc, w: r(36, 72) * sc });
  }
  spires.sort((x, y) => x.y - y.y);
  for (const s of spires) chimney(s.x, s.y, s.h, s.w);
  wash(
    [
      [551, 1116],
      [560, 1055],
      [625, 999],
      [599, 933],
      [660, 880],
      [652, 819],
      [716, 778],
      [761, 751],
      [781, 756],
      [729, 805],
      [716, 858],
      [664, 911],
      [662, 969],
      [702, 1019],
      [653, 1077],
      [636, 1116],
    ],
    "#e9cfa9",
    0.8,
    1,
  );
  for (let i = 0; i < 80; i++) {
    const x = r(50, 1150),
      y = r(952, 1110);
    if (r() > 0.5) rock(x, y, r(6, 19), r(3, 8), "#bca17e");
    else grass(x, y, r(0.2, 0.6), "#9c9b70");
  }
  // Pear-shaped balloon envelopes with individually painted gores and rigging.
  function balloon(x, y, w, h, col) {
    c.save();
    c.beginPath();
    c.moveTo(x, y + h * 0.56);
    c.bezierCurveTo(
      x - w * 0.23,
      y + h * 0.34,
      x - w * 0.55,
      y + h * 0.04,
      x - w * 0.5,
      y - h * 0.25,
    );
    c.bezierCurveTo(
      x - w * 0.44,
      y - h * 0.81,
      x + w * 0.44,
      y - h * 0.81,
      x + w * 0.5,
      y - h * 0.25,
    );
    c.bezierCurveTo(
      x + w * 0.55,
      y + h * 0.04,
      x + w * 0.23,
      y + h * 0.34,
      x,
      y + h * 0.56,
    );
    c.closePath();
    c.fillStyle = "#e4caa3";
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = 0.8;
    c.stroke();
    c.clip();
    for (let i = 0; i < 7; i++) {
      const t0 = -1 + (i * 2) / 7,
        t1 = -1 + ((i + 1) * 2) / 7;
      c.beginPath();
      c.moveTo(x, y + h * 0.56);
      c.bezierCurveTo(
        x + t0 * w * 0.12,
        y + h * 0.18,
        x + t0 * w * 0.7,
        y - h * 0.52,
        x,
        y - h * 0.68,
      );
      c.bezierCurveTo(
        x + t1 * w * 0.7,
        y - h * 0.52,
        x + t1 * w * 0.12,
        y + h * 0.18,
        x,
        y + h * 0.56,
      );
      c.closePath();
      c.fillStyle = i % 2 ? mix(col, paper, 0.3) : col;
      c.globalAlpha = 0.75;
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = ink;
      c.lineWidth = 0.55;
      c.stroke();
    }
    c.restore();
    const yy = y + h * 0.56;
    line(
      [
        [x - w * 0.08, yy - 5],
        [x - w * 0.055, yy + 18],
      ],
      ink,
      0.7,
      0.8,
    );
    line(
      [
        [x + w * 0.08, yy - 5],
        [x + w * 0.055, yy + 18],
      ],
      ink,
      0.7,
      0.8,
    );
    rect(x - w * 0.07, yy + 14, w * 0.14, h * 0.105, "#9f7754", ink, 0.7);
    for (let i = 0; i < 3; i++)
      line(
        [
          [x - w * 0.06, yy + 18 + i * 3],
          [x + w * 0.06, yy + 18 + i * 3],
        ],
        ink,
        0.5,
        0.4,
      );
  }
  for (const b of [
    [238, 269, 125, 142, "#b87561"],
    [495, 360, 75, 84, "#8b9c8a"],
    [785, 173, 90, 102, "#c49b62"],
    [1050, 395, 53, 60, "#a87863"],
    [628, 241, 44, 48, "#829e9d"],
    [125, 419, 43, 48, "#ae846b"],
    [977, 148, 35, 40, "#b59975"],
  ])
    balloon(...b);
  a.birds(442, 174, 5, 110);
  a.finish(
    "Before the valley wakes",
    "Cappadocia · clay valleys & silk skies",
    "08",
  );
}
