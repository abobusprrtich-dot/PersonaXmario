// Level data, built with a small builder API so layouts stay readable.
// Grid is 14 rows tall (224px); ground top sits on row 12.

const ROWS = 14;
const GY = 12;

class LevelBuilder {
  constructor(opts) {
    Object.assign(this, { theme: 'fields', music: 'fields', ceiling: false }, opts);
    this.tiles = Array.from({ length: ROWS }, () => new Array(this.w).fill(T.EMPTY));
    this.entities = []; this.pipes = []; this.texts = []; this.boards = [];
    this.start = { x: 2, y: GY - 1 };
  }
  set(x, y, t) { if (x >= 0 && x < this.w && y >= 0 && y < ROWS) this.tiles[y][x] = t; }
  get(x, y) { return (x >= 0 && x < this.w && y >= 0 && y < ROWS) ? this.tiles[y][x] : T.EMPTY; }
  fill(x, y, w, h, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, t); return this; }
  ground(x0, x1, top = GY) { return this.fill(x0, top, x1 - x0, ROWS - top, T.GROUND); }
  gap(x0, x1) { return this.fill(x0, 0, x1 - x0, ROWS, T.EMPTY); }
  // chars: B brick, ? coin block, P power block, U used, S solid, # stone, o coin, - semi, = bridge, ^ spikes, L lava, G ground
  row(x, y, str) {
    const map = { B: T.BRICK, '?': T.QCOIN, P: T.QPOWER, U: T.USED, S: T.SOLID, '#': T.STONE, o: T.COIN, '-': T.SEMI, '=': T.BRIDGE, '^': T.SPIKES, L: T.LAVA, G: T.GROUND };
    [...str].forEach((ch, i) => { if (map[ch] !== undefined) this.set(x + i, y, map[ch]); });
    return this;
  }
  coins(x, y, n) { for (let i = 0; i < n; i++) this.set(x + i, y, T.COIN); return this; }
  pipe(x, h, section, base = GY) {
    const top = base - h;
    this.set(x, top, T.PIPE_TL); this.set(x + 1, top, T.PIPE_TR);
    for (let y = top + 1; y < base; y++) { this.set(x, y, T.PIPE_L); this.set(x + 1, y, T.PIPE_R); }
    this.pipes.push({ x, top, section, exit: !section });
    return this;
  }
  stairs(x, n, dir = 1, base = GY) {
    for (let i = 0; i < n; i++) {
      const h = dir > 0 ? i + 1 : n - i;
      this.fill(x + i, base - h, 1, h, T.SOLID);
    }
    return this;
  }
  add(type, x, y, extra = {}) { this.entities.push(Object.assign({ type, x: x * TILE, y: y * TILE }, extra)); return this; }
  text(x, y, str, color = '#fff') { this.texts.push({ x: x * TILE, y: y * TILE, str, color }); return this; }
  build() {
    return {
      id: this.id, name: this.name, title: this.title, theme: this.theme, music: this.music, w: this.w,
      tiles: this.tiles, entities: this.entities, pipes: this.pipes, texts: this.texts, boards: this.boards,
      start: { x: this.start.x * TILE + 2, y: this.start.y * TILE }, sky: this.sky, isRoom: !!this.isRoom,
      section: this.section, next: this.next, arena: this.arena, ceiling: this.ceiling,
    };
  }
}

