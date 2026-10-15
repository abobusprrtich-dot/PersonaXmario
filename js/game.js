// Game state machine, scripted sequences, HUD, overlays and the main loop.

function* wait(n) { for (let i = 0; i < n; i++) yield; }

const Game = {
  state: 'boot', time: 0, fade: 0, script: null,
  score: 0, coins: 0, combo: 0, deaths: 0, startedAt: 0,
  levelId: 'L1', stack: [], visited: new Set(), read: {},
  bossBeaten: false, bossFight: false, boss: null, banner: null, toast: null, card: null,
  pausedFrom: null,

  init() {
    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
    // the game draws into a 384x224 buffer; present() blows it up onto the visible screen with CRT/LCD effects
    this.view = document.getElementById('screen');
    this.vctx = this.view.getContext('2d');
    [this.canvas, this.ctx] = makeCanvas(VIEW_W, VIEW_H);
    this.fxMode = this.isTouch() ? 'lcd' : 'crt';
    try { const m = localStorage.getItem('px-fx'); if (['crt', 'lcd', 'clean'].includes(m)) this.fxMode = m; } catch (e) { /* storage blocked */ }
    buildSprites();
    this.certImgs = {};
    for (const [k, v] of Object.entries(CERTS)) { const im = new Image(); im.src = v.thumb; this.certImgs[k] = im; }
    UI.init();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    this.resize();
    Input.onKey(e => UI.onKey(e));
    // title backdrop
    this.world = new World(buildLevel1());
    this.player = new Player(this.world.def.start.x, this.world.def.start.y);
    this.player.hidden = true;
    this.state = 'boot'; this.bootT = 0;
    let last = performance.now(), acc = 0;
    const frame = now => {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= 1 / 60) { this.step(); acc -= 1 / 60; }
      this.render();
      this.present();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  // size the screen for the current layout: CRT monitor (desktop) or handheld (touch, portrait/landscape)
  resize() {
    const W = window.innerWidth, H = window.innerHeight, touch = this.isTouch(), portrait = H >= W;
    document.body.classList.toggle('portrait', touch && portrait);
    document.body.classList.toggle('landscape', touch && !portrait);
    let maxW, maxH;
    if (!touch) { maxW = W - 120; maxH = H - 150; }
    else if (portrait) { maxW = W - 58; maxH = H * 0.42; }
    else { maxW = W - Math.min(400, W * 0.48); maxH = H - 64; }
    const s = Math.max(0.5, Math.min(maxW / VIEW_W, maxH / VIEW_H));
    const scale = !touch && s >= 2 ? Math.floor(s * 2) / 2 : s;
    const cw = Math.floor(VIEW_W * scale), ch = Math.floor(VIEW_H * scale);
    const wrap = document.getElementById('screen-wrap');
    wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
    // backing store close to device pixels so scanlines stay crisp
    const k = Math.max(1, Math.min(4, Math.round(cw * (window.devicePixelRatio || 1) / VIEW_W)));
    if (this.view.width !== VIEW_W * k) { this.view.width = VIEW_W * k; this.view.height = VIEW_H * k; }
    this.fxScale = k; this.buildFx();
    // on handhelds the menus live inside the screen area, never over the buttons
    if (touch) requestAnimationFrame(() => {
      const st = document.documentElement.style;
      const dp = document.getElementById('dpad').getBoundingClientRect(), ab = document.getElementById('ab').getBoundingClientRect();
      if (portrait) { st.setProperty('--ov-top', '0px'); st.setProperty('--ov-left', '0px'); st.setProperty('--ov-w', W + 'px'); st.setProperty('--ov-h', Math.max(220, Math.min(dp.top, ab.top) - 6) + 'px'); }
      else { st.setProperty('--ov-top', '0px'); st.setProperty('--ov-left', (dp.right + 6) + 'px'); st.setProperty('--ov-w', Math.max(260, ab.left - dp.right - 12) + 'px'); st.setProperty('--ov-h', H + 'px'); }
    });
    this.applyFxClass();
  },

  // pre-rendered overlay for the current screen effect at the current backing scale
  buildFx() {
    const k = this.fxScale, w = VIEW_W * k, h = VIEW_H * k;
    const [c, ctx] = makeCanvas(w, h);
    if (this.fxMode === 'crt') {
      if (k >= 2) {
        ctx.fillStyle = `rgba(0,0,0,${k >= 3 ? 0.42 : 0.3})`;
        for (let y = k - 1; y < h; y += k) ctx.fillRect(0, y, w, 1);
        if (k >= 3) { // aperture grille
          const cols = ['rgba(255,60,60,0.07)', 'rgba(60,255,90,0.05)', 'rgba(70,110,255,0.08)'];
          for (let x = 0; x < w; x++) { ctx.fillStyle = cols[x % 3]; ctx.fillRect(x, 0, 1, h); }
        }
      }
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.68);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    } else if (this.fxMode === 'lcd') {
      if (k >= 2) {
        ctx.fillStyle = 'rgba(20,24,10,0.2)';
        for (let y = k - 1; y < h; y += k) ctx.fillRect(0, y, w, 1);
        for (let x = k - 1; x < w; x += k) ctx.fillRect(x, 0, 1, h);
      }
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255,255,240,0.06)'); g.addColorStop(0.5, 'rgba(255,255,240,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    this.fx = this.fxMode === 'clean' ? null : c;
  },
  applyFxClass() {
    const wrap = document.getElementById('screen-wrap');
    wrap.classList.remove('crt', 'lcd', 'clean'); wrap.classList.add(this.fxMode);
    const b = document.getElementById('hud-fx'); if (b) b.textContent = this.fxMode.toUpperCase();
  },
  cycleFx() {
    const order = ['crt', 'lcd', 'clean'];
    this.fxMode = order[(order.indexOf(this.fxMode) + 1) % 3];
    try { localStorage.setItem('px-fx', this.fxMode); } catch (e) { /* ignore */ }
    this.buildFx(); this.applyFxClass();
    if (this.state === 'play') this.showToast('SCREEN: ' + this.fxMode.toUpperCase(), 90);
  },
  present() {
    const v = this.vctx;
    v.imageSmoothingEnabled = false;
    v.drawImage(this.canvas, 0, 0, this.view.width, this.view.height);
    if (this.fx) v.drawImage(this.fx, 0, 0);
  },

  // ---------- flow ----------
  start() {
    Audio8.init();
    Object.assign(this, { score: 0, coins: 0, deaths: 0, bossBeaten: false, stack: [], startedAt: performance.now() });
    UI.hideAll();
    Input.clear();
    this.loadLevel('L1');
  },

  loadLevel(id) {
    this.levelId = id;
    this.bossFight = false; this.boss = null;
    this.builder = LEVEL_BUILDERS[id];
    this.world = new World(this.builder());
    this.player = new Player(this.world.def.start.x, this.world.def.start.y);
    this.snapCamera();
    this.fade = 0;
    this.state = 'play';
    Audio8.stopMusic();
    this.card = { t: 140, world: this.world.def.name, title: this.world.def.title };
    this.run((function* () {
      while (Game.card && Game.card.t > 0) { Game.card.t--; yield; }
      Game.card = null;
      Audio8.playMusic(Game.world.def.music);
      if (id === 'L1') Game.showToast(Game.isTouch() ? 'TAP < > TO MOVE, A TO JUMP' : 'ARROWS MOVE - SPACE JUMP - X RUN', 260);
      if (id === 'BOSS') Game.showToast('STOMP HIM OR HIT THE SWITCH!', 200);
    })());
  },

  snapCamera() {
    const w = this.world, p = this.player;
    w.camX = Math.max(0, Math.min(w.pxW - VIEW_W, p.x + p.w / 2 - VIEW_W * 0.42));
  },

  step() {
    Input.tick();
    this.time++;
    if (this.state === 'boot') {
      if (++this.bootT > 150 || (this.bootT > 20 && (Input.pressed('jump') || Input.pressed('start') || Input.pressed('pause')))) this.toTitle();
      return;
    }
    if (this.state === 'title') {
      this.world.time++;
      this.world.camX = (Math.sin(this.time * 0.002) * 0.5 + 0.5) * 900;
      return;
    }
    if (this.state !== 'play') return;
    if (Input.pressed('pause')) { UI.pause(); return; }
    const w = this.world;
    w.time++;
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (this.toast && --this.toast.t <= 0) this.toast = null;

    if (this.script) {
      const s = this.script, r = s.next();
      if (r.done && this.script === s) this.script = null;
      if (this.scriptFreezesWorld) { w.updateParticles(); return; }
    }
    // moving platforms first so the player can ride them
    for (const e of w.entities) if (e instanceof MovingPlatform) e.update(w, this);
    if (!this.script) {
      this.player.update(w, this);
      if (this.player.onGround) this.combo = 0;
    }
    for (const e of w.entities.slice()) if (!(e instanceof MovingPlatform) && !e.dead) e.update(w, this);
    // player vs enemies
    if (!this.script && !this.player.dead) {
      const p = this.player;
      for (const e of w.entities) {
        if (!e.enemy || e.dead || !e.active || e.knocked || e.flat || !e.onPlayer) continue;
        const hb = e.hitbox ? e.hitbox() : e;
        const shrink = { x: hb.x + 1, y: hb.y + 1, w: hb.w - 2, h: hb.h - 2 };
        if (overlap(p, shrink)) e.onPlayer(p, this);
        if (this.script) break;
      }
    }
    w.entities = w.entities.filter(e => !e.dead);
    w.updateParticles();
    // camera
    if (this.bossFight && w.def.arena) {
      w.camX += (w.def.arena.cam - w.camX) * 0.08;
      if (Math.abs(w.def.arena.cam - w.camX) < 0.5) w.camX = w.def.arena.cam;
    } else if (!this.cameraHold) {
      const target = this.player.x + this.player.w / 2 - VIEW_W * 0.42;
      w.camX = Math.max(0, Math.min(w.pxW - VIEW_W, target));
    }
    // pipe hint
    const pipeUnder = this.pipeUnderPlayer();
    if (pipeUnder && !this.script) this.hintPipe = pipeUnder; else this.hintPipe = null;
  },

  pipeUnderPlayer() {
    const p = this.player; if (!p.onGround) return null;
    const ty = Math.floor((p.y + p.h + 1) / TILE), cx = p.x + p.w / 2;
    return this.world.def.pipes.find(pp => pp.top === ty && cx > pp.x * TILE + 2 && cx < pp.x * TILE + 30) || null;
  },

  run(gen, freeze = true) { this.script = gen; this.scriptFreezesWorld = freeze; },

  *fadeTo(target, frames) {
    const from = this.fade;
    for (let i = 1; i <= frames; i++) { this.fade = from + (target - from) * i / frames; yield; }
  },

  // ---------- pipes ----------
  enterPipe(pipe) {
    const self = this, p = this.player;
    if (this.world.def.isRoom && pipe.exit) return this.exitRoom(pipe);
    if (!pipe.section) return;
    this.run((function* () {
      Audio8.play('pipe');
      p.vx = 0; p.vy = 0; p.pose = 'stand'; p.behind = true;
      p.x = pipe.x * TILE + 10;
      for (let i = 0; i < 32; i++) { p.y += 1; yield; }
      p.hidden = true;
      yield* self.fadeTo(1, 18);
      self.stack.push({ world: self.world, pipe, powered: p.powered, builder: self.builder, music: self.world.def.music });
      self.visited.add(pipe.section);
      self.builder = () => buildRoom(pipe.section);
      self.world = new World(self.builder());
      self.player = new Player(self.world.def.start.x, 1 * TILE);
      Object.assign(self.player, { powered: p.powered, behind: true, pose: 'jump' });
      self.snapCamera();
      Audio8.playMusic('room');
      yield* self.fadeTo(0, 18);
      Audio8.play('pipe');
      for (let i = 0; i < 34; i++) { self.player.y += 1; yield; }
      self.player.behind = false; self.player.pose = null;
      const sec = SECTIONS[pipe.section];
      self.banner = { t: 150, big: `PART ${sec.num}`, small: sec.title.toUpperCase() };
    })());
  },

  exitRoom(pipe) {
    const self = this, p = this.player;
    const back = this.stack.pop();
    if (!back) return;
    this.run((function* () {
      Audio8.play('pipe');
      p.vx = 0; p.vy = 0; p.pose = 'stand'; p.behind = true; p.x = pipe.x * TILE + 10;
      for (let i = 0; i < 32; i++) { p.y += 1; yield; }
      p.hidden = true;
      yield* self.fadeTo(1, 18);
      const sp = back.pipe;
      self.world = back.world; self.builder = back.builder;
      self.player = new Player(sp.x * TILE + 10, sp.top * TILE + 17);
      Object.assign(self.player, { powered: p.powered, behind: true, pose: 'stand' });
      self.snapCamera();
      self.world.checkpoint = { x: sp.x * TILE + 10, y: sp.top * TILE - 15 };
      Audio8.playMusic(back.music);
      yield* self.fadeTo(0, 18);
      Audio8.play('pipe');
      for (let i = 0; i < 32; i++) { self.player.y -= 1; yield; }
      self.player.behind = false; self.player.pose = null;
      const total = SECTION_ORDER.length;
      if (self.visited.size === total) self.showToast('ALL 8 CHAPTERS FOUND! *', 200);
    })());
  },

  // ---------- info parts ----------
  openPartAt(tx) {
    const def = this.world.def;
    if (!def.isRoom) return;
    const b = def.boards.find(bb => bb.bx === tx);
    if (b) this.openPart(def.section, b.part);
  },
  isPartReadAt(tx) {
    const def = this.world.def; if (!def.isRoom) return false;
    const b = def.boards.find(bb => bb.bx === tx);
    return !!(b && this.read[def.section] && this.read[def.section].has(b.part));
  },
  markRead(section, idx) {
    (this.read[section] ||= new Set()).add(idx);
    const sec = SECTIONS[section];
    if (this.read[section].size === sec.parts.length && !this.read[section].done) {
      this.read[section].done = true;
      this.score += 1000;
      this.world.popText(this.player.x + 6, this.player.y - 20, 'CHAPTER DONE +1000', '#ffd23f');
    }
  },
  openPart(section, idx) {
    this.markRead(section, idx);
    this.state = 'dialog';
    UI.openPart(section, idx);
  },
  closeDialog() {
    UI.hide('dialog');
    Input.clear();
    if (this.state === 'dialog') this.state = 'play';
  },

  // ---------- scoring / player events ----------
  addCoin(x, y) {
    this.coins++; this.score += 100; Audio8.play('coin');
    if (this.coins % 50 === 0) { this.score += 5000; this.world.popText(x, y - 10, '50 COINS! +5000', '#ffd23f'); }
  },
  powerUp(x, y) {
    const p = this.player;
    if (p.powered) { this.score += 1000; this.world.popText(x + 8, y, '1000'); }
    else {
      p.powered = true;
      this.showToast(this.isTouch() ? 'UNO POWER! TAP B TO SHOOT BOLTS' : 'UNO POWER! PRESS X TO SHOOT BOLTS', 220);
    }
    Audio8.play('power');
    this.world.burst(x + 8, y + 8, ['#7af0ff', '#ffffff', '#1f8ad6'], 14, 2);
  },
  hurtPlayer() {
    const p = this.player;
    if (this.script || p.invuln > 0 || p.dead) return;
    if (p.powered) { p.powered = false; p.invuln = 110; Audio8.play('hurt'); }
    else this.killPlayer();
  },
  killPlayer() {
    const self = this, p = this.player;
    if (p.dead) return;
    p.dead = true; this.deaths++;
    Audio8.stopMusic(); Audio8.play('die');
    this.run((function* () {
      p.pose = 'jump'; p.vx = 0; p.vy = 0; p.powered = false;
      yield* wait(30);
      p.vy = -6;
      for (let i = 0; i < 100; i++) { p.vy += 0.25; p.y += p.vy; yield; }
      yield* self.fadeTo(1, 20);
      const cp = self.world.checkpoint;
      const inRoom = self.world.def.isRoom;
      self.world = new World(self.builder());
      if (!inRoom) self.world.checkpoint = cp;
      const start = inRoom ? self.world.def.start : cp;
      self.player = new Player(start.x, start.y);
      self.bossFight = false; self.boss = null;
      self.snapCamera();
      yield* wait(10);
      yield* self.fadeTo(0, 20);
      Audio8.playMusic(self.world.def.music);
    })());
  },

  finishLevel(flag) {
    const self = this, p = this.player;
    Audio8.stopMusic(); Audio8.play('clear');
    const height = Math.max(0, Math.floor((GY * TILE - p.y) / 16));
    const bonus = [100, 200, 400, 800, 1000, 2000, 4000, 5000, 5000, 5000][Math.min(9, height)];
    this.score += bonus;
    this.world.popText(flag.x, p.y - 10, String(bonus), '#ffd23f');
    this.run((function* () {
      p.vx = 0; p.vy = 0; p.pose = 'jump'; p.x = flag.x - p.w + 1;
      while (p.y + p.h < GY * TILE) { p.y = Math.min(p.y + 2.5, GY * TILE - p.h); flag.flagY = Math.min(flag.flagY + 2.5, GY * TILE - 22); yield; }
      while (flag.flagY < GY * TILE - 22) { flag.flagY += 2.5; yield; }
      yield* wait(20);
      p.pose = null; p.dir = 1; p.onGround = true;
      while (p.x < flag.castleX + 34) { p.vx = 1.2; p.vy = Math.min(p.vy + 0.5, 5); const info = self.world.moveBody(p); p.onGround = info.ground; p.anim += 0.15; yield; }
      p.hidden = true;
      self.banner = { t: 140, big: 'COURSE CLEAR!', small: `WORLD ${self.world.def.name} DONE` };
      yield* wait(150);
      yield* self.fadeTo(1, 25);
      self.loadLevel(self.world.def.next);
    })(), false);
  },

  enterBoss(door) {
    const self = this, p = this.player;
    Audio8.stopMusic();
    this.run((function* () {
      p.vx = 0; p.pose = 'stand'; Audio8.play('pipe');
      yield* wait(20); p.hidden = true;
      yield* self.fadeTo(1, 30);
      self.loadLevel('BOSS');
    })());
  },

  startBossFight() {
    this.bossFight = true;
    this.boss = this.world.entities.find(e => e instanceof Boss);
    this.world.camLock = this.world.def.arena.cam;
    this.banner = { t: 160, big: 'KING BUGZER', small: 'THE FINAL BUG', color: '#ff4fa3' };
    Audio8.play('boss');
  },

  bossSwitch() {
    const self = this, w = this.world, boss = this.boss || w.entities.find(e => e instanceof Boss);
    if (this.bossBeaten || !boss) return;
    Audio8.stopMusic();
    this.run((function* () {
      boss.state = 'frozen';
      self.player.vx = 0; self.player.pose = 'stand';
      w.entities.forEach(e => { if (e instanceof BossFire) e.dead = true; });
      yield* wait(20);
      w.setTile(w.def.arena.bridgeX1 - 1, 9, T.EMPTY);
      Audio8.play('collapse');
      for (let x = w.def.arena.bridgeX1 - 1; x >= w.def.arena.bridgeX0; x--) {
        w.setTile(x, 10, T.EMPTY);
        w.burst(x * TILE + 8, 10 * TILE + 3, ['#8f4f22', '#e3a066'], 3, 1);
        if (boss.state === 'frozen' && x * TILE <= boss.x + boss.w / 2) boss.defeat(self, true);
        yield* wait(4);
      }
      yield* wait(40);
      self.player.pose = null;
    })(), false);
  },

  bossDefeated(boss) {
    this.bossBeaten = true; this.bossFight = false;
    this.world.camLock = null;
    this.score += 5000;
    this.world.entities.forEach(e => { if (e instanceof BossFire) e.dead = true; if (e instanceof Bug && e.active) e.knockOut(this); });
    Audio8.stopMusic(); Audio8.play('clear');
    this.banner = { t: 260, big: 'BUGZER DEFEATED!', small: 'ALL BUGS FIXED. GRAB THE TROPHY >', color: '#7dffb5' };
  },

  ending() {
    const self = this;
    this.run((function* () {
      self.player.vx = 0; self.player.pose = 'jump';
      Audio8.play('power');
      yield* wait(40);
      yield* self.fadeTo(1, 30);
      self.state = 'ending';
      UI.ending();
    })());
  },

  showToast(text, t = 180) { this.toast = { text, t }; },
  isTouch() { return document.body.classList.contains('touch'); },

  // ---------- rendering ----------
  toTitle() {
    this.state = 'title'; Input.clear();
    if (!this.isTouch()) UI.show('title');
  },

  render() {
    const ctx = this.ctx, w = this.world;
    if (!w) return;
    if (this.state === 'boot') return this.drawBoot(ctx);
    const cam = Math.floor(w.camX);
    w.drawBackground(ctx);
    w.drawDecor(ctx);
    this.drawWorldDecor(ctx, cam);
    for (const e of w.entities) if (e.behind) e.draw(ctx, cam, w.time, w);
    if (this.player.behind) this.player.draw(ctx, cam, w.time);
    w.drawTiles(ctx);
    for (const e of w.entities) if (!e.behind) e.draw(ctx, cam, w.time, w);
    if (!this.player.behind) this.player.draw(ctx, cam, w.time);
    w.drawParticles(ctx);
    if (this.state !== 'title') this.drawHUD(ctx);
    if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.card) this.drawCard(ctx);
    if (this.state === 'title' && this.isTouch()) this.drawHandheldTitle(ctx);
  },

  // power-on screen: the logo drops in like an old handheld boot
  drawBoot(ctx) {
    const t = this.bootT;
    ctx.fillStyle = '#f4f2e6'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const y = Math.min(84, -30 + t * 1.6);
    drawText(ctx, 'DILYOR', VIEW_W / 2, y, '#2b2f8f', { align: 'center', scale: 4 });
    if (t > 75) {
      const cols = ['#e0315f', '#ff9d1a', '#2fae3c', '#1f8ad6', '#8a3ffc'];
      'PIXEL CV'.split('').forEach((ch, i) => drawText(ctx, ch, VIEW_W / 2 - 23 + i * 6, y + 36, cols[i % cols.length]));
    }
    if (t > 95) drawText(ctx, 'PRESS START', VIEW_W / 2, 170, t % 40 < 26 ? '#6a6a80' : '#f4f2e6', { align: 'center' });
    if (t > 130) { ctx.fillStyle = `rgba(244,242,230,${(t - 130) / 20})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  },

  drawHandheldTitle(ctx) {
    const t = this.time;
    ctx.fillStyle = '#0b0b1acc'; ctx.fillRect(0, 34, VIEW_W, 150);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 34, VIEW_W, 2); ctx.fillRect(0, 182, VIEW_W, 2);
    drawText(ctx, 'AN INTERACTIVE PIXEL CV', VIEW_W / 2, 44, '#7de87a', { align: 'center' });
    drawText(ctx, 'SUPER', VIEW_W / 2, 60, '#c08cff', { align: 'center', scale: 3, shadow: '#3f1a6e' });
    drawText(ctx, 'DILYOR', VIEW_W / 2, 86, '#ffd23f', { align: 'center', scale: 4, shadow: '#b34a00' });
    if (t % 50 < 34) drawText(ctx, 'PRESS START', VIEW_W / 2, 132, '#ffffff', { align: 'center', scale: 2, shadow: '#000' });
    drawText(ctx, 'SELECT: READ THE CV', VIEW_W / 2, 158, '#8ab8ff', { align: 'center' });
    drawText(ctx, 'A JUMP  B RUN/SHOOT  v PIPE', VIEW_W / 2, 170, '#a89cc8', { align: 'center' });
  },

  drawWorldDecor(ctx, cam) {
    const w = this.world, def = w.def;
    for (const t of def.texts) {
      const x = t.x - cam; if (x > VIEW_W || x + textWidth(t.str) < 0) continue;
      drawText(ctx, t.str, x, t.y, t.color, { shadow: '#000000aa' });
    }
    // pipe banners
    for (const p of def.pipes) {
      const px = p.x * TILE - cam + 16; if (px < -80 || px > VIEW_W + 80) continue;
      let label, color = '#ffffff', border = '#2fae3c';
      if (p.exit) { label = 'EXIT'; }
      else {
        const sec = SECTIONS[p.section];
        const done = this.visited.has(p.section);
        label = `${sec.num}.${sec.label}${done ? ' *' : ''}`;
        if (done) { border = '#ffd23f'; color = '#ffd23f'; }
      }
      if (p.exit) continue; // rooms paint "EXIT" as text
      const by = p.top * TILE - 26 + Math.round(Math.sin(w.time * 0.05 + p.x) * 1.5);
      const tw = textWidth(label) + 8;
      ctx.fillStyle = '#0b0b1a'; ctx.fillRect(Math.round(px - tw / 2) - 1, by - 1, tw + 2, 13);
      ctx.fillStyle = border; ctx.fillRect(Math.round(px - tw / 2), by, tw, 11);
      ctx.fillStyle = '#0b0b1a'; ctx.fillRect(Math.round(px - tw / 2) + 1, by + 1, tw - 2, 9);
      drawText(ctx, label, px, by + 2, color, { align: 'center' });
    }
    // hint arrow over the pipe we're standing on
    if (this.hintPipe && this.state === 'play') {
      const p = this.hintPipe, px = p.x * TILE - cam + 16;
      const y = p.top * TILE - 46 + (Math.floor(w.time / 10) % 2) * 2;
      drawText(ctx, 'v', px, y, '#ffd23f', { align: 'center', shadow: '#000' });
      const msg = this.isTouch() ? 'HOLD v TO ENTER' : 'PRESS DOWN TO ENTER';
      drawText(ctx, msg, px, p.top * TILE - 56, '#ffffff', { align: 'center', shadow: '#000' });
    }
    // room boards
    for (const b of def.boards) {
      const x = b.x - cam; if (x > VIEW_W || x + b.w < 0) continue;
      const read = this.read[def.section] && this.read[def.section].has(b.part);
      ctx.fillStyle = '#05060f'; ctx.fillRect(x - 1, b.y - 1, b.w + 2, b.h + 2);
      ctx.fillStyle = read ? '#ffd23f' : '#3d7bd9'; ctx.fillRect(x, b.y, b.w, b.h);
      ctx.fillStyle = '#0b1230'; ctx.fillRect(x + 2, b.y + 2, b.w - 4, b.h - 4);
      // post
      ctx.fillStyle = '#3d7bd9'; ctx.fillRect(x + b.w / 2 - 1, b.y + b.h, 2, 3);
      if (!b.cert) {
        drawText(ctx, b.label, x + 5, b.y + 5, '#8ab8ff');
        if (read) drawText(ctx, '*', x + b.w - 11, b.y + 5, '#ffd23f');
      }
      if (b.cert && this.certImgs[b.cert] && this.certImgs[b.cert].complete) {
        const im = this.certImgs[b.cert];
        const iw = Math.min(44, im.width), ih = Math.min(32, Math.round(im.height * iw / im.width));
        const ix = Math.round(x + (b.w - iw) / 2), iy = b.y + 16;
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(ix - 2, iy - 2, iw + 4, ih + 4);
        ctx.drawImage(im, 0, 0, im.width, Math.round(ih * im.width / iw), ix, iy, iw, ih);
        drawText(ctx, b.tag, x + b.w / 2, b.y + 5, read ? '#ffd23f' : '#ffffff', { align: 'center' });
      } else {
        drawText(ctx, b.tag, x + b.w / 2, b.y + 24, '#ffffff', { align: 'center' });
        drawText(ctx, read ? 'READ!' : 'HIT ! v', x + b.w / 2, b.y + 38, read ? '#7dffb5' : '#ffd23f', { align: 'center' });
      }
    }
  },

  drawHUD(ctx) {
    const sh = { shadow: '#000' };
    drawText(ctx, CV.short, 12, 6, '#ffffff', sh);
    drawText(ctx, String(this.score).padStart(6, '0'), 12, 16, '#ffffff', sh);
    // coin
    ctx.drawImage(SPR.coin, 0, 0, 8, 12, 112, 13, 6, 9);
    drawText(ctx, 'x' + String(this.coins).padStart(2, '0'), 121, 16, '#ffffff', sh);
    drawText(ctx, this.world.def.isRoom ? 'PIPE' : 'WORLD', 188, 6, '#ffffff', sh);
    drawText(ctx, this.world.def.isRoom ? 'PART ' + SECTIONS[this.world.def.section].num : this.world.def.name, 188, 16, '#ffffff', sh);
    drawText(ctx, 'CHAPTERS', 262, 6, '#ffffff', sh);
    drawText(ctx, `${this.visited.size}/${SECTION_ORDER.length}`, 262, 16, this.visited.size === SECTION_ORDER.length ? '#ffd23f' : '#ffffff', sh);
    if (this.player.powered) { ctx.drawImage(SPR.uno, 2, 4, 12, 9, 356, 8, 12, 9); }
    // boss bar
    if (this.boss && (this.bossFight || this.boss.state === 'frozen') && !this.bossBeaten) {
      const b = this.boss;
      drawText(ctx, 'KING BUGZER', VIEW_W / 2, 30, '#ff4fa3', { align: 'center', shadow: '#000' });
      ctx.fillStyle = '#000'; ctx.fillRect(VIEW_W / 2 - 51, 40, 102, 7);
      ctx.fillStyle = '#4a1a2a'; ctx.fillRect(VIEW_W / 2 - 50, 41, 100, 5);
      ctx.fillStyle = '#ff4fa3'; ctx.fillRect(VIEW_W / 2 - 50, 41, Math.max(0, b.hp / b.maxHp) * 100, 5);
    }
    if (this.banner) {
      const b = this.banner, a = Math.min(1, b.t / 20);
      ctx.globalAlpha = a;
      const by = this.world.def.isRoom ? 136 : 80;
      ctx.fillStyle = '#000000b0'; ctx.fillRect(0, by, VIEW_W, 44);
      drawText(ctx, b.big, VIEW_W / 2, by + 8, b.color || '#ffd23f', { align: 'center', scale: 2, shadow: '#000' });
      drawText(ctx, b.small, VIEW_W / 2, by + 28, '#ffffff', { align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (this.toast) {
      const tw = textWidth(this.toast.text) + 12;
      ctx.globalAlpha = Math.min(1, this.toast.t / 20);
      ctx.fillStyle = '#000000c0'; ctx.fillRect(VIEW_W / 2 - tw / 2, VIEW_H - 22, tw, 14);
      drawText(ctx, this.toast.text, VIEW_W / 2, VIEW_H - 18, '#ffffff', { align: 'center' });
      ctx.globalAlpha = 1;
    }
  },

  drawCard(ctx) {
    const c = this.card;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'WORLD ' + c.world, VIEW_W / 2, 70, '#ffffff', { align: 'center', scale: 2 });
    drawText(ctx, c.title, VIEW_W / 2, 96, '#ffd23f', { align: 'center' });
    ctx.drawImage(SPR.hero.stand[0], VIEW_W / 2 - 34, 122);
    drawText(ctx, `x ${String(this.deaths).padStart(2, '0')} OOPS`, VIEW_W / 2 - 12, 127, '#ffffff');
    const sections = SECTION_ORDER.filter(s => LEVEL_SECTIONS[this.levelId]?.includes(s)).map(s => SECTIONS[s].num + '.' + SECTIONS[s].label);
    if (sections.length) drawText(ctx, 'PIPES: ' + sections.join('  '), VIEW_W / 2, 160, '#7dffb5', { align: 'center' });
    else if (this.levelId === 'BOSS') drawText(ctx, 'BOSS FIGHT!', VIEW_W / 2, 160, '#ff4fa3', { align: 'center' });
  },
};

const LEVEL_SECTIONS = { L1: ['about', 'education', 'skills'], L2: ['arduinium', 'hardware', 'experience'], L3: ['honors', 'leadership'] };

// ---------------- HTML overlays ----------------
const UI = {
  init() {
    this.el = id => document.getElementById(id);
    this.el('btn-play').onclick = () => { Audio8.init(); Audio8.play('select'); Game.start(); };
    this.el('btn-cv').onclick = () => this.openCV();
    this.el('btn-cv2').onclick = () => this.openCV();
    this.el('hud-cv').onclick = () => this.openCV();
    this.el('hud-pause').onclick = () => this.pause();
    this.el('hud-sound').onclick = () => this.toggleSound();
    this.el('hud-fx').onclick = () => Game.cycleFx();
    const shells = ['grape', 'teal', 'berry', 'kiwi', 'dandelion', 'smoke'];
    let shell = 0;
    try { shell = Math.max(0, shells.indexOf(localStorage.getItem('px-shell'))); } catch (e) { /* ignore */ }
    document.body.dataset.shell = shells[shell];
    this.el('brand').onclick = () => {
      shell = (shell + 1) % shells.length; document.body.dataset.shell = shells[shell];
      try { localStorage.setItem('px-shell', shells[shell]); } catch (e) { /* ignore */ }
      Audio8.init(); Audio8.play('select');
    };
    this.el('btn-resume').onclick = () => this.resume();
    this.el('btn-restart').onclick = () => { this.hide('pause'); Game.state = 'play'; Game.fade = 0; Game.killPlayer(); };
    this.el('btn-cv-close').onclick = () => this.closeCV();
    this.el('btn-dialog-close').onclick = () => Game.closeDialog();
    this.el('btn-prev').onclick = () => this.stepPart(-1);
    this.el('btn-next').onclick = () => this.stepPart(1);
    this.el('btn-again').onclick = () => { this.hide('ending'); Game.fade = 0; Game.start(); };
    this.el('btn-ending-cv').onclick = () => this.openCV();
    document.querySelectorAll('.overlay').forEach(o => o.addEventListener('pointerdown', e => { if (e.target === o && o.id === 'dialog') Game.closeDialog(); }));
    this.updateSoundIcon();
    Input.bindPad();
    this.buildCV();
  },
  show(id) { this.el(id).classList.add('open'); },
  hide(id) { this.el(id).classList.remove('open'); },
  hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('open')); },
  isOpen(id) { return this.el(id).classList.contains('open'); },

  onKey(e) {
    if (this.isOpen('dialog')) {
      if (['Enter', 'Space', 'Escape', 'KeyE', 'KeyZ', 'KeyX'].includes(e.code)) { e.preventDefault(); Game.closeDialog(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.stepPart(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.stepPart(-1);
      return;
    }
    if (this.isOpen('cv')) { if (['Escape', 'Enter', 'KeyC', 'KeyX'].includes(e.code) && (e.virtual || e.code === 'Escape')) this.closeCV(); return; }
    if (this.isOpen('pause')) { if (['Escape', 'KeyP', 'Enter'].includes(e.code)) { e.preventDefault(); this.resume(); } else if (e.virtual && e.code === 'KeyC') this.openCV(); return; }
    if (this.isOpen('ending')) { if (e.virtual && (e.code === 'Enter' || e.code === 'Space')) { this.hide('ending'); Game.fade = 0; Game.start(); } else if (e.virtual && e.code === 'KeyC') this.openCV(); return; }
    if (Game.state === 'title' && (e.code === 'Enter' || (e.code === 'Space' && this.isOpen('title')))) { e.preventDefault(); Audio8.init(); Audio8.play('select'); Game.start(); return; }
    if (Game.state === 'title' && e.code === 'KeyC') { this.openCV(); return; }
    if (e.code === 'KeyM') this.toggleSound();
    if (e.code === 'KeyV') Game.cycleFx();
    if (e.code === 'KeyC' && Game.state === 'play') this.openCV();
  },

  pause() {
    if (Game.state !== 'play') return;
    Game.state = 'paused'; this.show('pause');
  },
  resume() { this.hide('pause'); Input.clear(); if (Game.state === 'paused') Game.state = 'play'; },

  toggleSound() { Audio8.init(); Audio8.setMuted(!Audio8.isMuted()); this.updateSoundIcon(); },
  updateSoundIcon() { this.el('hud-sound').textContent = Audio8.isMuted() ? '🔇' : '🔊'; },

  openPart(section, idx) {
    const sec = SECTIONS[section], part = sec.parts[idx];
    this.cur = { section, idx };
    this.el('dlg-badge').textContent = `PART ${sec.num} · ${sec.label} · ${idx + 1}/${sec.parts.length}`;
    this.el('dlg-title').textContent = part.title;
    let html = '';
    if (part.cert) html += `<figure class="cert"><img src="${CERTS[part.cert].src}" alt="${part.title} certificate (pixel art)"><figcaption>proof · pixelated</figcaption></figure>`;
    html += part.body;
    this.el('dlg-body').innerHTML = html;
    this.el('dlg-body').scrollTop = 0;
    this.el('btn-prev').disabled = idx === 0;
    this.el('btn-next').disabled = idx === sec.parts.length - 1;
    this.show('dialog');
  },
  stepPart(d) {
    if (!this.cur) return;
    const sec = SECTIONS[this.cur.section];
    const n = this.cur.idx + d;
    if (n < 0 || n >= sec.parts.length) return;
    Audio8.play('select');
    Game.markRead(this.cur.section, n);
    this.openPart(this.cur.section, n);
  },

  buildCV() {
    const parts = SECTION_ORDER.map(id => {
      const s = SECTIONS[id];
      return `<section><h2><span class="num">${s.num}</span>${s.title}</h2>${s.parts.map(p => `
        <article><h3>${p.title}</h3>${p.cert ? `<img class="cv-cert" src="${CERTS[p.cert].src}" alt="${p.title} certificate (pixel art)">` : ''}${p.body}</article>`).join('')}</section>`;
    }).join('');
    this.el('cv-content').innerHTML = `
      <header class="cv-head"><h1>${CV.name}</h1><p>${CV.location}</p>
      <p><a href="mailto:${CV.email}">${CV.email}</a> · <a href="${CV.arduinium}" target="_blank" rel="noopener">arduinium.vercel.app ↗</a></p></header>${parts}`;
  },
  openCV() {
    this.cvFrom = Game.state;
    if (Game.state === 'play') Game.state = 'paused';
    this.show('cv'); this.el('cv-content').scrollTop = 0;
  },
  closeCV() {
    this.hide('cv'); Input.clear();
    if (this.cvFrom === 'play' && !this.isOpen('pause')) Game.state = 'play';
  },

  ending() {
    const secs = Math.round((performance.now() - Game.startedAt) / 1000);
    const readCount = Object.values(Game.read).reduce((a, s) => a + s.size, 0);
    const total = SECTION_ORDER.reduce((a, id) => a + SECTIONS[id].parts.length, 0);
    this.el('end-stats').innerHTML = `
      <li><span>SCORE</span><b>${String(Game.score).padStart(6, '0')}</b></li>
      <li><span>COINS</span><b>${Game.coins}</b></li>
      <li><span>CHAPTERS</span><b>${Game.visited.size}/${SECTION_ORDER.length}</b></li>
      <li><span>PARTS READ</span><b>${readCount}/${total}</b></li>
      <li><span>OOPS</span><b>${Game.deaths}</b></li>
      <li><span>TIME</span><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></li>`;
    this.el('end-contact').innerHTML = CONTACT_HTML;
    Audio8.playMusic('room');
    this.show('ending');
  },
};

window.addEventListener('load', () => Game.init());
