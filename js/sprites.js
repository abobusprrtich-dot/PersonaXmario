// Pixel art: hand-drawn string sprites + a few procedural ones (boss, tiles, backgrounds).

const TILE = 16;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function spriteFromRows(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const [c, ctx] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) console.warn('sprite row width mismatch', y, row);
    for (let x = 0; x < w; x++) {
      const col = pal[row[x]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

function flipCanvas(src) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function tintCanvas(src, color, alpha = 1) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Both directions: [right, left]
function pair(c) { return [c, flipCanvas(c)]; }

// ---------- Procedural pixel buffer (auto-outline) ----------
class PixelBuf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; return this.d[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  ellipse(cx, cy, rx, ry, c, test) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!test || test(x, y))) this.set(x, y, c);
      }
  }
  tri(a, b, d, c) {
    const minx = Math.floor(Math.min(a[0], b[0], d[0])), maxx = Math.ceil(Math.max(a[0], b[0], d[0]));
    const miny = Math.floor(Math.min(a[1], b[1], d[1])), maxy = Math.ceil(Math.max(a[1], b[1], d[1]));
    const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const p = [x + 0.5, y + 0.5];
      const d1 = sign(p, a, b), d2 = sign(p, b, d), d3 = sign(p, d, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) this.set(x, y, c);
    }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  }
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
  }
  map(fn) { this.d = this.d.map(fn); return this; }
  toCanvas() {
    const [cv, ctx] = makeCanvas(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) if (this.d[i]) {
      ctx.fillStyle = this.d[i]; ctx.fillRect(i % this.w, (i / this.w) | 0, 1, 1);
    }
    return cv;
  }
}

// ---------- Hero ----------
const HERO_HEAD = [
  '......KKKKK.....',
  '.....KCCCcCK....',
  '....KCCYYCCcK...',
  '....KCCCCCCCCKK.',
  '...KKKKKKKKKCCCK',
  '...KHHSSSSWESK..',
  '...KHHSSSSWESSK.',
  '...KHSSSSSSSSSK.',
  '....KSSSSSSKKK..',
];
const HERO_BODIES = {
  stand: [
    '....KKSSSSSK....',
    '...KTTTTTTTTK...',
    '..KTTtTTTTtTTK..',
    '..KSKTTYTTTKSK..',
    '...KTTTTTTTTK...',
    '...KPPPKKPPPK...',
    '..KBBBBK.KBBBBK.',
  ],
  run1: [
    '....KKSSSSSK....',
    '...KTTTTTTTTKSK.',
    '..KTTtTTTTTTTK..',
    '.KSKTTTYTTTK....',
    '...KTTTTTTTK....',
    '..KPPPK.KPPPK...',
    '.KBBBK...KBBBBK.',
  ],
  run2: [
    '....KKSSSSSK....',
    '...KTTTTTTTTK...',
    '..KTTtTTTTtTK...',
    '...KSTTYTTTSK...',
    '....KTTTTTTK....',
    '.....KPPPPK.....',
    '.....KBBBBBK....',
  ],
  run3: [
    '....KKSSSSSK....',
    '...KTTTTTTTTK...',
    '..KTTtTTTTtTTK..',
    '..KSKTTYTTTKSK..',
    '...KTTTTTTTTK...',
    '...KPPK..KPPK...',
    '..KBBBK..KBBBK..',
  ],
  jump: [
    '....KKSSSSSK.KSK',
    '...KTTTTTTTTKTK.',
    '..KTTtTTTTTTTK..',
    '..KSKTTYTTTTK...',
    '...KTTTTTTTTK...',
    '..KPPPKKKPPPPK..',
    '.KBBBK.....KBBK.',
  ],
};
const HERO_PAL = {
  K: '#1b1430', C: '#8a3ffc', c: '#c08cff', Y: '#ffd23f', H: '#3b2416',
  S: '#f5c09a', W: '#ffffff', E: '#1b1430', T: '#19b394', t: '#0f7d68',
  P: '#2f3e8f', B: '#6b3a1f',
};
const HERO_PAL_POWER = Object.assign({}, HERO_PAL, {
  T: '#eaf6ff', t: '#7ad7ff', P: '#8a3ffc', C: '#19b394', c: '#7af0d0', Y: '#ff4fa3',
});

