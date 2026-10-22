// QR — a small QR code encoder (byte mode, versions 1–10) for the phone pad's pairing link.
// QR.encode(text, 'M') → { size, dark(x, y) }; QR.svgPath(code) → an SVG path of the dark modules.
// A mask (0–7) can be forced as the third argument; otherwise the best one is picked.
(() => {
  'use strict';

  // Per version 1–10: error-correction codewords per block, and number of blocks.
  const ECC_PER_BLOCK = {
    L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28]
  };
  const BLOCKS = {
    L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8]
  };
  const FORMAT_ECL = { L: 1, M: 0, Q: 3, H: 2 };

  const bit = (value, i) => ((value >>> i) & 1) !== 0;

  function rawModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const align = Math.floor(ver / 7) + 2;
      n -= (25 * align - 10) * align - 55;
      if (ver >= 7) n -= 36;
    }
    return n;
  }

  const dataCodewords = (ver, ecl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver - 1] * BLOCKS[ecl][ver - 1];

  // ---------- Reed–Solomon over GF(256) ----------
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
    }
    return result;
  }

  // Split into blocks, add error correction, then interleave.
  function withEcc(data, ver, ecl) {
    const numBlocks = BLOCKS[ecl][ver - 1];
    const eccLen = ECC_PER_BLOCK[ecl][ver - 1];
    const raw = Math.floor(rawModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const divisor = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortLen - eccLen || j >= numShort) out.push(block[i]);
      });
    }
    return out;
  }

  function alignPositions(ver, size) {
    if (ver === 1) return [];
    const count = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
    const out = [6];
    for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  function encode(text, ecl = 'M', forceMask = -1) {
    const bytes = [...new TextEncoder().encode(text)];
    let ver = 1;
    for (; ver <= 10; ver++) {
      const bits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (bits <= dataCodewords(ver, ecl) * 8) break;
    }
    if (ver > 10) throw new Error('Text is too long for this QR encoder.');

    // Byte-mode bit stream, terminated and padded to capacity.
    const capacity = dataCodewords(ver, ecl) * 8;
    const bits = [];
    const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };

    // Timing, finder and alignment patterns.
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    const align = alignPositions(ver, size);
    const n = align.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    const drawFormat = mask => {
      const value = (FORMAT_ECL[ecl] << 3) | mask;
      let rem = value;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const f = ((value << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(f, i));
      set(8, 7, bit(f, 6));
      set(8, 8, bit(f, 7));
      set(7, 8, bit(f, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(f, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(f, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(f, i));
      set(8, size - 8, true);
    };
    drawFormat(0); // reserves the format areas; the real mask is written below

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const v = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, bit(v, i));
        set(b, a, bit(v, i));
      }
    }

    // Zig-zag the codewords into the free modules.
    const codewords = withEcc(data, ver, ecl);
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fixed[y][x] && k < codewords.length * 8) {
            modules[y][x] = bit(codewords[k >>> 3], 7 - (k & 7));
            k++;
          }
        }
      }
    }

    const MASKS = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      x => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    ];
    const applyMask = m => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) modules[y][x] = !modules[y][x];
      }
    };

    // Standard penalty rules, so scanners get the easiest-to-read mask.
    const penalty = () => {
      let score = 0;
      const lines = [];
      for (let i = 0; i < size; i++) {
        lines.push(modules[i]);
        lines.push(modules.map(row => row[i]));
      }
      const finderLike = [true, false, true, true, true, false, true];
      for (const line of lines) {
        let run = 1;
        for (let i = 1; i <= size; i++) {
          if (i < size && line[i] === line[i - 1]) { run++; continue; }
          if (run >= 5) score += run - 2;
          run = 1;
        }
        for (let i = 0; i + 7 <= size; i++) {
          if (!finderLike.every((v, j) => line[i + j] === v)) continue;
          const lightBefore = i >= 4 && [1, 2, 3, 4].every(j => !line[i - j]);
          const lightAfter = i + 11 <= size && [0, 1, 2, 3].every(j => !line[i + 7 + j]);
          if (lightBefore || lightAfter) score += 40;
        }
      }
      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (modules[y][x]) dark++;
          if (x + 1 < size && y + 1 < size) {
            const c = modules[y][x];
            if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
          }
        }
      }
      score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return score;
    };

    let best = forceMask;
    let bestScore = Infinity;
    for (let m = 0; m < 8 && forceMask < 0; m++) {
      applyMask(m);
      drawFormat(m);
      const score = penalty();
      if (score < bestScore) { best = m; bestScore = score; }
      applyMask(m);
    }
    applyMask(best);
    drawFormat(best);

    return { size, version: ver, mask: best, dark: (x, y) => modules[y][x] };
  }

  function svgPath(code) {
    let d = '';
    for (let y = 0; y < code.size; y++) {
      for (let x = 0; x < code.size; x++) if (code.dark(x, y)) d += `M${x},${y}h1v1h-1z`;
    }
    return d;
  }

  window.QR = { encode, svgPath };
})();