// ---------------- 1-1 GULISTON FIELDS ----------------
function buildLevel1() {
  const L = new LevelBuilder({ id: 'L1', name: '1-1', title: 'GULISTON FIELDS', theme: 'fields', music: 'fields', w: 196, sky: ['#5fb8ff', '#a9dcff'], next: 'L2' });
  L.ground(0, 40).ground(43, 62).ground(65, 104).ground(108, 196);
  L.text(2, 3, "HI! I'M DILYOR.", '#ffffff').text(2, 4.2, 'THIS GAME IS MY CV.', '#fff6c8')
   .text(2, 5.4, 'GREEN PIPES = CHAPTERS', '#c9ffc0');
  // opening blocks
  L.row(10, 8, '?BPB?').row(12, 4, '?');
  L.add('bug', 17, GY - 1);
  // PART 1: about
  L.pipe(22, 2, 'about');
  L.add('bug', 30, GY - 1).add('bug', 32, GY - 1);
  L.row(28, 8, 'B?B').coins(34, 9, 3);
  // first pit
  L.coins(40, 8, 3);
  // stair pyramids with a gap
  L.stairs(46, 4, 1).stairs(52, 4, -1);
  L.gap(50, 52);
  L.coins(49, 6, 4);
  // cloud steps
  L.row(58, 8, '---').coins(58, 7, 3);
  L.gap(62, 65); L.row(62, 9, '---');
  // PART 2: education
  L.pipe(70, 3, 'education');
  L.add('bug', 76, GY - 1).add('drone', 80, 6, { range: 48 });
  L.add('spring', 84, GY - 1);
  L.coins(83, 2, 5);
  L.row(88, 8, 'B?BB?B').row(90, 4, 'BPB');
  L.add('bug', 92, GY - 1).add('bug', 94, GY - 1);
  L.row(98, 9, 'SS').row(99, 8, 'S');
  // wide gap with cloud bridge
  L.row(104, 9, '----').coins(104, 8, 4);
  L.add('checkpoint', 112, GY - 1);
  L.add('drone', 118, 7, { range: 64 });
  // PART 3: skills (tall pipe with a step)
  L.fill(123, GY - 2, 1, 2, T.SOLID);
  L.pipe(125, 4, 'skills');
  L.add('bug', 134, GY - 1).add('bug', 137, GY - 1).add('bug', 140, GY - 1);
  L.row(134, 8, '?B?B?').coins(135, 4, 3);
  L.add('drone', 150, 6, { range: 56 });
  L.row(146, 9, 'oooo').row(152, 7, 'B??B');
  // final staircase + flag
  L.stairs(166, 8, 1); L.fill(174, GY - 8, 1, 8, T.SOLID);
  L.add('flag', 182, GY - 1);
  L.text(178, 3, 'NEXT: CIRCUIT CAVERN', '#fff6c8');
  return L.build();
}

// ---------------- 2-1 CIRCUIT CAVERN ----------------
function buildLevel2() {
  const L = new LevelBuilder({ id: 'L2', name: '2-1', title: 'CIRCUIT CAVERN', theme: 'cavern', music: 'cavern', w: 210, sky: ['#071a12', '#0c2a1d'], next: 'L3', ceiling: true });
  L.fill(0, 0, 210, 1, T.STONE);
  L.ground(0, 34).ground(60, 72).ground(76, 120).ground(126, 128).ground(134, 210);
  L.text(3, 3, 'WELCOME TO THE LAB', '#7dffb5').text(3, 4.2, 'MIND THE SPARKS!', '#ffe08a');
  L.row(8, 8, 'B?B?B').add('bug', 14, GY - 1);
  L.row(12, 4, 'P');
  L.add('spark', 18, 9, { axis: 'x', range: 48, speed: 0.03 });
  // PART 4: Arduinium (the big one)
  L.pipe(24, 3, 'arduinium');
  // moving-platform crossing
  L.add('plat', 35, 9, { w: 3, axis: 'x', range: 64, speed: 0.012 });
  L.add('plat', 46, 7, { w: 3, axis: 'y', range: 48, speed: 0.016 });
  L.add('plat', 53, 9, { w: 3, axis: 'x', range: 40, speed: 0.02 });
  L.coins(46, 4, 3); L.fill(34, 13, 26, 1, T.SPIKES);
  L.row(42, 10, '--').row(50, 10, '--');
  L.add('bug', 66, GY - 1).add('bug', 68, GY - 1);
  L.row(62, 8, '?BB?');
  L.row(72, 10, '----');
  // PART 5: hardware lab
  L.pipe(80, 2, 'hardware');
  L.add('spark', 86, 6, { axis: 'y', range: 64, speed: 0.025 });
  L.row(90, 8, 'BBBBBBB').row(90, 4, 'B?B?B?B');
  L.add('bug', 92, 7).add('bug', 95, 7);
  L.add('drone', 100, 6, { range: 48 });
  L.coins(98, 10, 4);
  L.add('checkpoint', 106, GY - 1);
  L.stairs(112, 3, 1).fill(115, GY - 3, 4, 3, T.SOLID);
  L.add('spark', 112, 5, { axis: 'x', range: 96, speed: 0.02 });
  // chip islands over spike pits
  L.fill(120, 13, 6, 1, T.SPIKES).fill(128, 13, 6, 1, T.SPIKES);
  L.add('plat', 121, 9, { w: 2, axis: 'y', range: 40, speed: 0.025 });
  L.add('plat', 129, 8, { w: 2, axis: 'y', range: 40, speed: 0.025, phase: 1.6 });
  L.coins(126, 7, 2);
  // PART 6: experience
  L.pipe(140, 3, 'experience');
  L.add('bug', 148, GY - 1).add('bug', 150, GY - 1).add('drone', 156, 6, { range: 64 });
  L.row(150, 8, 'B?B?B?B');
  L.add('spark', 162, 10, { axis: 'x', range: 64, speed: 0.04 });
  L.add('spring', 170, GY - 1); L.coins(169, 3, 3);
  L.stairs(176, 6, 1); L.fill(182, GY - 6, 2, 6, T.SOLID);
  L.add('flag', 192, GY - 1);
  L.text(186, 3, 'NEXT: COMET HEIGHTS', '#7dffb5');
  return L.build();
}

