// Tiles, decorations and parallax backgrounds — all drawn in code with
// ordered (Bayer) dithering for that chunky 8/16-bit handheld look.

const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QPOWER: 4, USED: 5, SOLID: 6,
  PIPE_TL: 7, PIPE_TR: 8, PIPE_L: 9, PIPE_R: 10, SEMI: 11, LAVA: 12, BRIDGE: 13,
  INFO: 14, COIN: 15, SPIKES: 16, PIPE_BL: 17, PIPE_BR: 18, STONE: 19, CHAIN: 20,
  WATER: 21, HIDDEN: 22,
};
const SOLID_TILES = new Set([T.GROUND, T.BRICK, T.QCOIN, T.QPOWER, T.USED, T.SOLID, T.PIPE_TL, T.PIPE_TR,
  T.PIPE_L, T.PIPE_R, T.BRIDGE, T.INFO, T.PIPE_BL, T.PIPE_BR, T.STONE]);

const THEMES = {
  fields: {
    ground: ['#58d24a', '#2e9a3a', '#c7773a', '#8f4f22', '#e8a86a'],
    brick: ['#c9622f', '#6e2a10', '#f2a273'],
    solid: ['#d79a5e', '#8f5a2a', '#f3c999'],
    semi: ['#ffffff', '#b9dcff', '#7aa7e0'],
    stone: ['#9a9ab8', '#5b5b7a', '#c8c8e0'],
  },
  cavern: {
    ground: ['#36c37a', '#1f7a4a', '#145a36', '#0c3d24', '#d9a441'],
    brick: ['#232733', '#0d0f16', '#5a6275'],
    solid: ['#1f7a4a', '#0c3d24', '#5fe0a0'],
    semi: ['#d9a441', '#8a5d17', '#ffe08a'],
    stone: ['#2f6b4f', '#163a2a', '#5fa888'],
  },
  sky: {
    ground: ['#f2d7ff', '#b07fe0', '#7a5aa8', '#4f3a78', '#a98ad6'],
    brick: ['#8a4fd0', '#3f1a6e', '#c9a0ff'],
    solid: ['#b9a0e6', '#6a4fa0', '#e6dcff'],
    semi: ['#ffffff', '#f2d7ff', '#c5a3f0'],
    stone: ['#8a86b0', '#4e4a78', '#c0bce0'],
  },
  castle: {
    ground: ['#a09cb8', '#5a5678', '#7e7a98', '#4a4666', '#b8b4d0'],
    brick: ['#7e7a98', '#3a3654', '#b8b4d0'],
    solid: ['#a09cb8', '#4a4666', '#d0cce8'],
    semi: ['#a09cb8', '#4a4666', '#d0cce8'],
    stone: ['#7e7a98', '#3a3654', '#b8b4d0'],
  },
  room: {
    ground: ['#3d7bd9', '#1d3f80', '#2c5aa8', '#15306a', '#6aa0ff'],
    brick: ['#2c5aa8', '#0e1f4a', '#6aa0ff'],
    solid: ['#3d7bd9', '#15306a', '#8ab8ff'],
    semi: ['#6aa0ff', '#1d3f80', '#b0d0ff'],
    stone: ['#2c5aa8', '#0e1f4a', '#6aa0ff'],
  },
};

// ---------- pixel helpers ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// true when pixel (x,y) should take the "next" colour at blend level t (0..1)
function dith(x, y, t) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16 < t; }
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function rgb(hex) { const n = parseInt(hex.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
// seamless value noise inside a 16px tile (4px cells)
function tnoise(x, y, seed = 0) {
  const fx = x / 4, fy = y / 4, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const h = (i, j) => hash(((i % 4) + 4) % 4 + seed * 7, ((j % 4) + 4) % 4 + seed * 13);
  const s = t => t * t * (3 - 2 * t);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return (a + (b - a) * s(tx)) + ((c + (d - c) * s(tx)) - (a + (b - a) * s(tx))) * s(ty);
}

function tile(fn, w = TILE, h = TILE) {
  const [c, ctx] = makeCanvas(w, h);
  const p = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const r = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
  fn(p, r, ctx);
  return c;
}
// paint every pixel through a function (x,y) -> colour|null
function paint(w, h, fn) { return tile((p) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) p(x, y, c); } }, w, h); }

