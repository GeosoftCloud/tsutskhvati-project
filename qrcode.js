/**
 * Lightweight, zero-dependency ISO/IEC 18004 QR Code encoder (Byte mode, UTF-8, ECC Level L/M)
 * Renders crisp SVG markup and high-DPI PNG data URLs for classroom projection & mobile scanning.
 */
(function (global) {
  "use strict";

  // Capacities (data codewords) and EC codewords per block for Versions 1..15 at ECC Level L & M
  // Format: [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
  const VERSION_TABLE = {
    L: [
      null,
      [26, 7, 1, 19, 0, 0],
      [44, 10, 1, 34, 0, 0],
      [70, 15, 1, 55, 0, 0],
      [100, 20, 1, 80, 0, 0],
      [134, 26, 1, 108, 0, 0],
      [172, 18, 2, 68, 0, 0],
      [196, 20, 2, 78, 0, 0],
      [242, 24, 2, 97, 0, 0],
      [292, 30, 2, 116, 0, 0],
      [346, 18, 2, 68, 2, 69],
      [404, 20, 4, 81, 0, 0],
      [466, 24, 2, 92, 2, 93],
      [532, 26, 4, 107, 0, 0],
      [581, 30, 3, 115, 1, 116],
      [655, 22, 5, 87, 1, 88]
    ],
    M: [
      null,
      [26, 10, 1, 16, 0, 0],
      [44, 16, 1, 28, 0, 0],
      [70, 26, 1, 44, 0, 0],
      [100, 18, 2, 32, 0, 0],
      [134, 24, 2, 43, 0, 0],
      [172, 16, 4, 27, 0, 0],
      [196, 18, 4, 31, 0, 0],
      [242, 22, 2, 38, 2, 39],
      [292, 22, 3, 36, 2, 37],
      [346, 26, 4, 43, 1, 44],
      [404, 30, 1, 50, 4, 51],
      [466, 22, 6, 36, 2, 37],
      [532, 22, 8, 37, 1, 38],
      [581, 24, 4, 40, 5, 41],
      [655, 24, 5, 41, 5, 42]
    ]
  };

  const ALIGNMENT_POSITIONS = [
    null,
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70]
  ];

  // GF(256) tables with primitive polynomial 0x11d
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeRemainder(data, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      for (let j = 0; j < ecLen - 1; j++) {
        rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
      }
      rem[ecLen - 1] = gfMul(gen[ecLen], factor);
    }
    return rem;
  }

  function utf8Bytes(str) {
    return Array.from(new TextEncoder().encode(String(str)));
  }

  function chooseVersion(byteLen, eccLevel) {
    const table = VERSION_TABLE[eccLevel];
    for (let v = 1; v <= 15; v++) {
      const info = table[v];
      const totalDataBytes = info[2] * info[3] + info[4] * info[5];
      const countBits = v <= 9 ? 8 : 16;
      const neededBits = 4 + countBits + byteLen * 8;
      if (neededBits <= totalDataBytes * 8) {
        return v;
      }
    }
    return -1;
  }

  function buildDataCodewords(bytes, version, eccLevel) {
    const info = VERSION_TABLE[eccLevel][version];
    const totalDataBytes = info[2] * info[3] + info[4] * info[5];
    const bits = [];

    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    }

    // Mode indicator: Byte mode = 0100
    pushBits(0b0100, 4);
    pushBits(bytes.length, version <= 9 ? 8 : 16);
    for (let i = 0; i < bytes.length; i++) {
      pushBits(bytes[i], 8);
    }

    const maxBits = totalDataBytes * 8;
    const terminator = Math.min(4, maxBits - bits.length);
    pushBits(0, terminator);
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
      codewords.push(byte);
    }

    let padToggle = true;
    while (codewords.length < totalDataBytes) {
      codewords.push(padToggle ? 0xec : 0x11);
      padToggle = !padToggle;
    }

    // Split into blocks, compute Reed-Solomon EC, and interleave
    const ecLen = info[1];
    const g1Blocks = info[2];
    const g1DataLen = info[3];
    const g2Blocks = info[4];
    const g2DataLen = info[5];

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (let i = 0; i < g1Blocks; i++) {
      const slice = codewords.slice(offset, offset + g1DataLen);
      offset += g1DataLen;
      dataBlocks.push(slice);
      ecBlocks.push(Array.from(rsComputeRemainder(slice, ecLen)));
    }
    for (let i = 0; i < g2Blocks; i++) {
      const slice = codewords.slice(offset, offset + g2DataLen);
      offset += g2DataLen;
      dataBlocks.push(slice);
      ecBlocks.push(Array.from(rsComputeRemainder(slice, ecLen)));
    }

    const interleaved = [];
    const maxDataLen = Math.max(g1DataLen, g2DataLen);
    for (let col = 0; col < maxDataLen; col++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (col < dataBlocks[b].length) interleaved.push(dataBlocks[b][col]);
      }
    }
    for (let col = 0; col < ecLen; col++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        interleaved.push(ecBlocks[b][col]);
      }
    }

    return interleaved;
  }

  function createMatrix(version) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Uint8Array(size));
    const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

    function setFunctionModule(r, c, dark) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      modules[r][c] = dark ? 1 : 0;
      isFunction[r][c] = 1;
    }

    function drawFinder(top, left) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = top + dr;
          const c = left + dc;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFunctionModule(r, c, inOuter && (onBorder || inCenter));
        }
      }
    }

    function drawAlignment(centerR, centerC) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(centerR + dr, centerC + dc, dist !== 1);
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      setFunctionModule(6, i, i % 2 === 0);
      setFunctionModule(i, 6, i % 2 === 0);
    }

    // Alignment patterns
    const alignCoords = ALIGNMENT_POSITIONS[version];
    for (let i = 0; i < alignCoords.length; i++) {
      for (let j = 0; j < alignCoords.length; j++) {
        const r = alignCoords[i];
        const c = alignCoords[j];
        const overlapsFinder =
          (r === 6 && c === 6) ||
          (r === 6 && c === size - 7) ||
          (r === size - 7 && c === 6);
        if (!overlapsFinder) drawAlignment(r, c);
      }
    }

    // Dark module
    setFunctionModule(4 * version + 9, 8, true);

    // Reserve format information slots
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) {
        if (!isFunction[8][i]) setFunctionModule(8, i, false);
        if (!isFunction[i][8]) setFunctionModule(i, 8, false);
      }
    }
    for (let i = 0; i < 8; i++) {
      setFunctionModule(8, size - 1 - i, false);
      if (i < 7) setFunctionModule(size - 1 - i, 8, false);
    }

    // Version info for version >= 7
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) {
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      }
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunctionModule(a, b, bit);
        setFunctionModule(b, a, bit);
      }
    }

    return { size, modules, isFunction };
  }

  function placeDataBits(matrix, codewords) {
    const { size, modules, isFunction } = matrix;
    let bitIndex = 0;
    const totalBits = codewords.length * 8;

    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (!isFunction[r][c]) {
            let dark = false;
            if (bitIndex < totalBits) {
              dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
              bitIndex++;
            }
            modules[r][c] = dark ? 1 : 0;
          }
        }
      }
    }
  }

  function maskBit(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function drawFormatBits(modules, size, eccLevel, mask) {
    const formatBits = eccLevel === "L" ? 0b01 : 0b00; // L=01, M=00
    const data = (formatBits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const bits = ((data << 10) | rem) ^ 0x5412;

    const getBit = (idx) => ((bits >>> idx) & 1);

    // First copy around top-left finder
    for (let i = 0; i <= 5; i++) modules[i][8] = getBit(i);
    modules[7][8] = getBit(6);
    modules[8][8] = getBit(7);
    modules[8][7] = getBit(8);
    for (let i = 9; i < 15; i++) modules[8][14 - i] = getBit(i);

    // Second copy along top-right and bottom-left
    for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = getBit(i);
    for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = getBit(i);
    modules[size - 8][8] = 1;
  }

  function computePenalty(modules, size) {
    let penalty = 0;

    // Rule 1: runs of >= 5 identical modules in rows & cols
    for (let r = 0; r < size; r++) {
      let runColor = modules[r][0];
      let runLen = 1;
      for (let c = 1; c < size; c++) {
        if (modules[r][c] === runColor) {
          runLen++;
          if (runLen === 5) penalty += 3;
          else if (runLen > 5) penalty += 1;
        } else {
          runColor = modules[r][c];
          runLen = 1;
        }
      }
    }
    for (let c = 0; c < size; c++) {
      let runColor = modules[0][c];
      let runLen = 1;
      for (let r = 1; r < size; r++) {
        if (modules[r][c] === runColor) {
          runLen++;
          if (runLen === 5) penalty += 3;
          else if (runLen > 5) penalty += 1;
        } else {
          runColor = modules[r][c];
          runLen = 1;
        }
      }
    }

    // Rule 2: 2x2 blocks
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // Rule 4: balance of dark modules
    let darkCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) darkCount += modules[r][c];
    }
    const total = size * size;
    const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
    if (k > 0) penalty += k * 10;

    return penalty;
  }

  function encodeQR(text, preferredEcc) {
    const bytes = utf8Bytes(text);
    let ecc = preferredEcc || "M";
    let version = chooseVersion(bytes.length, ecc);
    if (version === -1 && ecc !== "L") {
      ecc = "L";
      version = chooseVersion(bytes.length, ecc);
    }
    if (version === -1) {
      throw new Error("QR text is too long (maximum ~650 UTF-8 bytes).");
    }

    const codewords = buildDataCodewords(bytes, version, ecc);
    const base = createMatrix(version);
    placeDataBits(base, codewords);

    let bestMask = 0;
    let bestScore = Infinity;
    let bestModules = null;

    for (let mask = 0; mask < 8; mask++) {
      const cloned = base.modules.map((row) => Uint8Array.from(row));
      for (let r = 0; r < base.size; r++) {
        for (let c = 0; c < base.size; c++) {
          if (!base.isFunction[r][c] && maskBit(mask, r, c)) {
            cloned[r][c] ^= 1;
          }
        }
      }
      drawFormatBits(cloned, base.size, ecc, mask);
      const score = computePenalty(cloned, base.size);
      if (score < bestScore) {
        bestScore = score;
        bestMask = mask;
        bestModules = cloned;
      }
    }

    return {
      version,
      eccLevel: ecc,
      mask: bestMask,
      size: base.size,
      modules: bestModules
    };
  }

  function toSvgString(text, options) {
    const opts = Object.assign(
      {
        margin: 4,
        darkColor: "#142638",
        lightColor: "#ffffff",
        eccLevel: "M",
        pixelSize: 260,
        title: "Lesson QR Code"
      },
      options || {}
    );
    const qr = encodeQR(text, opts.eccLevel);
    const total = qr.size + opts.margin * 2;
    const parts = [];

    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          parts.push(`M${c + opts.margin},${r + opts.margin}h1v1h-1z`);
        }
      }
    }

    const safeTitle = String(opts.title)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
      `width="${opts.pixelSize}" height="${opts.pixelSize}" role="img" aria-label="${safeTitle}" shape-rendering="crispEdges">` +
      `<rect width="100%" height="100%" fill="${opts.lightColor}" rx="2"/>` +
      `<path d="${parts.join("")}" fill="${opts.darkColor}"/>` +
      `</svg>`
    );
  }

  function toPngDataUrl(text, options) {
    const opts = Object.assign(
      {
        margin: 4,
        scale: 12,
        darkColor: "#142638",
        lightColor: "#ffffff",
        eccLevel: "M"
      },
      options || {}
    );
    const qr = encodeQR(text, opts.eccLevel);
    const total = (qr.size + opts.margin * 2) * opts.scale;
    const canvas = document.createElement("canvas");
    canvas.width = total;
    canvas.height = total;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = opts.lightColor;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = opts.darkColor;

    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          ctx.fillRect(
            (c + opts.margin) * opts.scale,
            (r + opts.margin) * opts.scale,
            opts.scale,
            opts.scale
          );
        }
      }
    }
    return canvas.toDataURL("image/png");
  }

  global.SnowDayQR = {
    encode: encodeQR,
    toSvgString,
    toPngDataUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