// ---------------- 3-1 COMET HEIGHTS ----------------
function buildLevel3() {
  const L = new LevelBuilder({ id: 'L3', name: '3-1', title: 'COMET HEIGHTS', theme: 'sky', music: 'sky', w: 200, sky: ['#1a0b3d', '#7a2f8f'], next: 'BOSS' });
  L.ground(0, 30).ground(46, 58).ground(86, 120).ground(150, 162).ground(174, 200);
  L.text(3, 3, 'PURPLE COMETS FALL HERE', '#f2d7ff').text(3, 4.2, 'WATCH THE SKY!', '#ffd23f');
  L.row(9, 8, '?P?').add('comets', 6, 0, { x1: 140 * TILE });
  L.add('bug', 16, GY - 1).add('bug', 19, GY - 1);
  // PART 7: honors
  L.pipe(24, 2, 'honors');
  // cloud hopping
  L.row(31, 10, '---').row(36, 8, '---').row(41, 10, '---').coins(36, 7, 3);
  L.add('drone', 50, 7, { range: 48 });
  L.row(48, 8, 'B?B');
  L.add('plat', 59, 9, { w: 3, axis: 'x', range: 72, speed: 0.012 });
  L.row(66, 6, '---').coins(66, 5, 3).row(70, 8, '--');
  L.add('plat', 74, 8, { w: 3, axis: 'y', range: 56, speed: 0.018 });
  L.row(80, 9, '---').coins(80, 8, 3);
  L.add('checkpoint', 88, GY - 1);
  L.add('bug', 96, GY - 1).add('bug', 98, GY - 1).add('bug', 100, GY - 1);
  // PART 8: leadership
  L.pipe(104, 3, 'leadership');
  L.row(110, 8, '?B?B').add('drone', 114, 5, { range: 40 });
  L.add('spring', 118, GY - 1);
  // big sky gap
  L.row(122, 9, '----').row(130, 8, '---').row(137, 7, '---').row(143, 9, '----');
  L.coins(122, 8, 4); L.coins(137, 6, 3);
  L.add('drone', 132, 5, { range: 40 });
  L.add('plat', 162, 9, { w: 3, axis: 'x', range: 88, speed: 0.014 });
  L.stairs(178, 4, 1); L.fill(182, GY - 4, 2, 4, T.SOLID);
  L.add('door', 192, GY - 2);
  L.text(184, 3, "BUGZER'S CASTLE >", '#ff9aae');
  return L.build();
}

