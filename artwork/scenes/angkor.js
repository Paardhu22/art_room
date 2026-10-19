import { steps } from "../architecture.js";
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
    tree,
    grass,
    rock,
  } = a;
  a.start("#b8c6ac");
  // Deep jungle is built in layers so the ruined towers remain the brightest mass.
  for (let row = 0; row < 3; row++) {
    const col = ["#a8b49a", "#8a9c7d", "#687f66"][row];
    wash(
      [
        [36, 420 + row * 90],
        [230, 350 + row * 70],
        [410, 410 + row * 70],
        [610, 330 + row * 85],
        [830, 360 + row * 80],
        [1164, 300 + row * 100],
        [1164, 990],
        [36, 990],
      ],
      col,
      0.32,
      6,
    );
    for (let i = 0; i < 17; i++)
      tree(
        50 + i * 73 + r(-20, 20),
        680 + row * 50 + r(-35, 35),
        r(135, 280) - row * 12,
        col,
      );
  }
  for (let i = 0; i < 12; i++)
    a.cloud(r(65, 1140), r(350, 570), r(120, 300), r(10, 28), paper, 0.6);
  wash(
    [
      [36, 876],
      [1164, 857],
      [1164, 1116],
      [36, 1116],
    ],
    "#738b75",
    0.75,
    3,
  );
  a.ripples(40, 908, 1160, 1108, "#3f665b", 700);
  // Temple gallery, arcade, and long receding stone terrace.
  const terrace = [
    [174, 883],
    [1007, 883],
    [1064, 844],
    [213, 844],
  ];
  poly(terrace, "#a7aa8c", ink, 1.2);
  poly(
    [
      [174, 883],
      [1007, 883],
      [1007, 923],
      [174, 923],
    ],
    "#858d76",
    ink,
    0.8,
  );
  masonry(
    [
      [174, 883],
      [1007, 883],
      [1007, 923],
      [174, 923],
    ],
    16,
    ink,
    0.3,
  );
  rect(230, 689, 712, 180, "#aaa990", ink, 0.9);
  masonry(
    [
      [230, 689],
      [942, 689],
      [942, 869],
      [230, 869],
    ],
    21,
    ink,
    0.25,
  );
  for (let i = 0; i < 13; i++) arch(247 + i * 52, 728, 32, 118, "#4d6051");
  const galleryRoof = [
    [208, 696],
    [247, 660],
    [920, 660],
    [969, 696],
  ];
  wash(galleryRoof, "#7c8771", 0.95, 1);
  line([...galleryRoof, galleryRoof[0]], ink, 1, 0.8);
  for (let x = 250; x < 936; x += 13)
    line(
      [
        [x, 661],
        [x - 9, 696],
      ],
      ink,
      0.6,
      0.55,
    );
  function tower(x, y, w, h) {
    const side = [
      [x + w * 0.4, y],
      [x + w * 0.55, y - 28],
      [x + w * 0.47, y - h * 0.7],
      [x + w * 0.31, y - h * 0.86],
      [x + w * 0.22, y - h],
      [x + w * 0.03, y - h * 1.09],
      [x, y - h],
      [x + w * 0.2, y - h * 0.5],
    ];
    const front = [
      [x - w * 0.42, y],
      [x + w * 0.42, y],
      [x + w * 0.31, y - h * 0.66],
      [x + w * 0.2, y - h * 0.86],
      [x + w * 0.11, y - h],
      [x, y - h * 1.08],
      [x - w * 0.11, y - h],
      [x - w * 0.2, y - h * 0.86],
      [x - w * 0.31, y - h * 0.66],
    ];
    wash(side, "#7b846d", 1, 1);
    wash(front, "#b2ad91", 0.98, 1);
    line([...front, front[0]], ink, 1.1, 0.85);
    masonry(front, 15, ink, 0.35);
    hatch(side, ink, 6, 0.2, -0.3);
    for (let j = 0; j < 9; j++) {
      const yy = y - h * 0.2 - j * h * 0.087,
        ww = w * 0.45 * (1 - j * 0.058);
      line(
        [
          [x - ww, yy],
          [x + ww, yy],
        ],
        "#6d765f",
        1,
        0.65,
      );
      line(
        [
          [x - ww, yy - 3],
          [x + ww, yy - 3],
        ],
        "#dad0b0",
        1,
        0.65,
      );
    }
    // Recessed door, carved vertical shafts and stepped lotus crown.
    arch(x - w * 0.12, y - h * 0.42, w * 0.24, h * 0.42, "#465c4b");
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++)
        line(
          [
            [x + side * (w * 0.17 + j * 4), y - h * 0.15],
            [x + side * (w * 0.1 + j * 3), y - h * 0.66],
          ],
          "#5d6753",
          0.75,
          0.7,
        );
    for (let i = 0; i < 9; i++) {
      const xx = x + (i - 4) * w * 0.035,
        yy = y - h * 0.89 - Math.cos((i - 4) * 0.3) * h * 0.1;
      ellipse(xx, yy, w * 0.035, h * 0.05, "#a6a587", ink, 0.7);
    }
    for (let i = 0; i < 26; i++) {
      const xx = r(x - w * 0.3, x + w * 0.3),
        yy = r(y - h * 0.75, y - 12);
      ellipse(xx, yy, r(3, 10), r(1, 3), "#698060", null, 0, 0.25);
    }
  }
  tower(380, 699, 170, 267);
  tower(822, 702, 164, 260);
  tower(600, 849, 278, 453);
  steps(a, 484, 852, 227, 9, 8, "#acaa8c");
  // Banyan trunk and roots straddle a broken left-hand gallery.
  const trunk = [
    [145, 172],
    [182, 162],
    [208, 391],
    [195, 565],
    [237, 706],
    [276, 806],
    [257, 849],
    [229, 781],
    [198, 706],
    [172, 625],
    [160, 472],
  ];
  wash(trunk, "#b0b29a", 0.95, 2);
  line([...trunk, trunk[0]], ink, 1, 0.8);
  for (let i = 0; i < 14; i++) {
    const x = 155 + i * 3.6;
    curve(
      [
        [x, 183],
        [x + r(-18, 20), 425],
        [x + r(-12, 20), 617],
        [235 + r(-37, 40), 824],
      ],
      ink,
      r(0.6, 1.3),
      0.45,
    );
  }
  for (let i = 0; i < 13; i++) {
    const ex = 180 + i * 15;
    curve(
      [
        [190, 617],
        [160, 693],
        [ex - 25, 798],
        [ex, 873],
      ],
      "#a7ae91",
      r(3, 8),
      0.9,
    );
    curve(
      [
        [188, 619],
        [158, 699],
        [ex - 26, 804],
        [ex, 875],
      ],
      ink,
      0.6,
      0.7,
    );
  }
  curve(
    [
      [172, 388],
      [81, 289],
      [69, 193],
      [37, 145],
    ],
    "#929c80",
    16,
    0.9,
  );
  curve(
    [
      [184, 331],
      [292, 245],
      [360, 220],
      [418, 142],
    ],
    "#a4ab90",
    13,
    0.9,
  );
  // Tree canopy extends beyond the plate to frame the ruins instead of hiding them.
  for (let i = 0; i < 110; i++) {
    const x = r(25, 1170),
      y = r(20, x < 270 || x > 970 ? 310 : 145),
      w = r(18, 57);
    ellipse(
      x,
      y,
      w,
      w * 0.4,
      mix("#6a835e", paper, r(0.1, 0.4)),
      null,
      0,
      r(0.35, 0.75),
    );
    for (let j = 0; j < 17; j++) {
      const xx = x + r(-w, w),
        yy = y + r(-w * 0.35, w * 0.35);
      curve(
        [
          [xx - 3, yy],
          [xx - 2, yy - 5],
          [xx + 2, yy - 5],
          [xx + 4, yy],
        ],
        ink,
        0.55,
        0.45,
      );
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = r(65, 1140),
      y = r(75, 210);
    curve(
      [
        [x, y],
        [x - 13, y + 60],
        [x + 21, y + 90],
        [x + r(-10, 10), y + r(120, 240)],
      ],
      "#7d8c68",
      r(0.7, 1.5),
      0.55,
    );
  }
  const rightTrunk = [
    [1149, 1094],
    [1119, 1021],
    [1126, 838],
    [1088, 681],
    [1098, 536],
    [1059, 343],
    [1089, 183],
    [1127, 165],
    [1103, 354],
    [1134, 553],
    [1125, 695],
    [1165, 853],
    [1164, 1094],
  ];
  wash(rightTrunk, "#a0aa8c", 0.98, 1);
  line([...rightTrunk, rightTrunk[0]], ink, 0.9, 0.7);
  hatch(rightTrunk, ink, 5, 0.2, -0.1);
  for (let i = 0; i < 8; i++)
    curve(
      [
        [1140, 1001],
        [1110 - i * 8, 1038],
        [1060 - i * 8, 1069],
        [1040 - i * 14, 1115],
      ],
      "#8b9c7a",
      r(2, 5),
      0.75,
    );
  for (let i = 0; i < 30; i++) {
    const x = r(50, 1150),
      y = r(916, 1108);
    if (x < 330 || x > 930) grass(x, y, r(0.9, 1.8), "#627c5b");
  }
  for (let i = 0; i < 45; i++)
    rock(r(110, 1070), r(879, 932), r(13, 45), r(10, 23), "#9a9f83");
  // Lotus leaves and mirrored stone fragments in the still foreground pool.
  for (let i = 0; i < 24; i++) {
    const x = r(90, 1130),
      y = r(975, 1111);
    ellipse(x, y, r(6, 14), r(3, 6), "#778a64", ink, 0.5, 0.7);
    line(
      [
        [x, y],
        [x + 5, y - 3],
      ],
      "#bdc59e",
      0.5,
      0.8,
    );
  }
  for (let i = 0; i < 100; i++) {
    const x = r(380, 820),
      y = r(934, 1100);
    line(
      [
        [x, y],
        [x + r(4, 24), y],
      ],
      "#adae8a",
      r(0.5, 2),
      0.27,
    );
  }
  a.finish(
    "The forest takes its time",
    "Cambodia · patient stone & living roots",
    "07",
  );
}
