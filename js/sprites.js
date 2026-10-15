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
  SPR.deco = buildDecor();
}