// ---------- Enemies & items ----------
const BUG_TOP = [
  '..K..........K..',
  '...K........K...',
  '....KKKKKKKK....',
  '...KRRRRRRRRK...',
  '..KRRrRRRRrRRK..',
  '.KRRRRRKKRRRRRK.',
  '.KRrRRRKKRRRrRK.',
  'KRRRRRRKKRRRRRRK',
  'KKKKKKKKKKKKKKKK',
  '.KFFFFFFFFFFFFK.',
  '.KFWWEFFFFEWWFK.',
  '.KFWWEFFFFEWWFK.',
  '..KFFFMFFMFFFK..',
  '...KKKKKKKKKK...',
];
const BUG_LEGS = [
  ['..KLK.K..K.KLK..', '.KLLK......KLLK.'],
  ['...KLK....KLK...', '....KLLK.KLLK...'],
];
const BUG_FLAT = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '................', '................',
  '....KKKKKKKK....',
  '..KRRRRRRRRRRK..',
  '.KRrRRRKKRRRrRK.',
  'KKKKKKKKKKKKKKKK',
  '.KFWEFFFFFFEWFK.',
  '..KKKKKKKKKKKK..',
];
const BUG_PAL = { K: '#1b1430', R: '#e0315f', r: '#ff8fb0', F: '#4a3a6a', W: '#ffffff', E: '#1b1430', M: '#ffffff', L: '#1b1430' };

const DRONE_A = [
  '................',
  '..KKK....KKK....',
  '.KWWWK..KWWWK...',
  '.KWWWWKKWWWWK...',
  '..KWWWKKWWWK....',
  '...KKKKKKKK.....',
  '..KVVVVVVVVK....',
  '.KVVVVVVWWEVK...',
  '.KVvVVVVWWEVVK..',
  '.KVVVVVVVVVVVK..',
  '..KVvVVvVVvVK...',
  '...KKKKKKKKK....',
  '....K..K..K.....',
  '................',
  '................',
  '................',
];
const DRONE_B = [
  '................',
  '................',
  '................',
  '................',
  '...KKKKKKKK.....',
  '.KKKKKKKKKKKK...',
  'KWWWVVVVVVKWWK..',
  'KWWVVVVVWWEVWK..',
  '.KVvVVVVWWEVVK..',
  '.KVVVVVVVVVVVK..',
  '..KVvVVvVVvVK...',
  '...KKKKKKKKK....',
  '....K..K..K.....',
  '................',
  '................',
  '................',
];
const DRONE_PAL = { K: '#1b1430', W: '#d8f3ff', V: '#5d6cff', v: '#2b2f9f', E: '#1b1430' };

const UNO = [
  '................',
  '................',
  '.KKKKKKKKKKKKKK.',
  '.KBBBBBBBBBBBBK.',
  '.KBYYBYYBYYBYBK.',
  '.KBBBBBBBBBBBBK.',
  '.KBKKKKKKBBBWBK.',
  '.KBKGGGGKBBBBBK.',
  '.KBKKKKKKBBRRBK.',
  '.KBBBBBBBBBBBBK.',
  '.KWBBBBBBBBBBBK.',
  '.KBYYYYBBYYYYBK.',
  '.KBBBBBBBBBBBBK.',
  '.KKKKKKKKKKKKKK.',
  '................',
  '................',
];
const UNO_PAL = { K: '#0d1b2a', B: '#1f8ad6', Y: '#ffe08a', G: '#9aa6b2', W: '#7dffb5', R: '#ff5a5a' };

const COIN_ROWS = [
  '..KKKK..',
  '.KYYYYK.',
  'KYYWYYyK',
  'KYWYYYyK',
  'KYWYYYyK',
  'KYWYYYyK',
  'KYWYYYyK',
  'KYYYYYyK',
  'KYYYYYyK',
  'KYYYYyyK',
  '.KyyyyK.',
  '..KKKK..',
];
const COIN_PAL = { K: '#5a3200', Y: '#ffd23f', y: '#e09a00', W: '#fff6c8' };