// ---------------- BOSS: BUGZER'S CASTLE ----------------
function buildBoss() {
  const L = new LevelBuilder({ id: 'BOSS', name: '3-B', title: "BUGZER'S CASTLE", theme: 'castle', music: 'boss', w: 110, sky: ['#120814', '#2a1030'], ceiling: true });
  L.fill(0, 0, 110, 2, T.STONE);
  L.ground(0, 14).fill(14, GY, 6, 2, T.LAVA).ground(20, 28).fill(28, GY, 5, 2, T.LAVA).ground(33, 40);
  L.text(2, 4, 'THE FINAL BUG AWAITS...', '#ff9aae');
  L.row(14, 9, '---').row(28, 9, '--');
  L.add('bubble', 16, GY, { delay: 0 }).add('bubble', 30, GY, { delay: 70 });
  L.fill(24, 7, 1, 1, T.USED).add('firebar', 24, 7, { len: 5, speed: 0.035 });
  L.row(36, 8, 'P');
  // arena: raised floor, bridge over lava
  const A = 50; // arena start tile
  L.fill(40, GY, 10, 2, T.GROUND).fill(40, 10, A - 40, 2, T.STONE);
  L.fill(A, 10, 18, 1, T.BRIDGE).fill(A, 11, 18, 3, T.EMPTY).fill(A, GY, 18, 2, T.LAVA);
  for (let x = A; x < A + 18; x++) L.set(x, 13, T.LAVA);
  L.fill(A + 18, 10, 30, 4, T.STONE);
  L.set(A + 17, 9, T.CHAIN);
  L.fill(A - 1, 2, 1, 4, T.STONE); // gate stub
  L.add('boss', A + 12, 7);
  L.add('switch', A + 19, 8.5);
  L.add('trophy', A + 26, 8);
  L.arena = { x0: (A - 6) * TILE, x1: (A + 18) * TILE, bridgeX0: A, bridgeX1: A + 18, cam: (A - 4) * TILE };
  return L.build();
}

// ---------------- Pipe rooms (one per CV section) ----------------
function buildRoom(sectionId) {
  const sec = SECTIONS[sectionId];
  const n = sec.parts.length;
  const w = Math.max(28, 12 + n * 7);
  const L = new LevelBuilder({ id: 'ROOM_' + sectionId, name: 'P' + sec.num, title: sec.title.toUpperCase(), theme: 'room', music: 'room', w, sky: ['#05060f', '#0b1230'], isRoom: true, section: sectionId, ceiling: true });
  L.fill(0, 0, w, 2, T.BRICK).ground(0, w);
  L.fill(0, 0, 1, ROWS, T.STONE).fill(w - 1, 0, 1, ROWS, T.STONE);
  // entry pipe hanging from the ceiling
  L.set(2, 0, T.PIPE_L); L.set(3, 0, T.PIPE_R); L.set(2, 1, T.PIPE_L); L.set(3, 1, T.PIPE_R);
  L.set(2, 2, T.PIPE_BL); L.set(3, 2, T.PIPE_BR);
  L.start = { x: 2.5, y: 3 };
  L.text(5, 2.6, `PART ${sec.num}: ${sec.title}`, '#ffd23f');
  L.text(5, 3.6, 'HIT THE ! BLOCKS TO READ', '#8ab8ff');
  sec.parts.forEach((part, i) => {
    const bx = 6 + i * 7;
    L.set(bx + 2, 8, T.INFO);
    L.boards.push({ x: bx * TILE, y: 72, w: 5 * TILE, h: 52, part: i, label: `${i + 1}/${n}`, tag: part.tag, cert: part.cert || null, bx: bx + 2 });
    if (i < n - 1) L.coins(bx + 5, 10, 2);
  });
  L.pipe(w - 5, 2, null);
  L.text(w - 6.4, 7.4, 'EXIT', '#c9ffc0');
  return L.build();
}

const LEVEL_BUILDERS = { L1: buildLevel1, L2: buildLevel2, L3: buildLevel3, BOSS: buildBoss };
const LEVEL_ORDER = ['L1', 'L2', 'L3', 'BOSS'];