// remove anti-aliasing from canvas-drawn art: hard alpha edges only
function crispify(canvas) {
  const ctx = canvas.getContext('2d');
  const im = ctx.getImageData(0, 0, canvas.width, canvas.height), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  ctx.putImageData(im, 0, 0);
  return canvas;
}

// ---------- tileset ----------
function buildTileset(themeName) {
  const th = THEMES[themeName];
  const [g1, g2, d1, d2, sp] = th.ground;
  const set = {};
  const cav = themeName === 'cavern';

  const dirt = (x, y) => {
    if (cav) {
      // PCB: dithered green board + copper trace + via
      let c = dith(x, y, tnoise(x, y, 3) * 0.5) ? d1 : g2;
      if (x === 3 || (y === 7 && x >= 3 && x <= 11) || (x === 11 && y >= 7)) c = sp;
      if ((Math.abs(x - 3) <= 1 && Math.abs(y - 7) <= 1) || (Math.abs(x - 11) <= 1 && Math.abs(y - 7) <= 1)) c = (x === 3 || x === 11) && y === 7 ? g2 : sp;
      if (y === 15) c = d2;
      return c;
    }
    const n = tnoise(x, y, 1);
    let c = dith(x, y, (n - 0.42) * 2.2) ? d2 : d1;
    if (hash(x, y * 3 + 1) > 0.94) c = sp;
    if (hash(x * 5, y) > 0.965) c = d2;
    return c;
  };
  set.groundFill = paint(16, 16, dirt);
  set.groundTop = paint(16, 16, (x, y) => {
    if (cav) {
      if (y < 2) return dith(x, y, y === 0 ? 0.25 : 0) ? lighten(g1, 0.5) : g1;
      if (y === 2) return dith(x, y, 0.5) ? g1 : d2;
      if (y === 3) return d2;
      if (y === 1 && x % 6 === 2) return '#ffe08a';
      return dirt(x, y);
    }
    const depth = 4 + Math.floor(hash(x, 11) * 2.5);
    if (y === 0) return dith(x, y, 0.5) ? lighten(g1, 0.35) : g1;
    if (y < depth - 1) return (x + y * 3) % 7 === 0 ? g2 : g1;
    if (y < depth + 1) return dith(x, y, y === depth - 1 ? 0.35 : 0.75) ? g2 : g1;
    if (y === depth + 1) return dith(x, y, 0.5) ? g2 : d2;
    return dirt(x, y);
  });

  // side edges for ground cliffs (overlaid where the neighbour is open)
  const edge = (top, right) => paint(16, 16, (x, y) => {
    const lx = right ? 15 - x : x; if (lx > 1) return null;
    const green = top && !cav && y < 5, base = green ? g2 : d2;
    if (lx === 0) return darken(base, 0.25);
    return dith(x, y, 0.5) ? base : null;
  });
  set.edgeTopL = edge(true, false); set.edgeTopR = edge(true, true);
  set.edgeL = edge(false, false); set.edgeR = edge(false, true);

  // bricks: 8x8 courses with highlight, dithered shadow corner
  const brickFn = ([b, m, l], bw = 8) => (x, y) => {
    const row = Math.floor(y / 8), by = y % 8, bx = (x + (row % 2 ? bw / 2 : 0)) % bw;
    if (by === 7 || bx === bw - 1) return m;
    if (by === 0 || bx === 0) return l;
    if (by >= 5 || bx >= bw - 3) return dith(x, y, by >= 6 || bx >= bw - 2 ? 0.6 : 0.3) ? darken(b, 0.3) : b;
    return b;
  };
  set.brick = cav ? paint(16, 16, (x, y) => { // IC chip
    const [b, m, l] = th.brick;
    if ((x < 2 || x > 13) && y % 3 === 0 && y > 1 && y < 14) return '#c9c9d6';
    if (x < 2 || x > 13 || y < 1 || y > 14) return null;
    if (x === 2 || x === 13 || y === 1 || y === 14) return m;
    if (Math.abs(x - 5) <= 1 && Math.abs(y - 4) <= 1) return dith(x, y, 0.5) ? l : b;
    if (y === 10 && x > 5 && x < 12) return l;
    return dith(x, y, (x + y) / 40) ? darken(b, 0.3) : b;
  }) : paint(16, 16, brickFn(th.brick));
  set.stone = paint(16, 16, brickFn(th.stone, 16));

  // ? blocks: 3 shimmer frames
  const QMARK = ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'];
  set.q = [['#ffb800', '#ffe08a'], ['#ffc933', '#fff1b8'], ['#e6a000', '#ffd060']].map(([base, hi]) => paint(16, 16, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#5a3200';
    const qx = x - 5, qy = y - 4;
    const on = (a, b) => b >= 0 && b < 7 && a >= 0 && a < 6 && QMARK[b][a] === '#';
    if (on(qx, qy)) return '#ffffff';
    if (on(qx - 1, qy - 1)) return '#8f4f00';
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return '#5a3200';
    if (x === 1 || y === 1) return hi;
    if (x >= 13 || y >= 13) return dith(x, y, 0.55) ? darken(base, 0.25) : base;
    return base;
  }));
  set.used = paint(16, 16, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#3a1f0a';
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return '#3a1f0a';
    if (x === 1 || y === 1) return '#c07a40';
    return dith(x, y, 0.15 + (x + y) / 60) ? '#7a4520' : '#9a5a2a';
  });
  const infoTile = (base, hi, mark) => paint(16, 16, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#1b0a3a';
    if (mark === '!' && x >= 7 && x <= 8 && ((y >= 3 && y <= 9) || (y >= 11 && y <= 12))) return '#ffffff';
    if (mark === 'v') {
      const pts = [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]];
      if (pts.some(([px, py]) => (x === px || x === px + 1) && (y === py || y === py + 1))) return '#ffffff';
    }
    if (x === 1 || y === 1) return hi;
    if (x >= 13 || y >= 13) return dith(x, y, 0.55) ? darken(base, 0.3) : base;
    return base;
  });
  set.info = [infoTile('#8a3ffc', '#c08cff', '!'), infoTile('#a35cff', '#e0c4ff', '!')];
  set.infoRead = infoTile('#19b394', '#7af0d0', 'v');

  set.solid = paint(16, 16, (x, y) => {
    const [b, d, l] = th.solid;
    if (x === 0 || y === 0) return l;
    if (x === 15 || y === 15) return d;
    if (x === 1 || y === 1) return dith(x, y, 0.5) ? l : b;
    if (x === 14 || y === 14) return dith(x, y, 0.5) ? d : b;
    return dith(x, y, (x + y - 4) / 40) ? darken(b, 0.18) : b;
  });

  // pipes: shared green, dithered cylinder shading
  const PG = ['#0b3d12', '#1e7a2a', '#2fae3c', '#7de87a', '#d4ffc8'];
  const pipeCol = (x, w, y, lift = 0) => {
    if (x <= 0 || x >= w - 1) return PG[0];
    const p = (x - 1) / (w - 3);
    let v = p < 0.2 ? 0.5 + p / 0.2 * 0.5 : p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7 * 0.9;
    v = Math.max(0, Math.min(1, v + lift));
    const f = 1 + v * 3, i = Math.floor(f);
    return PG[Math.min(4, dith(x, y, f - i) ? i + 1 : i)];
  };
  const pipeTop = (half, flipV) => paint(16, 16, (x, y) => {
    const gx = half * 16 + x, ly = flipV ? 15 - y : y;
    if (ly < 14) return (ly === 0 || ly === 13) ? PG[0] : pipeCol(gx, 32, ly, ly === 1 ? 0.2 : ly >= 11 ? -0.25 : 0);
    const bx = gx - 2;
    if (bx < 0 || bx >= 28) return null;
    return ly === 14 ? PG[0] : pipeCol(bx, 28, ly, -0.2);
  });
  const pipeBody = half => paint(16, 16, (x, y) => { const bx = half * 16 + x - 2; return bx >= 0 && bx < 28 ? pipeCol(bx, 28, y) : null; });
  set.pipeTL = pipeTop(0, false); set.pipeTR = pipeTop(1, false);
  set.pipeBL = pipeTop(0, true); set.pipeBR = pipeTop(1, true);
  set.pipeL = pipeBody(0); set.pipeR = pipeBody(1);

  // one-way platforms
  set.semi = paint(16, 16, (x, y) => {
    const [a, b, c] = th.semi;
    if (cav) { // copper girder
      if (y > 5) return null;
      if (y === 0) return c;
      if (y === 5) return b;
      if ((x + y) % 4 === 0 && y > 1 && y < 5) return b;
      return a;
    }
    if (themeName === 'castle' || themeName === 'room') {
      if (y > 5) return null;
      return y === 0 ? c : y === 5 ? b : dith(x, y, y / 6) ? b : a;
    }
    // puffy cloud slab
    const top = 1 + Math.round(Math.abs(Math.sin(x * 0.75)) * 2);
    if (y < top || y > 9) return null;
    if (y === top) return '#ffffff';
    if (y >= 7) return y === 9 ? c : dith(x, y, (y - 6) / 3) ? b : a;
    return a;
  });

  // lava & water (2 animation frames)
  const liquid = (top, deep, glow, hi, f, isTop) => paint(16, 16, (x, y) => {
    if (!isTop) return dith(x, y, 0.2 + 0.15 * Math.sin((x + f * 8) * 0.4 + y * 0.3)) ? top : deep;
    const h = 2 + Math.round(Math.sin((x + f * 4) * 0.8) * 1.5);
    if (y < h) return null;
    if (y === h) return hi;
    if (y === h + 1) return glow;
    return dith(x, y, Math.max(0, 0.9 - (y - h) / 10)) ? top : deep;
  });
  set.lavaTop = [0, 1].map(f => liquid('#e8401a', '#a3150a', '#ff8a1a', '#ffe14a', f, true));
  set.lavaFill = [0, 1].map(f => liquid('#c2280a', '#8f1208', '', '', f, false));
  set.waterTop = [0, 1].map(f => liquid('#3fa9f5', '#1d5fbf', '#8fd8ff', '#e8fbff', f, true));
  set.waterFill = [0, 1].map(f => liquid('#2a7fd9', '#164a99', '', '', f, false));

  set.bridge = paint(16, 16, (x, y) => {
    if (y > 5) return null;
    if (y === 0) return '#e3a066';
    if (y === 5) return '#3a1f0a';
    if (x % 5 === 3) return '#5a2f12';
    return dith(x, y, y / 6) ? '#6e3a16' : '#8f4f22';
  });
  set.chain = tile((p, r) => { for (let i = 0; i < 4; i++) { r(i * 4 + 1, 14 - i * 4, 3, 2, '#c9c9e0'); p(i * 4 + 2, 14 - i * 4, '#6d6d8a'); } });
  set.spikes = paint(16, 16, (x, y) => {
    if (y === 15) return '#5b5b7a';
    const lx = x % 8, row = y - 8; if (row < 0) return null;
    const half = (row + 1) / 2;
    if (Math.abs(lx + 0.5 - 4) > half) return null;
    if (row < 2) return '#ffffff';
    return lx < 4 ? '#d0d0e6' : dith(x, y, 0.5) ? '#8a8aa8' : '#b8b8d0';
  });
  const coinFull = spriteFromRows(COIN_ROWS, COIN_PAL);
  set.coin = [8, 6, 2, 6].map(w => tile((p, r, ctx) => { ctx.drawImage(coinFull, 0, 0, 8, 12, 8 - w / 2, 2, w, 12); }));
  return set;
}