function buildBossSprite(frame) {
  const b = new PixelBuf(48, 44);
  const O = '#f08a2c', o = '#c25e14', P = '#6a2bb8', p = '#4a1a86', R = '#f3e3b0', Cc = '#ffe7a8', cd = '#d9b46a';
  const Y = '#ffd23f', W = '#ffffff', Rd = '#e8293b', Mn = '#d4224a', D = '#2a0f18';
  const legOff = frame === 'walkB' ? 1 : 0;
  // tail
  b.tri([40, 30], [47, 35], [40, 36], O);
  // shell (rim + body)
  b.ellipse(30, 22, 13, 13, R);
  b.ellipse(30, 21, 11.5, 11.5, P);
  for (const [x, y] of [[26, 15], [33, 16], [29, 23], [36, 24], [23, 22]]) b.ellipse(x, y, 2.5, 2, p);
  // spikes
  for (const deg of [-165, -130, -95, -60, -25]) {
    const a = deg * Math.PI / 180, nx = Math.cos(a), ny = Math.sin(a);
    const bx = 30 + nx * 11.5, by = 22 + ny * 11.5, tx = 30 + nx * 19, ty = 22 + ny * 19;
    b.tri([bx - ny * 3.2, by + nx * 3.2], [bx + ny * 3.2, by - nx * 3.2], [tx, ty], Y);
    b.set(Math.round(tx - nx), Math.round(ty - ny), W);
  }
  // legs
  b.rect(17 - legOff, 35 + legOff, 7, 7 - legOff, O);
  b.rect(30 + legOff, 35 - legOff, 7, 7 + legOff, O);
  b.rect(15 - legOff, 41, 3, 1, W); b.rect(28 + legOff, 41, 3, 1, W);
  // belly
  b.ellipse(19, 29, 9, 9.5, Cc);
  for (const y of [24, 27, 30, 33, 36]) for (let x = 11; x < 28; x++) if (b.get(x, y) === Cc) b.set(x, y, cd);
  // arm
  b.ellipse(16, 28, 3.2, 4.2, O);
  b.set(13, 32, W); b.set(15, 33, W); b.set(17, 32, W);
  // mane
  b.tri([16, 6], [23, 10], [26, 3], Mn);
  b.tri([18, 11], [25, 14], [28, 8], Mn);
  b.tri([18, 15], [24, 19], [27, 14], Mn);
  // head + snout
  b.ellipse(12.5, 14, 9, 8, O);
  b.rect(3, 14, 11, 6, O);
  b.ellipse(5, 17, 4.5, 3.5, O);
  for (let x = 6; x < 18; x++) if (b.get(x, 20) === O) b.set(x, 20, o);
  // mouth
  if (frame === 'open') {
    b.rect(1, 17, 10, 6, D);
    b.rect(1, 23, 11, 2, O);
    b.set(2, 17, W); b.set(4, 17, W); b.set(6, 17, W); b.set(3, 22, W); b.set(5, 22, W);
    b.rect(2, 19, 6, 2, '#ff7a1a');
  } else {
    b.line(1, 18, 10, 18, D);
    b.set(3, 17, W); b.set(6, 17, W); b.set(4, 19, W); b.set(8, 19, W);
  }
  b.set(3, 14, D); // nostril
  // eye
  b.rect(8, 10, 4, 3, W);
  b.rect(8, 11, 2, 2, Rd);
  b.line(7, 9, 13, 8, D);
  // horn
  b.tri([14, 8], [18, 8], [20, 1], W);
  // crown
  b.rect(6, 4, 8, 3, Y);
  b.tri([6, 4], [8, 4], [7, 0], Y);
  b.tri([9, 4], [11, 4], [10, -1], Y);
  b.tri([12, 4], [14, 4], [13, 0], Y);
  b.rect(9, 5, 2, 1, Rd);
  b.outline('#1b0a14');
  if (frame === 'hurt') b.map(c => c ? (c === '#1b0a14' ? '#ffffff' : '#ffd6e0') : null);
  return b.toCanvas();
}

function buildSwitch(on) {
  const b = new PixelBuf(16, 24);
  b.rect(3, 16, 10, 8, '#6d6d8a'); b.rect(4, 17, 8, 2, '#a5a5c8');
  b.rect(5, 20, 6, 2, on ? '#2bd96b' : '#ff3b5c');
  if (on) { b.line(8, 16, 13, 6, '#c9c9e0'); b.ellipse(13, 5, 3, 3, '#2bd96b'); }
  else { b.line(8, 16, 3, 6, '#c9c9e0'); b.ellipse(3, 5, 3, 3, '#ff3b5c'); }
  b.outline('#120a1c');
  return b.toCanvas();
}

