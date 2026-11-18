// Drawing QR codes as art. Needs shared/qr.js (window.IsolQr) for encoding.
// Exposes window.IsolQrArt = { geometry, halftone, marker, CAPACITY, ISOL_MAX, TIERS, tierFor, levelFor, MARKER_PRESETS, RISK }.
(function () {
  /** Byte-mode capacity of the largest QR code (version 40), per error-correction level. */
  const CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 };

  /** The most Isol sends in one code. Above 1,273 bytes this needs level Q. */
  const ISOL_MAX = 1500;

  /**
   * Halftone dot size by payload size: small codes have big modules, so their dots can be small and
   * show more of the picture; dense codes get bigger dots. Chosen by eye and phone tests (2026-11-17).
   */
  const TIERS = [
    { upTo: 64, dot: 0.30 },   // short links, ids
    { upTo: 256, dot: 0.40 },  // a key, one identity
    { upTo: 800, dot: 0.55 },
    { upTo: 1500, dot: 0.70 }, // the densest codes (level Q above 1,273 bytes)
  ];
  const tierFor = (bytes, tiers = TIERS) => tiers.find(t => bytes <= t.upTo) || tiers[tiers.length - 1];
  /** The strongest error-correction level that fits. */
  const levelFor = bytes => ["H", "Q", "M", "L"].find(l => CAPACITY[l] >= bytes);

  function alignmentPositions(version, size) {
    if (version === 1) return [];
    const n = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  /** Adds which part of the code each module is (finder, align or data) to an IsolQr.encode() result. */
  function geometry({ size, version, matrix }) {
    const kind = Array.from({ length: size }, () => Array(size).fill("data"));
    const finders = [[0, 0], [0, size - 7], [size - 7, 0]];
    for (const [r0, c0] of finders) for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) kind[r0 + r][c0 + c] = "finder";
    const pos = alignmentPositions(version, size), aligns = [];
    for (const r of pos) for (const c of pos) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      aligns.push([r - 2, c - 2]);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) kind[r - 2 + i][c - 2 + j] = "align";
    }
    return { size, version, matrix, kind, finders, aligns };
  }

  // ── Markers ────────────────────────────────────────────────
  const n3 = v => +v.toFixed(3);
  const rect = (x, y, w, h, rx, fill) => `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}"${rx ? ` rx="${n3(rx)}"` : ""} fill="${fill}"/>`;
  // A square with two opposite corners rounded (top-left and bottom-right): a leaf.
  const leaf = (x, y, s, r, fill) =>
    `<path d="M${n3(x + r)} ${n3(y)}H${n3(x + s)}V${n3(y + s - r)}A${n3(r)} ${n3(r)} 0 0 1 ${n3(x + s - r)} ${n3(y + s)}H${n3(x)}V${n3(y + r)}A${n3(r)} ${n3(r)} 0 0 1 ${n3(x + r)} ${n3(y)}Z" fill="${fill}"/>`;
  const diamond = (cx, cy, d, fill) => `<path d="M${n3(cx)} ${n3(cy - d / 2)}L${n3(cx + d / 2)} ${n3(cy)}L${n3(cx)} ${n3(cy + d / 2)}L${n3(cx - d / 2)} ${n3(cy)}Z" fill="${fill}"/>`;

  /**
   * One finder (n = 7) or alignment (n = 5) pattern at module position x, y.
   * Every shape keeps the dark–light–dark rings along the centre lines, which is what scanners look for.
   */
  function marker(x, y, n, { shape = "square", ring = "#4A3B42", eye = "#4A3B42", ground = "#F2E2C4", accent = "#C19A4B" } = {}) {
    const e = n === 7 ? 3 : 1, cx = x + n / 2, cy = y + n / 2, eo = (n - e) / 2;
    switch (shape) {
      case "rounded":
        return rect(x, y, n, n, n * 0.3, ring) + rect(x + 1, y + 1, n - 2, n - 2, (n - 2) * 0.24, ground) + rect(x + eo, y + eo, e, e, e * 0.32, eye);
      case "circle":
        return `<circle cx="${cx}" cy="${cy}" r="${n / 2}" fill="${ring}"/><circle cx="${cx}" cy="${cy}" r="${n / 2 - 1}" fill="${ground}"/><circle cx="${cx}" cy="${cy}" r="${e / 2 + (n === 5 ? 0.1 : 0)}" fill="${eye}"/>`;
      case "leaf":
        return leaf(x, y, n, n * 0.42, ring) + leaf(x + 1, y + 1, n - 2, (n - 2) * 0.36, ground) + leaf(x + eo, y + eo, e, e * 0.45, eye);
      case "jewel": // rounded ring, a lozenge for the eye with a small light facet
        return rect(x, y, n, n, n * 0.22, ring) + rect(x + 1, y + 1, n - 2, n - 2, (n - 2) * 0.16, ground) +
          diamond(cx, cy, e * 1.18, eye) + (n === 7 ? diamond(cx - 0.42, cy - 0.42, 0.55, ground) : "");
      case "beaded": { // the ring as a string of beads, eye as one bead
        let s = "";
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (i === 0 || j === 0 || i === n - 1 || j === n - 1) s += `<circle cx="${x + j + .5}" cy="${y + i + .5}" r=".47" fill="${ring}"/>`;
        }
        return s + `<circle cx="${cx}" cy="${cy}" r="${e / 2 + 0.08}" fill="${eye}"/>`;
      }
      case "frame": // square ring with Beardsley's triple rule around it, in the accent colour
        return (n === 7
          ? `<rect x="${x - .45}" y="${y - .45}" width="${n + .9}" height="${n + .9}" fill="none" stroke="${accent}" stroke-width=".13"/>` +
            `<rect x="${x - .75}" y="${y - .75}" width="${n + 1.5}" height="${n + 1.5}" fill="none" stroke="${accent}" stroke-width=".13"/>`
          : "") +
          rect(x, y, n, n, 0, ring) + rect(x + 1, y + 1, n - 2, n - 2, 0, ground) + rect(x + eo, y + eo, e, e, 0, eye);
      default: // square
        return rect(x, y, n, n, 0, ring) + rect(x + 1, y + 1, n - 2, n - 2, 0, ground) + rect(x + eo, y + eo, e, e, 0, eye);
    }
  }

  /** Ready-made marker looks. Colours are palette hexes. */
  const MARKER_PRESETS = {
    // Isol's house style: triple-rule corner markers with a Madder eye, Olive rounded small markers.
    isol:    { name: "Isol", finder: { shape: "frame", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "rounded", ring: "#5E6950", eye: "#4A3B42" }, pad: "rounded" },
    classic: { name: "Classic", finder: { shape: "square", ring: "#4A3B42", eye: "#4A3B42" }, align: { shape: "square", ring: "#4A3B42", eye: "#4A3B42" }, pad: "square" },
    madder:  { name: "Madder eye", finder: { shape: "square", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "square", ring: "#4A3B42", eye: "#BC4D2D" }, pad: "square" },
    rounded: { name: "Rounded", finder: { shape: "rounded", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "rounded", ring: "#4A3B42", eye: "#4A3B42" }, pad: "rounded" },
    leaf:    { name: "Leaf", finder: { shape: "leaf", ring: "#5E6950", eye: "#4A3B42" }, align: { shape: "leaf", ring: "#5E6950", eye: "#4A3B42" }, pad: "rounded" },
    jewel:   { name: "Necklace", finder: { shape: "rounded", ring: "#4A3B42", eye: "#4A3B42" }, align: { shape: "jewel", ring: "#4A3B42", eye: "#528F8D" }, pad: "rounded" },
    curtain: { name: "Curtain", finder: { shape: "rounded", ring: "#BC4D2D", eye: "#EC4823" }, align: { shape: "circle", ring: "#BC4D2D", eye: "#EC4823" }, pad: "rounded" },
    moon:    { name: "Moons", finder: { shape: "circle", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "circle", ring: "#4A3B42", eye: "#4A3B42" }, pad: "round" },
    frame:   { name: "Triple rule", finder: { shape: "frame", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "square", ring: "#4A3B42", eye: "#4A3B42" }, pad: "square" },
    beaded:  { name: "Beaded", finder: { shape: "circle", ring: "#4A3B42", eye: "#BC4D2D" }, align: { shape: "beaded", ring: "#4A3B42", eye: "#BC4D2D" }, pad: "round" },
  };

  /**
   * What failed jsQR at 8 px per module in the test matrix (qr-halftone/test-matrix.html),
   * at 40, 207, 800 and 1,500 bytes. Scanners find a code by its corner markers, so those are the strict part.
   */
  const RISK = {
    finderShapes: ["jewel", "beaded"],   // a broken ring or a decorated eye hides the corner markers
    inks: ["#528F8D", "#C19A4B"],        // Verdigris and Gilt: too light for any marker ring or eye
    pad: ["none"],                       // corner markers need their light pad
    // Exception: a Verdigris eye on "jewel" alignment markers (the Necklace preset) passed everywhere.
  };

  /**
   * The halftone design: an image behind the code, every data module shrunk to a small square dot
   * (dark or light), markers on light pads, and a light quiet zone.
   * Scanners sample module centres, so the dots carry the code and the image shows between them.
   */
  function halftone(g, {
    image,                 // data URI
    dark = "#4A3B42",      // Aubergine
    light = "#F2E2C4",     // Vellum
    dot = 0.4,             // dot size, in modules
    quiet = 4,             // quiet zone, in modules
    finder = MARKER_PRESETS.classic.finder,
    align = MARKER_PRESETS.classic.align,
    pad = "square",        // light pad behind finders: square | rounded | round | none
    alignPad = true,       // light pad behind alignment patterns
  } = {}) {
    const q = quiet, w = g.size + 2 * q, o = (1 - dot) / 2, s = n3(dot);
    const sq = (x, y) => `M${n3(x + o)} ${n3(y + o)}h${s}v${s}h-${s}z`;
    let darkPath = "", lightPath = "";
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) {
      if (g.kind[r][c] !== "data") continue;
      g.matrix[r][c] ? (darkPath += sq(c + q, r + q)) : (lightPath += sq(c + q, r + q));
    }
    const pads = pad === "none" ? "" : g.finders.map(([r, c]) => {
      const x = c + q, y = r + q;
      // r stays inside the separator ring so it never covers format-information dots
      if (pad === "round") return `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="${n3(Math.min(4.95, 4.5 + o - 0.03))}" fill="${light}"/>`;
      return rect(x - 1, y - 1, 9, 9, pad === "rounded" ? 2.6 : 0, light);
    }).join("");
    const am = Math.min(0.2, Math.max(0, o - 0.03)); // margin that never reaches a neighbouring dot
    const aPads = alignPad ? g.aligns.map(([r, c]) => rect(c + q - am, r + q - am, 5 + 2 * am, 5 + 2 * am, align.shape === "circle" || align.shape === "beaded" ? 2.7 : align.shape === "square" || align.shape === "frame" ? 0 : 1.4, light)).join("") : "";
    const marks = g.finders.map(([r, c]) => marker(c + q, r + q, 7, { ground: light, ...finder })).join("") +
      g.aligns.map(([r, c]) => marker(c + q, r + q, 5, { ground: light, ...align })).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${w}">` +
      `<rect width="${w}" height="${w}" fill="${light}"/>` +
      (image ? `<image href="${image}" x="${q}" y="${q}" width="${g.size}" height="${g.size}" preserveAspectRatio="xMidYMid slice"/>` : "") +
      `<g shape-rendering="crispEdges"><path d="${lightPath}" fill="${light}"/><path d="${darkPath}" fill="${dark}"/></g>` +
      pads + aPads + marks + `</svg>`;
  }

  window.IsolQrArt = { geometry, halftone, marker, CAPACITY, ISOL_MAX, TIERS, tierFor, levelFor, MARKER_PRESETS, RISK };
})();