// ---------- dithered sky (static, one per level palette) ----------
const SKY_CACHE = {};
function buildSky(top, bottom) {
  const key = top + bottom;
  if (SKY_CACHE[key]) return SKY_CACHE[key];
  const N = 7, cols = Array.from({ length: N }, (_, i) => mix(top, bottom, i / (N - 1)));
  const [c, ctx] = makeCanvas(VIEW_W, VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    const t = y / (VIEW_H - 1) * (N - 1), i = Math.min(N - 2, Math.floor(t)), f = t - i;
    for (let x = 0; x < VIEW_W; x++) { ctx.fillStyle = dith(x, y, f) ? cols[i + 1] : cols[i]; ctx.fillRect(x, y, 1, 1); }
  }
  return (SKY_CACHE[key] = c);
}

// ---------- backgrounds (512px wrapping parallax strips) ----------
function buildBackground(themeName) {
  const W = 512, H = 224;
  const layers = [];
  const strip = fn => { const [c, ctx] = makeCanvas(W, H); fn(ctx); return crispify(c); };
  const px = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const buf = fn => { const b = new PixelBuf(W, H); fn(b); return b.toCanvas(); };
  // draw a shape at x and its wrap copies so strips tile seamlessly
  const wrap = (fn, x) => { fn(x); fn(x - W); fn(x + W); };

  const hill = (b, cx, base, rx, ry, col, dark, outline) => wrap(x0 => {
    const pb = new PixelBuf(W, H);
    pb.ellipse(x0, base, rx, ry, col);
    for (let y = base - ry; y < H; y++) for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) {
      if (pb.get(x, y) !== col) continue;
      const nx = (x + 0.5 - x0) / rx;
      if (nx > 0.1 && dith(x, y, (nx - 0.1) * 1.1)) pb.set(x, y, dark);
    }
    for (let k = 0; k < 4; k++) { const sx = Math.round(x0 - rx * 0.5 + k * rx * 0.3), sy = Math.round(base - ry * (0.35 + 0.12 * (k % 2))); if (pb.get(sx, sy)) { pb.set(sx, sy, dark); pb.set(sx, sy + 1, dark); } }
    pb.outline(outline);
    pb.d.forEach((c, i) => { if (c) b.d[i] = c; });
  }, cx);
  const cloud = (b, cx, cy, s, a, shade, edge) => wrap(x0 => {
    const pb = new PixelBuf(W, H);
    pb.ellipse(x0 - 13 * s, cy + 2 * s, 8 * s, 6 * s, a);
    pb.ellipse(x0 + 13 * s, cy + 2 * s, 8 * s, 6 * s, a);
    pb.ellipse(x0, cy - 2 * s, 11 * s, 9 * s, a);
    for (let i = 0; i < pb.d.length; i++) {
      if (!pb.d[i]) continue;
      const y = (i / W) | 0, x = i % W;
      if (y > cy + 1 * s && dith(x, y, (y - cy - s) / (6 * s))) pb.d[i] = shade;
    }
    pb.outline(edge);
    pb.d.forEach((c, i) => { if (c) b.d[i] = c; });
  }, cx);

  if (themeName === 'fields') {
    layers.push({ speed: 0.1, img: buf(b => { for (const [x, y, s] of [[40, 40, 1], [200, 26, 1.3], [330, 58, 0.9], [440, 32, 1.1]]) cloud(b, x, y, s, '#ffffff', '#cfe8ff', '#8fc2f0'); }) });
    layers.push({ speed: 0.25, img: buf(b => { for (const [x, w, h] of [[60, 140, 70], [250, 180, 95], [430, 150, 62]]) hill(b, x, 224, w / 2, h, '#7fcf86', '#5fb06a', '#3f8a50'); }) });
    // poplar rows and flat-roof houses on the horizon: a Syrdarya skyline
    layers.push({ speed: 0.4, img: strip(ctx => {
      for (let i = 0; i < 9; i++) {
        const x = 18 + i * 57 + Math.round(hash(i, 3) * 20), h = 34 + Math.round(hash(i, 5) * 22);
        px(ctx, x + 2, 192 - h, 4, h, '#2f7a3a'); px(ctx, x + 3, 194 - h - 4, 2, 4, '#2f7a3a');
        px(ctx, x + 4, 194 - h, 2, h - 4, '#24612e'); px(ctx, x + 3, 184, 2, 10, '#5a3a20');
      }
      for (const hx of [70, 300]) {
        px(ctx, hx, 172, 40, 22, '#e3cfa0'); px(ctx, hx - 2, 168, 44, 4, '#8f5a2a');
        px(ctx, hx + 6, 178, 8, 7, '#2f6fb3'); px(ctx, hx + 24, 180, 8, 14, '#2f6fb3');
        for (let y = 174; y < 194; y++) for (let x = hx; x < hx + 40; x++) if (dith(x, y, 0.15)) px(ctx, x, y, 1, 1, '#c9b07e');
      }
    }) });
    layers.push({ speed: 0.6, img: buf(b => { for (const [x, w, h] of [[150, 120, 44], [380, 96, 36]]) hill(b, x, 224, w / 2, h, '#2fae3c', '#1e8a2e', '#14601f'); }) });
  } else if (themeName === 'cavern') {
    layers.push({ speed: 0.2, img: strip(ctx => {
      for (let i = 0; i < 26; i++) {
        const y = 8 + ((hash(i, 2) * 200) | 0), x0 = (hash(i, 5) * 512) | 0, len = 40 + ((hash(i, 9) * 160) | 0);
        px(ctx, x0, y, len, 1, '#1d5a3a'); px(ctx, x0 + len, y, 1, 24, '#1d5a3a');
        px(ctx, x0 - 1, y - 1, 3, 3, '#8a6a2a'); px(ctx, x0 + len - 1, y + 23, 3, 3, '#8a6a2a');
      }
    }) });
    layers.push({ speed: 0.4, img: strip(ctx => {
      for (const [x, y, w, h] of [[60, 60, 70, 40], [260, 110, 90, 50], [420, 40, 50, 60]]) {
        px(ctx, x, y, w, h, '#0a1610');
        for (let j = 2; j < h - 2; j++) for (let i = 2; i < w - 2; i++) if (!dith(x + i, y + j, 0.25)) px(ctx, x + i, y + j, 1, 1, '#13241b');
        for (let i = 4; i < w - 4; i += 6) { px(ctx, x + i, y - 4, 2, 4, '#3a4252'); px(ctx, x + i, y + h, 2, 4, '#3a4252'); }
        px(ctx, x + 5, y + 5, 3, 3, '#24382c');
      }
    }) });
  } else if (themeName === 'sky') {
    layers.push({ speed: 0.06, img: buf(b => {
      for (let i = 0; i < 60; i++) b.set((hash(i, 11) * 512) | 0, (hash(i, 13) * 150) | 0, i % 5 ? '#e8dcff' : '#ffd23f');
      b.ellipse(380, 50, 18, 18, '#fff6e0');
      for (let y = 32; y < 69; y++) for (let x = 362; x < 399; x++) if (b.get(x, y) === '#fff6e0' && dith(x, y, (x - 372) / 30)) b.set(x, y, '#e8d6b8');
      b.ellipse(373, 45, 3, 2.5, '#d8c4a0'); b.ellipse(387, 57, 2.5, 2, '#d8c4a0');
    }) });
    layers.push({ speed: 0.22, img: buf(b => { for (const [x, y, s] of [[80, 150, 1.4], [260, 170, 1.8], [450, 160, 1.3]]) cloud(b, x, y, s, '#f2d7ff', '#c5a3f0', '#9a74d0'); }) });
    layers.push({ speed: 0.45, img: strip(ctx => {
      for (const [x, w, h] of [[30, 30, 90], [160, 22, 120], [300, 36, 80], [440, 26, 110]]) {
        px(ctx, x, 224 - h, w, h, '#3d2470'); px(ctx, x - 3, 224 - h, w + 6, 6, '#3d2470');
        for (let i = 0; i < w + 6; i += 6) px(ctx, x - 3 + i, 224 - h - 4, 3, 4, '#3d2470');
        for (let y = 224 - h; y < 224; y++) for (let i = 0; i < w; i++) if (dith(x + i, y, i / w * 0.6)) px(ctx, x + i, y, 1, 1, '#301a5a');
        px(ctx, x + w / 2 - 2, 224 - h + 16, 4, 7, '#ffd23f');
      }
    }) });
  } else if (themeName === 'castle') {
    layers.push({ speed: 0.3, img: strip(ctx => {
      for (let x = 0; x < 512; x += 128) {
        px(ctx, x + 20, 0, 24, 224, '#24152e');
        for (let y = 0; y < 224; y++) for (let i = 0; i < 24; i++) if (dith(x + 20 + i, y, i / 40)) px(ctx, x + 20 + i, y, 1, 1, '#1c1024');
        px(ctx, x + 80, 60, 12, 20, '#0d0712'); px(ctx, x + 82, 62, 8, 6, '#3a1a14');
      }
      for (let i = 0; i < 40; i++) px(ctx, (hash(i, 21) * 512) | 0, (hash(i, 23) * 224) | 0, 6, 3, '#21142a');
    }) });
  } else {
    layers.push({ speed: 0.15, img: strip(ctx => {
      for (let y = 0; y < 224; y += 16) for (let x = 0; x < 512; x += 32) px(ctx, x + ((y / 16) % 2 ? 16 : 0), y, 31, 15, '#101a33');
    }) });
  }
  return layers;
}