function buildFlag() {
  const b = new PixelBuf(16, 14);
  b.tri([0, 0], [15, 6], [0, 13], '#8a3ffc');
  b.ellipse(5, 6.5, 3, 3, '#ffd23f');
  b.set(4, 5, '#fff6c8');
  return b.toCanvas();
}

function buildSpring(squash) {
  const b = new PixelBuf(16, 16);
  const top = squash ? 8 : 2;
  b.rect(1, top, 14, 3, '#ff3b5c'); b.rect(1, 13, 14, 3, '#ff3b5c');
  for (let y = top + 3; y < 13; y += 2) b.rect(4, y, 8, 1, '#c9c9e0');
  b.rect(2, top, 12, 1, '#ff9aae');
  return b.toCanvas();
}

// ---------- Tiles ----------
// Tile ids
const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QPOWER: 4, USED: 5, SOLID: 6,
  PIPE_TL: 7, PIPE_TR: 8, PIPE_L: 9, PIPE_R: 10, SEMI: 11, LAVA: 12, BRIDGE: 13,
  INFO: 14, COIN: 15, SPIKES: 16, PIPE_BL: 17, PIPE_BR: 18, STONE: 19, CHAIN: 20,
};
const SOLID_TILES = new Set([T.GROUND, T.BRICK, T.QCOIN, T.QPOWER, T.USED, T.SOLID, T.PIPE_TL, T.PIPE_TR,
  T.PIPE_L, T.PIPE_R, T.BRIDGE, T.INFO, T.PIPE_BL, T.PIPE_BR, T.STONE]);

const THEMES = {
  fields: {
    name: 'fields',
    ground: ['#4ccf4c', '#2e9a3a', '#c7773a', '#8f4f22', '#e3a066'],
    brick: ['#c9622f', '#6e2a10', '#f2a273'],
    solid: ['#d79a5e', '#8f5a2a', '#f3c999'],
    semi: ['#ffffff', '#b9dcff', '#7aa7e0'],
    stone: ['#9a9ab8', '#5b5b7a', '#c8c8e0'],
  },
  cavern: {
    name: 'cavern',
    ground: ['#36c37a', '#1f7a4a', '#145a36', '#0c3d24', '#d9a441'],
    brick: ['#232733', '#0d0f16', '#5a6275'],
    solid: ['#1f7a4a', '#0c3d24', '#5fe0a0'],
    semi: ['#d9a441', '#8a5d17', '#ffe08a'],
    stone: ['#2f6b4f', '#163a2a', '#5fa888'],
  },
  sky: {
    name: 'sky',
    ground: ['#f2d7ff', '#b07fe0', '#7a5aa8', '#4f3a78', '#a98ad6'],
    brick: ['#8a4fd0', '#3f1a6e', '#c9a0ff'],
    solid: ['#b9a0e6', '#6a4fa0', '#e6dcff'],
    semi: ['#ffffff', '#f2d7ff', '#c5a3f0'],
    stone: ['#8a86b0', '#4e4a78', '#c0bce0'],
  },
  castle: {
    name: 'castle',
    ground: ['#a09cb8', '#5a5678', '#7e7a98', '#4a4666', '#b8b4d0'],
    brick: ['#7e7a98', '#3a3654', '#b8b4d0'],
    solid: ['#a09cb8', '#4a4666', '#d0cce8'],
    semi: ['#a09cb8', '#4a4666', '#d0cce8'],
    stone: ['#7e7a98', '#3a3654', '#b8b4d0'],
  },
  room: {
    name: 'room',
    ground: ['#3d7bd9', '#1d3f80', '#2c5aa8', '#15306a', '#6aa0ff'],
    brick: ['#2c5aa8', '#0e1f4a', '#6aa0ff'],
    solid: ['#3d7bd9', '#15306a', '#8ab8ff'],
    semi: ['#6aa0ff', '#1d3f80', '#b0d0ff'],
    stone: ['#2c5aa8', '#0e1f4a', '#6aa0ff'],
  },
};

function tile(fn) {
  const [c, ctx] = makeCanvas(TILE, TILE);
  const p = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  fn(p, r, ctx);
  return c;
}

// deterministic noise for speckles
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

