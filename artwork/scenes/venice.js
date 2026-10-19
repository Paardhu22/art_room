import { boat, dome, house } from "../architecture.js";
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
  } = a;
  a.start("#cbd6cb");
  a.cloud(525, 150, 360, 32, paper, 0.7);
  a.cloud(805, 247, 270, 24, paper, 0.7);
  wash(
    [
      [36, 460],
      [1164, 460],
      [1164, 1116],
      [36, 1116],
    ],
    "#5d8e8c",
    0.72,
    2,
  );
  a.ripples(40, 490, 1160, 1110, "#3f7278", 1700);
  for (let i = 0; i < 180; i++) {
    const x = r(38, 1160),
      y = r(610, 1110);
    line(
      [
        [x, y],
        [x + r(5, 40), y],
      ],
      r() > 0.45 ? "#e6cfaa" : "#9a775b",
      r(0.6, 2),
      0.3,
    );
  }
  // Distant buildings sit on a continuous stone quay at the vanishing point.
  poly(
    [
      [433, 501],
      [780, 501],
      [746, 525],
      [467, 525],
    ],
    "#d4c7a5",
    ink,
    0.8,
  );
  for (let i = 0; i < 7; i++)
    house(
      a,
      440 + i * 47,
      499,
      43,
      r(45, 80),
      13,
      ["#d1ac79", "#c98969", "#d8b98b"][i % 3],
      "#ac6846",
      2,
    );
  rect(575, 269, 38, 228, "#bd9470", ink, 0.9);
  rect(570, 263, 48, 8, "#a37350", ink, 0.7);
  for (let i = 0; i < 3; i++) arch(579 + i * 10, 279, 7, 25, "#676d53");
  poly(
    [
      [571, 262],
      [594, 214],
      [617, 262],
    ],
    "#6b8474",
    ink,
    0.8,
  );
  rect(656, 406, 91, 93, "#e1caa4", ink, 0.8);
  dome(a, 701, 405, 93, 77, "#8b9c86");
  for (let i = 0; i < 4; i++) arch(665 + i * 20, 440, 12, 43, "#76826a");
  const nearYs = [563, 649, 769, 932, 1150];
  function building(right, index) {
    const near = nearYs[index],
      far = index ? nearYs[index - 1] : 502;
    const edge = (y) => 600 + (right ? 1 : -1) * (y - 449) * 0.65;
    const roof = (y) => 449 - (y - 449) * 0.72 + (index % 2 ? 8 : -12);
    const xn = edge(near),
      xf = edge(far),
      tn = roof(near),
      tf = roof(far),
      outer = right ? 1180 : 20;
    const colour = ["#d5b17c", "#cf9972", "#d5b28a", "#bf8567", "#d5ad80"][
      (index + (right ? 2 : 0)) % 5
    ];
    const front = [
      [outer, near],
      [xn, near],
      [xn, tn],
      [outer, tn - 30],
    ];
    const side = [
      [xn, near],
      [xf, far],
      [xf, tf],
      [xn, tn],
    ];
    wash(front, mix(colour, paper, 0.1), 0.98, 0.6);
    line([...front, front[0]], ink, 0.9, 0.85);
    wash(side, colour, 0.97, 0.7);
    line([...side, side[0]], ink, 1, 0.9);
    hatch(side, ink, 6, 0.13, right ? 0.25 : -0.25);
    const point = (t, v) => [
      xn + (xf - xn) * t,
      near +
        (far - near) * t +
        (tn + (tf - tn) * t - (near + (far - near) * t)) * v,
    ];
    for (let row = 0; row < 5; row++) {
      const v = 0.12 + row * 0.17;
      line([point(0, v - 0.027), point(1, v - 0.027)], "#efcf9f", 1.5, 0.75);
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4,
          p = point(t, v),
          height = near + (far - near) * t - (tn + (tf - tn) * t),
          ww = Math.max(5, Math.abs(xf - xn) / 7),
          hh = height * 0.085;
        arch(p[0] - ww / 2, p[1] - hh, ww, hh, "#38574c");
        line(
          [
            [p[0] - ww * 0.75, p[1] - hh + 2],
            [p[0] - ww * 0.75, p[1] - 1],
          ],
          "#546e50",
          2,
          0.9,
        );
        line(
          [
            [p[0] + ww * 0.75, p[1] - hh + 2],
            [p[0] + ww * 0.75, p[1] - 1],
          ],
          "#546e50",
          2,
          0.9,
        );
        line(
          [
            [p[0] - ww * 0.7, p[1] + 2],
            [p[0] + ww * 0.7, p[1] + 2],
          ],
          "#e3c598",
          1.5,
          0.9,
        );
        if (row === 2 && k % 2 === 0) {
          line(
            [
              [p[0] - ww, p[1] + 3],
              [p[0] + ww, p[1] + 3],
            ],
            ink,
            1,
            0.85,
          );
          for (let j = -2; j <= 2; j++)
            line(
              [
                [p[0] + j * ww * 0.4, p[1] + 3],
                [p[0] + j * ww * 0.4, p[1] - 8],
              ],
              ink,
              0.6,
              0.8,
            );
        }
      }
    }
    // Near-facing walls contain their own shutters and brickwork.
    const width = Math.abs(outer - xn),
      start = Math.min(outer, xn);
    for (let row = 0; row < 7; row++)
      for (let k = 0; k < Math.floor(width / 42); k++) {
        const xx = start + 20 + k * 42,
          yy = tn + 30 + (row * (near - tn - 30)) / 7;
        rect(xx, yy, 16, 27, "#4b6550", ink, 0.6);
        line(
          [
            [xx + 7, yy],
            [xx + 7, yy + 27],
          ],
          "#b8b897",
          0.65,
          0.5,
        );
        for (let j = 0; j < 5; j++)
          line(
            [
              [xx + 1, yy + j * 5],
              [xx + 15, yy + j * 5],
            ],
            ink,
            0.5,
            0.5,
          );
      }
    poly(
      [
        [outer, tn - 31],
        [xn, tn - 1],
        [xf, tf - 1],
        [xf + (right ? 14 : -14), tf - 21],
        [xn + (right ? 24 : -24), tn - 24],
        [outer, tn - 62],
      ],
      "#ad6443",
      ink,
      1,
    );
    for (let i = 0; i < 25; i++) {
      const t = i / 25,
        p = point(t, 1);
      line(
        [
          [p[0], p[1] - 1],
          [p[0] + (right ? 15 : -15), p[1] - 20],
        ],
        ink,
        0.55,
        0.65,
      );
    }
    line([point(0, 0.01), point(1, 0.01)], "#ddd0aa", 7, 0.9);
    for (let k = 0; k < 7; k++) {
      const p = point(k / 7, 0);
      line(
        [
          [p[0], p[1]],
          [p[0], p[1] + 18],
        ],
        "#78563b",
        3,
        0.8,
      );
    }
    if (index > 2)
      for (let i = 0; i < 32; i++) {
        const t = r(),
          v = r(0.04, 0.9),
          p = point(t, v);
        line(
          [
            [p[0], p[1]],
            [p[0] + r(2, 7), p[1]],
          ],
          ink,
          0.5,
          0.24,
        );
      }
  }
  for (let i = 0; i < 5; i++) {
    building(false, i);
    building(true, i);
  }
  // One continuous bridge, connected to the two canal-side walkways.
  const bx = 410,
    by = 744,
    bw = 380;
  c.save();
  c.beginPath();
  c.moveTo(bx, by + 22);
  c.bezierCurveTo(bx + 100, by - 69, bx + bw - 100, by - 69, bx + bw, by + 22);
  c.lineTo(bx + bw, by - 8);
  c.bezierCurveTo(bx + bw - 100, by - 107, bx + 100, by - 107, bx, by - 8);
  c.closePath();
  c.fillStyle = "#d9c6a2";
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
  curve(
    [
      [bx, by - 25],
      [bx + 90, by - 132],
      [bx + bw - 90, by - 132],
      [bx + bw, by - 25],
    ],
    ink,
    2,
    0.85,
  );
  for (let i = 0; i < 26; i++) {
    const t = i / 25,
      x = bx + bw * t,
      y = by - 7 - 75 * Math.sin(Math.PI * t);
    line(
      [
        [x, y],
        [x, y - 22],
      ],
      ink,
      0.75,
      0.8,
    );
  }
  for (let i = 0; i < 22; i++) {
    const t = i / 21,
      x = bx + bw * t,
      y = by + 18 - 67 * Math.sin(Math.PI * t);
    line(
      [
        [x, y],
        [x - 2, y - 15],
      ],
      ink,
      0.6,
      0.45,
    );
  }
  for (const [x, y] of [
    [284, 954],
    [330, 901],
    [909, 955],
    [864, 895],
  ]) {
    line(
      [
        [x, y + 20],
        [x, y - 68],
      ],
      "#8f6648",
      5,
      0.9,
    );
    for (let k = 0; k < 7; k++)
      line(
        [
          [x - 3, y - 60 + k * 10],
          [x + 3, y - 54 + k * 10],
        ],
        "#d2b07a",
        1,
        0.8,
      );
  }
  boat(a, 535, 1003, 128, "#38483d", -0.17);
  line(
    [
      [574, 974],
      [621, 939],
    ],
    ink,
    2,
    0.85,
  );
  ellipse(572, 962, 4, 5, ink);
  line(
    [
      [572, 967],
      [569, 983],
    ],
    ink,
    3,
    0.9,
  );
  boat(a, 654, 835, 61, "#70533b", 0.09);
  boat(a, 572, 602, 28, "#5a634c", -0.05);
  a.birds(754, 208, 6, 130);
  a.finish(
    "The canal keeps its secrets",
    "Venice · ochre walls & green water",
    "03",
  );
}