// ---------- decorations (non-solid scenery) ----------
function buildDecor() {
  const D = {};
  const mk = (w, h, fn, outline = '#1b1430') => { const b = new PixelBuf(w, h); fn(b); if (outline) b.outline(outline); return b.toCanvas(); };
  const shadeBuf = (b, col, dark, dir = 1) => {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === col && dith(x, y, dir > 0 ? x / b.w - 0.25 : (b.h - y) / b.h - 0.3)) b.set(x, y, dark);
  };
  D.bush = mk(34, 14, b => {
    b.ellipse(8, 10, 7, 6, '#3fc24c'); b.ellipse(26, 10, 7, 6, '#3fc24c'); b.ellipse(17, 8, 9, 8, '#3fc24c');
    b.rect(2, 12, 30, 2, '#3fc24c'); shadeBuf(b, '#3fc24c', '#23902f');
    b.set(14, 4, '#9cf08a'); b.set(15, 4, '#9cf08a'); b.set(6, 7, '#9cf08a');
  }, '#14601f');
  D.cotton = mk(16, 18, b => {
    b.rect(7, 6, 2, 12, '#2e7a2a'); b.line(8, 12, 3, 8, '#2e7a2a'); b.line(8, 10, 13, 6, '#2e7a2a');
    b.ellipse(4, 11, 3, 2, '#3fa64a'); b.ellipse(12, 9, 3, 2, '#3fa64a');
    for (const [x, y] of [[8, 4], [3, 7], [13, 5]]) { b.ellipse(x, y, 2.6, 2.4, '#ffffff'); b.set(x, y + 1, '#d8d0c0'); b.set(x - 1, y + 2, '#7a4a20'); b.set(x + 1, y + 2, '#7a4a20'); }
  }, '#1f4a1a');
  D.fence = mk(16, 13, b => {
    for (const x of [2, 11]) { b.rect(x, 1, 3, 12, '#c8925a'); b.set(x + 1, 0, '#c8925a'); }
    b.rect(0, 4, 16, 2, '#a8723a'); b.rect(0, 9, 16, 2, '#a8723a');
  }, '#4a2a10');
  D.tuft = mk(8, 5, b => { b.line(1, 4, 0, 1, '#2e9a3a'); b.line(3, 4, 3, 0, '#3fc24c'); b.line(5, 4, 6, 1, '#2e9a3a'); }, null);
  D.flowerA = mk(7, 8, b => { b.rect(3, 4, 1, 4, '#2e9a3a'); b.set(2, 6, '#2e9a3a'); b.rect(2, 0, 3, 3, '#ff6fa8'); b.set(1, 1, '#ff6fa8'); b.set(5, 1, '#ff6fa8'); b.set(3, 1, '#ffd23f'); }, null);
  D.flowerB = mk(7, 8, b => { b.rect(3, 4, 1, 4, '#2e9a3a'); b.set(4, 6, '#2e9a3a'); b.rect(2, 0, 3, 3, '#ffffff'); b.set(1, 1, '#ffffff'); b.set(5, 1, '#ffffff'); b.set(3, 1, '#ffb800'); }, null);
  D.house = mk(56, 44, b => {
    b.rect(2, 8, 52, 36, '#e8d3a8');
    for (let y = 8; y < 44; y++) for (let x = 2; x < 54; x++) if (dith(x, y, 0.12 + (x - 2) / 160)) b.set(x, y, '#cbb181');
    b.rect(0, 4, 56, 5, '#8f5a2a'); b.rect(0, 4, 56, 1, '#c08a50');
    b.rect(8, 16, 12, 10, '#2f6fb3'); b.rect(13, 16, 2, 10, '#e8d3a8'); b.rect(8, 20, 12, 1, '#e8d3a8');
    b.rect(32, 20, 14, 24, '#2f6fb3'); b.rect(38, 20, 2, 24, '#1d4a80');
    for (let i = 0; i < 7; i++) b.set(33 + i * 2, 18, '#ffd23f');
    b.rect(31, 17, 16, 1, '#ffd23f'); b.set(44, 32, '#ffd23f');
  }, '#4a2a10');
  D.sprinkler = [0, 1].map(f => mk(16, 16, b => {
    b.rect(7, 8, 2, 8, '#8a8aa8'); b.rect(5, 6, 6, 2, '#5b5b7a');
    const drops = f ? [[3, 3], [1, 6], [12, 2], [14, 5], [8, 0]] : [[4, 1], [2, 4], [11, 1], [13, 4], [0, 8], [15, 8]];
    for (const [x, y] of drops) b.set(x, y, '#7fd4ff');
  }, null));
  D.signpost = (() => {
    const c = mk(58, 26, b => { b.rect(2, 1, 54, 14, '#c8925a'); b.rect(2, 1, 54, 1, '#e8b880'); b.rect(27, 15, 4, 11, '#8f5a2a'); }, '#4a2a10');
    drawText(c.getContext('2d'), 'GULISTON', 29, 5, '#3a1a08', { align: 'center' });
    return c;
  })();
  D.led = ['#ff3b5c', '#2bd96b', '#ffd23f'].map(col => [0, 1].map(on => mk(8, 14, b => {
    b.rect(2, 8, 1, 6, '#c9c9d6'); b.rect(5, 8, 1, 4, '#c9c9d6');
    b.ellipse(4, 4, 3, 4, on ? col : darken(col, 0.55)); b.rect(1, 7, 6, 2, on ? col : darken(col, 0.55));
    if (on) { b.set(3, 2, '#ffffff'); b.set(3, 3, lighten(col, 0.6)); }
  }, '#0d0f16')));
  D.resistor = mk(18, 6, b => {
    b.rect(0, 3, 18, 1, '#c9c9d6'); b.rect(4, 1, 10, 5, '#e3c08a'); b.ellipse(4, 3.5, 2, 2.5, '#e3c08a'); b.ellipse(14, 3.5, 2, 2.5, '#e3c08a');
    for (const [x, c] of [[6, '#8f4f22'], [8, '#1b1430'], [10, '#ff3b5c'], [12, '#ffd23f']]) b.rect(x, 1, 1, 5, c);
  }, '#0d0f16');
  D.capacitor = mk(10, 16, b => {
    b.rect(3, 12, 1, 4, '#c9c9d6'); b.rect(6, 12, 1, 4, '#c9c9d6');
    b.rect(1, 1, 8, 11, '#2f6fe0'); b.rect(6, 1, 2, 11, '#c9d6ff'); b.rect(1, 1, 8, 1, '#9ab8ff');
    for (let y = 1; y < 12; y++) for (let x = 1; x < 6; x++) if (dith(x, y, x / 10)) b.set(x, y, '#2350b0');
  }, '#0d0f16');
  D.lamp = [0, 1].map(f => mk(10, 30, b => {
    b.rect(4, 10, 2, 20, '#4e4a78'); b.rect(2, 28, 6, 2, '#4e4a78');
    b.rect(1, 2, 8, 8, '#3d2470'); b.rect(2, 3, 6, 6, f ? '#ffe08a' : '#ffd23f'); b.set(4, 4, '#ffffff');
    b.tri([1, 2], [9, 2], [5, -1], '#3d2470');
  }, '#1a0b3d'));
  D.torch = [0, 1, 2].map(f => mk(10, 20, b => {
    b.rect(4, 9, 2, 11, '#6e3a16'); b.rect(2, 8, 6, 2, '#5a5678');
    const h = [6, 7, 5][f];
    b.ellipse(5, 8 - h / 2, 3, h / 2 + 1, '#ff8a1a'); b.ellipse(5, 7 - h / 4, 1.6, h / 3 + 0.5, '#ffe14a');
  }, '#120814'));
  D.banner = mk(18, 30, b => {
    b.rect(0, 0, 18, 2, '#8a86b0');
    b.rect(2, 2, 14, 22, '#6a2bb8'); b.tri([2, 23], [16, 23], [9, 29], '#6a2bb8');
    for (let y = 2; y < 24; y++) for (let x = 2; x < 16; x++) if (dith(x, y, (x - 2) / 22)) b.set(x, y, '#4a1a86');
    b.ellipse(9, 12, 4, 4, '#ffd23f'); b.rect(8, 9, 2, 6, '#e0315f'); b.set(6, 8, '#1b1430'); b.set(12, 8, '#1b1430');
  }, '#120814');
  D.star = [0, 1].map(f => mk(9, 9, b => {
    const c = f ? '#ffffff' : '#ffd23f';
    b.rect(4, 0, 1, 9, c); b.rect(0, 4, 9, 1, c); b.rect(3, 3, 3, 3, c);
  }, null));
  return D;
}