function buildTileset(themeName) {
  const th = THEMES[themeName];
  const [g1, g2, d1, d2, sp] = th.ground;
  const set = {};
  const isCavern = themeName === 'cavern';

  // ground fill / top
  set.groundFill = tile((p, r) => {
    r(0, 0, 16, 16, d1);
    if (isCavern) {
      r(0, 0, 16, 16, g2);
      r(3, 0, 1, 16, sp); r(3, 7, 9, 1, sp); r(11, 7, 1, 9, sp);
      r(2, 6, 3, 3, sp); r(10, 6, 3, 3, sp); p(3, 7, g2); p(11, 7, g2);
      r(0, 15, 16, 1, d2);
    } else {
      for (let i = 0; i < 9; i++) { const x = (hash(i, 3) * 14) | 0, y = (hash(i, 7) * 14) | 0; r(x, y, 2, 1, i % 3 ? d2 : sp); }
    }
  });
  set.groundTop = tile((p, r, ctx) => {
    ctx.drawImage(set.groundFill, 0, 0);
    if (isCavern) {
      r(0, 0, 16, 3, g1); r(0, 3, 16, 1, d2);
      p(2, 1, '#ffe08a'); p(8, 1, '#ffe08a'); p(14, 1, '#ffe08a');
    } else {
      r(0, 0, 16, 4, g1); r(0, 0, 16, 1, '#ffffff33');
      for (let x = 0; x < 16; x++) { const h = 4 + ((hash(x, 1) * 3) | 0) % 3; r(x, 4, 1, h - 4, g1); p(x, h, g2); }
      p(3, 1, g2); p(10, 2, g2);
    }
  });
  // brick
  set.brick = tile((p, r) => {
    const [b, m, l] = th.brick;
    if (isCavern) { // IC chip
      r(0, 0, 16, 16, m); r(2, 2, 12, 12, b); r(3, 3, 3, 3, l);
      for (let i = 0; i < 4; i++) { r(0, 3 + i * 3, 2, 1, '#c9c9d6'); r(14, 3 + i * 3, 2, 1, '#c9c9d6'); }
      r(6, 9, 6, 1, l); return;
    }
    r(0, 0, 16, 16, b);
    r(0, 0, 16, 1, m); r(0, 7, 16, 1, m); r(0, 15, 16, 1, m);
    r(7, 0, 1, 7, m); r(15, 0, 1, 7, m); r(3, 8, 1, 7, m); r(11, 8, 1, 7, m);
    r(0, 1, 7, 1, l); r(8, 1, 7, 1, l); r(4, 8, 7, 1, l); r(12, 8, 3, 1, l); r(0, 8, 3, 1, l);
  });
  // question blocks (3 shimmer frames)
  const qcols = [['#ffb800', '#ffe08a'], ['#ffc933', '#fff1b8'], ['#e6a000', '#ffd060']];
  set.q = qcols.map(([base, hi]) => tile((p, r) => {
    r(0, 0, 16, 16, '#5a3200'); r(1, 1, 14, 14, base); r(1, 1, 14, 1, hi); r(1, 1, 1, 14, hi);
    p(2, 2, '#5a3200'); p(13, 2, '#5a3200'); p(2, 13, '#5a3200'); p(13, 13, '#5a3200');
    // ?
    const q = ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'];
    q.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') { r(5 + x, 4 + y, 1, 1, '#ffffff'); p(6 + x, 5 + y, '#8f4f00'); } }));
    q.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') r(5 + x, 4 + y, 1, 1, '#ffffff'); }));
  }));
  set.used = tile((p, r) => {
    r(0, 0, 16, 16, '#3a1f0a'); r(1, 1, 14, 14, '#9a5a2a'); r(1, 1, 14, 1, '#c07a40');
    p(2, 2, '#3a1f0a'); p(13, 2, '#3a1f0a'); p(2, 13, '#3a1f0a'); p(13, 13, '#3a1f0a');
  });
  // info block ("!" block) — 2 glow frames + read version
  const infoTile = (base, hi, mark) => tile((p, r) => {
    r(0, 0, 16, 16, '#1b0a3a'); r(1, 1, 14, 14, base); r(1, 1, 14, 1, hi); r(1, 1, 1, 14, hi);
    r(2, 14, 12, 1, '#00000055');
    if (mark === '!') { r(7, 3, 2, 7, '#ffffff'); r(7, 11, 2, 2, '#ffffff'); r(9, 4, 1, 6, '#00000044'); }
    else { // check mark
      [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]].forEach(([x, y]) => r(x, y, 2, 2, '#ffffff'));
    }
  });
  set.info = [infoTile('#8a3ffc', '#c08cff', '!'), infoTile('#a35cff', '#e0c4ff', '!')];
  set.infoRead = infoTile('#19b394', '#7af0d0', 'v');
  // solid / stair block
  set.solid = tile((p, r) => {
    const [b, d, l] = th.solid;
    r(0, 0, 16, 16, b); r(0, 0, 16, 1, l); r(0, 0, 1, 16, l); r(15, 0, 1, 16, d); r(0, 15, 16, 1, d);
    r(1, 1, 14, 1, l); r(1, 1, 1, 14, l); r(14, 1, 1, 14, d); r(1, 14, 14, 1, d);
  });
  set.stone = tile((p, r) => {
    const [b, d, l] = th.stone;
    r(0, 0, 16, 16, b); r(0, 7, 16, 1, d); r(0, 15, 16, 1, d); r(5, 0, 1, 7, d); r(12, 8, 1, 7, d);
    r(0, 0, 16, 1, l); r(0, 8, 16, 1, l);
  });
  // pipes: shared green palette everywhere
  const PG = ['#0b3d12', '#1e7a2a', '#2fae3c', '#7de87a', '#c9ffc0'];
  const pipeCol = (x, w) => { // color for column x across width w
    if (x === 0 || x === w - 1) return PG[0];
    const t = x / w;
    if (t < 0.12) return PG[2];
    if (t < 0.22) return PG[3];
    if (t < 0.28) return PG[4];
    if (t < 0.5) return PG[2];
    if (t < 0.8) return PG[1];
    return t < 0.9 ? PG[1] : PG[0];
  };
  const pipeTop = (half, flipV) => tile((p, r, ctx) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const gx = half * 16 + x, ly = flipV ? 15 - y : y;
      let col = null;
      if (ly < 14) col = (ly === 0 || ly === 13) ? PG[0] : pipeCol(gx, 32);
      else { const bx = gx - 2; if (bx >= 0 && bx < 28) col = pipeCol(bx, 28); }
      if (col) p(x, y, col);
    }
  });
  const pipeBody = (half) => tile((p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const bx = half * 16 + x - 2; if (bx >= 0 && bx < 28) p(x, y, pipeCol(bx, 28));
    }
  });
  set.pipeTL = pipeTop(0, false); set.pipeTR = pipeTop(1, false);
  set.pipeBL = pipeTop(0, true); set.pipeBR = pipeTop(1, true);
  set.pipeL = pipeBody(0); set.pipeR = pipeBody(1);
  // semi-solid platform (clouds / copper girders)
  set.semi = tile((p, r) => {
    const [a, b, c] = th.semi;
    if (isCavern) { r(0, 0, 16, 5, b); r(0, 0, 16, 1, c); r(0, 1, 16, 3, a); for (let x = 1; x < 16; x += 4) r(x, 2, 2, 1, b); return; }
    if (themeName === 'castle') { r(0, 0, 16, 5, a); r(0, 0, 16, 1, c); r(0, 4, 16, 1, b); return; }
    r(0, 2, 16, 6, a); r(2, 0, 5, 2, a); r(9, 1, 6, 1, a); r(0, 6, 16, 2, b); r(1, 8, 14, 1, c); p(3, 1, c);
  });
  // lava (2 frames) top/fill
  set.lavaTop = [0, 1].map(f => tile((p, r) => {
    r(0, 0, 16, 16, '#d1260f'); r(0, 4, 16, 12, '#a3150a');
    for (let x = 0; x < 16; x++) { const h = 2 + Math.round(Math.sin((x + f * 4) * 0.8) * 1.5); r(x, h, 1, 2, '#ff8a1a'); r(x, h, 1, 1, '#ffe14a'); }
    r(0, 0, 16, 1, '#00000000');
  }));
  set.lavaFill = [0, 1].map(f => tile((p, r) => {
    r(0, 0, 16, 16, '#a3150a'); p((3 + f * 5) % 16, 5, '#ff5a1a'); p((11 + f * 3) % 16, 11, '#ff5a1a');
  }));
  set.bridge = tile((p, r) => {
    r(0, 0, 16, 6, '#8f4f22'); r(0, 0, 16, 1, '#e3a066'); r(0, 5, 16, 1, '#3a1f0a');
    for (let x = 3; x < 16; x += 5) r(x, 1, 1, 4, '#5a2f12');
  });
  set.chain = tile((p, r) => {
    for (let i = 0; i < 4; i++) { r(i * 4 + 1, 14 - i * 4, 3, 2, '#c9c9e0'); p(i * 4 + 2, 14 - i * 4, '#6d6d8a'); }
  });
  set.spikes = tile((p, r) => {
    for (let k = 0; k < 2; k++) for (let y = 0; y < 8; y++) {
      const w = y + 1; r(k * 8 + 4 - Math.ceil(w / 2), 8 + y, w, 1, y < 2 ? '#ffffff' : '#b8b8d0');
    }
    r(0, 15, 16, 1, '#5b5b7a');
  });
  // coins (4 spin frames)
  const coinFull = spriteFromRows(COIN_ROWS, COIN_PAL);
  set.coin = [8, 6, 2, 6].map(w => tile((p, r, ctx) => {
    ctx.drawImage(coinFull, 0, 0, 8, 12, 8 - w / 2, 2, w, 12);
  }));
  return set;
}

// ---------- Backgrounds (pre-rendered parallax strips, 512px wide) ----------
function buildBackground(themeName) {
  const W = 512, H = 224;
  const layers = [];
  const strip = (fn) => { const [c, ctx] = makeCanvas(W, H); fn(ctx); return c; };
  const px = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

  if (themeName === 'fields') {
    layers.push({ speed: 0.12, img: strip(ctx => { // clouds
      for (const [cx, cy, s] of [[40, 40, 1], [200, 24, 1.3], [330, 56, 0.9], [440, 30, 1.1]]) cloud(ctx, cx, cy, s);
    }) });
    layers.push({ speed: 0.3, img: strip(ctx => { // far hills
      for (const [cx, w, h] of [[60, 140, 70], [250, 180, 95], [430, 150, 60]]) hill(ctx, cx, 224, w, h, '#5fbf6a', '#3f9a50');
    }) });
    layers.push({ speed: 0.55, img: strip(ctx => { // near hills/bushes
      for (const [cx, w, h] of [[150, 120, 44], [380, 90, 34]]) hill(ctx, cx, 224, w, h, '#2fae3c', '#1e7a2a');
      // tiny sprinklers / crops: smart irrigation nod
      for (let x = 20; x < 512; x += 64) { px(ctx, x, 200, 2, 6, '#1e7a2a'); px(ctx, x - 2, 198, 6, 2, '#3fd04a'); }
    }) });
  } else if (themeName === 'cavern') {
    layers.push({ speed: 0.2, img: strip(ctx => {
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 26; i++) { // traces
        const y = 8 + ((hash(i, 2) * 200) | 0), x0 = (hash(i, 5) * 512) | 0, len = 40 + ((hash(i, 9) * 160) | 0);
        px(ctx, x0, y, len, 1, '#2f8f5a');
        px(ctx, x0 + len, y, 1, 24, '#2f8f5a');
        px(ctx, x0 - 1, y - 1, 3, 3, '#d9a441'); px(ctx, x0 + len - 1, y + 23, 3, 3, '#d9a441');
      }
      ctx.globalAlpha = 1;
    }) });
    layers.push({ speed: 0.4, img: strip(ctx => { // big chips
      for (const [x, y, w, h] of [[60, 60, 70, 40], [260, 110, 90, 50], [420, 40, 50, 60]]) {
        ctx.globalAlpha = 0.6;
        px(ctx, x, y, w, h, '#0e1a14'); px(ctx, x + 2, y + 2, w - 4, h - 4, '#16261e');
        for (let i = 4; i < w - 4; i += 6) { px(ctx, x + i, y - 4, 2, 4, '#5a6275'); px(ctx, x + i, y + h, 2, 4, '#5a6275'); }
        px(ctx, x + 5, y + 5, 3, 3, '#2a3a32');
        ctx.globalAlpha = 1;
      }
    }) });
  } else if (themeName === 'sky') {
    layers.push({ speed: 0.08, img: strip(ctx => {
      for (let i = 0; i < 60; i++) { const x = (hash(i, 11) * 512) | 0, y = (hash(i, 13) * 150) | 0; px(ctx, x, y, 1, 1, i % 5 ? '#ffffffaa' : '#ffd23f'); }
      ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(380, 50, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d8c0'; ctx.fillRect(372, 44, 5, 4); ctx.fillRect(386, 56, 4, 3);
    }) });
    layers.push({ speed: 0.25, img: strip(ctx => {
      for (const [cx, cy, s] of [[80, 150, 1.4], [260, 170, 1.8], [450, 160, 1.3]]) cloud(ctx, cx, cy, s, '#f2d7ff', '#c5a3f0');
    }) });
    layers.push({ speed: 0.45, img: strip(ctx => { // distant towers
      for (const [x, w, h] of [[30, 30, 90], [160, 22, 120], [300, 36, 80], [440, 26, 110]]) {
        px(ctx, x, 224 - h, w, h, '#3d2470'); px(ctx, x - 3, 224 - h, w + 6, 6, '#3d2470');
        for (let i = 0; i < w + 6; i += 6) px(ctx, x - 3 + i, 224 - h - 4, 3, 4, '#3d2470');
        px(ctx, x + w / 2 - 2, 224 - h + 16, 4, 7, '#ffd23f');
      }
    }) });
  } else if (themeName === 'castle') {
    layers.push({ speed: 0.3, img: strip(ctx => {
      for (let x = 0; x < 512; x += 128) {
        px(ctx, x + 20, 0, 24, 224, '#24152e'); px(ctx, x + 22, 0, 2, 224, '#2e1c3a');
        px(ctx, x + 80, 60, 12, 20, '#0d0712'); px(ctx, x + 82, 62, 8, 6, '#ff7a1a33');
      }
      for (let i = 0; i < 40; i++) px(ctx, (hash(i, 21) * 512) | 0, (hash(i, 23) * 224) | 0, 6, 3, '#21142a');
    }) });
  } else { // room
    layers.push({ speed: 0.15, img: strip(ctx => {
      for (let y = 0; y < 224; y += 16) for (let x = 0; x < 512; x += 32) {
        const ox = (y / 16) % 2 ? 16 : 0;
        px(ctx, x + ox, y, 31, 15, '#101a33');
      }
    }) });
  }
  return layers;

  function cloud(ctx, cx, cy, s, a = '#ffffff', b = '#b9dcff') {
    const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(r), 0, Math.PI * 2); ctx.fill(); };
    blob(cx - 14 * s, cy + 3 * s, 9 * s, b); blob(cx + 14 * s, cy + 3 * s, 9 * s, b); blob(cx, cy + 2, 12 * s, b);
    blob(cx - 14 * s, cy + 1 * s, 8 * s, a); blob(cx + 14 * s, cy + 1 * s, 8 * s, a); blob(cx, cy - 3 * s, 11 * s, a);
  }
  function hill(ctx, cx, base, w, h, col, dark) {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(cx, base, w / 2 + 2, h + 2, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, base, w / 2, h, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    for (const [dx, dy] of [[-0.2, 0.5], [0.15, 0.35], [0.05, 0.7]]) ctx.fillRect(Math.round(cx + dx * w), Math.round(base - h * dy), 3, 5);
  }
}

// ---------- Build everything ----------
const SPR = {};
function buildSprites() {
  const heroFrames = (pal) => {
    const out = {};
    for (const k of Object.keys(HERO_BODIES)) out[k] = pair(spriteFromRows([...HERO_HEAD, ...HERO_BODIES[k]], pal));
    return out;
  };
  SPR.hero = heroFrames(HERO_PAL);
  SPR.heroPower = heroFrames(HERO_PAL_POWER);
  SPR.bug = BUG_LEGS.map(([a, b]) => pair(spriteFromRows([...BUG_TOP, a, b], BUG_PAL)));
  SPR.bugFlat = spriteFromRows(BUG_FLAT, BUG_PAL);
  SPR.drone = [pair(spriteFromRows(DRONE_A, DRONE_PAL)), pair(spriteFromRows(DRONE_B, DRONE_PAL))];
  SPR.uno = spriteFromRows(UNO, UNO_PAL);
  SPR.coin = spriteFromRows(COIN_ROWS, COIN_PAL);
  SPR.boss = {};
  for (const f of ['walkA', 'walkB', 'open', 'hurt']) SPR.boss[f] = pair(buildBossSprite(f)); // [right, left] -> art faces left
  SPR.switchOff = buildSwitch(false); SPR.switchOn = buildSwitch(true);
  SPR.flag = buildFlag();
  SPR.spring = [buildSpring(false), buildSpring(true)];
  SPR.tiles = {}; SPR.bg = {};
  for (const th of Object.keys(THEMES)) { SPR.tiles[th] = buildTileset(th); SPR.bg[th] = buildBackground(th); }
}
