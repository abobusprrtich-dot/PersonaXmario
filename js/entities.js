// Player, enemies, items and the boss.

function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ---------------- Player ----------------
class Player {
  constructor(x, y) {
    Object.assign(this, { x, y, w: 12, h: 15, vx: 0, vy: 0, dir: 1, onGround: false, powered: false, invuln: 0,
      anim: 0, coyote: 0, jumpBuf: 0, platform: null, hidden: false, behind: false, pose: null, dead: false });
  }

  update(world, game) {
    const L = Input.down('left'), R = Input.down('right'), run = Input.down('run');
    const maxV = run ? 2.6 : 1.5;
    const acc = this.onGround ? (run ? 0.1 : 0.075) : 0.065;
    if (L && !R) { this.dir = -1; this.vx -= (this.vx > 0 && this.onGround) ? 0.2 : acc; }
    else if (R && !L) { this.dir = 1; this.vx += (this.vx < 0 && this.onGround) ? 0.2 : acc; }
    else if (this.onGround) { this.vx = Math.abs(this.vx) < 0.1 ? 0 : this.vx - Math.sign(this.vx) * 0.1; }
    if (Math.abs(this.vx) > maxV) this.vx = Math.sign(this.vx) * Math.max(maxV, Math.abs(this.vx) - 0.06);

    // jump with buffer + coyote time
    if (Input.pressed('jump')) this.jumpBuf = 7; else if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.onGround) this.coyote = 6; else if (this.coyote > 0) this.coyote--;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -(5.3 + Math.abs(this.vx) * 0.3);
      this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.platform = null;
      Audio8.play('jump');
    }
    const g = (this.vy < 0 && Input.down('jump')) ? 0.25 : 0.6;
    this.vy = Math.min(this.vy + g, 6);

    // ride moving platform
    if (this.platform) { this.x += this.platform.dx; this.y = this.platform.y - this.h; if (this.vy > 0) this.vy = 0; }

    const prevBottom = this.y + this.h;
    const info = world.moveBody(this, { hidden: true });
    this.onGround = info.ground;
    this.platform = null;
    if (this.vy >= 0) {
      for (const p of world.entities) {
        if (!(p instanceof MovingPlatform)) continue;
        const withinX = this.x + this.w > p.x + 1 && this.x < p.x + p.w - 1;
        if (withinX && prevBottom <= p.y + Math.max(2, Math.abs(p.dy) + 1) && this.y + this.h >= p.y) {
          this.y = p.y - this.h; this.vy = 0; this.onGround = true; this.platform = p;
        }
      }
    }

    // head bump: hit the single tile closest to our center
    if (info.head.length) {
      const cx = this.x + this.w / 2;
      const tx = info.head.reduce((best, t) => Math.abs((t + 0.5) * TILE - cx) < Math.abs((best + 0.5) * TILE - cx) ? t : best);
      world.bump(tx, info.headRow, game);
    }

    // shoot
    if (this.powered && Input.pressed('run')) {
      const n = world.entities.filter(e => e instanceof Bolt && !e.dead).length;
      if (n < 2) { world.entities.push(new Bolt(this.x + (this.dir > 0 ? this.w : -6), this.y + 4, this.dir)); Audio8.play('bolt'); }
    }

    // pipes
    if (this.onGround && Input.down('down')) {
      const ty = Math.floor((this.y + this.h + 1) / TILE);
      const cx = this.x + this.w / 2;
      for (const p of world.def.pipes) {
        if (p.top === ty && cx > p.x * TILE + 5 && cx < p.x * TILE + 27) { game.enterPipe(p); return; }
      }
    }
    // read the ! block above
    if (Input.pressed('read')) {
      const tx = Math.floor((this.x + this.w / 2) / TILE), ty0 = Math.floor(this.y / TILE);
      for (let ty = ty0 - 1; ty >= Math.max(0, ty0 - 6); ty--) if (world.tileAt(tx, ty) === T.INFO) { world.bump(tx, ty, game); break; }
    }

    // coins
    const hb = { x: this.x, y: this.y, w: this.w, h: this.h };
    const x0 = Math.floor(hb.x / TILE), x1 = Math.floor((hb.x + hb.w) / TILE), y0 = Math.floor(hb.y / TILE), y1 = Math.floor((hb.y + hb.h) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.tileAt(tx, ty) === T.COIN) {
      world.setTile(tx, ty, T.EMPTY); game.addCoin(tx * TILE + 8, ty * TILE);
    }

    // hazards
    if (world.overlapsTile(hb, HAZARD_TILES, 3)) { game.killPlayer(); return; }
    if (this.y > ROWS * TILE + 8) { game.killPlayer(); return; }

    // camera lock (boss arena)
    if (world.camLock != null) {
      if (this.x < world.camLock) { this.x = world.camLock; this.vx = Math.max(0, this.vx); }
    }
    if (this.invuln > 0) this.invuln--;
    this.anim += Math.abs(this.vx) * 0.12 + 0.02;
  }

  frame() {
    if (this.pose) return this.pose;
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 0.15) return ['run1', 'run2', 'run3', 'run2'][Math.floor(this.anim) % 4];
    return 'stand';
  }

  draw(ctx, cam, time) {
    if (this.hidden) return;
    if (this.invuln > 0 && Math.floor(time / 3) % 2) return;
    const set = this.powered ? SPR.heroPower : SPR.hero;
    const img = set[this.frame()][this.dir > 0 ? 0 : 1];
    if (this.flipY) {
      ctx.save(); ctx.translate(Math.round(this.x - 2 - cam), Math.round(this.y - 1) + 16); ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0); ctx.restore(); return;
    }
    ctx.drawImage(img, Math.round(this.x - 2 - cam), Math.round(this.y - 1));
  }
}
const HAZARD_TILES = new Set([T.LAVA, T.SPIKES]);

// ---------------- Items ----------------
class CoinPop {
  constructor(x, y) { Object.assign(this, { x, y, vy: -5, t: 0 }); }
  update(world) { this.y += this.vy; this.vy += 0.32; if (++this.t > 26) { this.dead = true; world.burst(this.x + 4, this.y + 6, ['#ffd23f', '#fff6c8'], 5, 1); } }
  draw(ctx, cam) { const w = [8, 6, 2, 6][Math.floor(this.t / 3) % 4]; ctx.drawImage(SPR.coin, 0, 0, 8, 12, Math.round(this.x - cam + 4 - w / 2), Math.round(this.y), w, 12); }
}

class UnoItem {
  constructor(x, y) { Object.assign(this, { x: x + 1, y, w: 14, h: 14, vx: 0, vy: 0, emerge: 32, behind: true, baseY: y }); }
  update(world, game) {
    if (this.emerge > 0) { this.emerge--; this.y = this.baseY - (32 - this.emerge) * 0.5; if (!this.emerge) { this.vx = 1; this.behind = false; } return; }
    this.vy = Math.min(this.vy + 0.3, 5);
    const info = world.moveBody(this);
    if (info.hitX) this.vx = -this.vx || 1;
    if (this.y > ROWS * TILE) this.dead = true;
    if (overlap(this, game.player)) { this.dead = true; game.powerUp(this.x, this.y); }
  }
  draw(ctx, cam, time) { ctx.drawImage(SPR.uno, Math.round(this.x - 1 - cam), Math.round(this.y - 1 + (this.emerge ? 0 : Math.sin(time * 0.2) * 0.5))); }
}

class Bolt {
  constructor(x, y, dir) { Object.assign(this, { x, y, w: 6, h: 6, vx: dir * 4, vy: 1, life: 150 }); }
  update(world, game) {
    this.vy = Math.min(this.vy + 0.4, 5);
    const info = world.moveBody(this, { noSemi: false });
    if (info.ground) this.vy = -3.4;
    if (info.hitX || info.head.length || --this.life <= 0 || this.x < world.camX - 16 || this.x > world.camX + VIEW_W + 16 || this.y > ROWS * TILE) {
      this.dead = true; world.burst(this.x + 3, this.y + 3, ['#7af0ff', '#ffffff'], 6, 1.2); return;
    }
    for (const e of world.entities) {
      if (e === this || e.dead || !e.active || !e.hitByBolt) continue;
      if (overlap(this, e.hitbox ? e.hitbox() : e) && e.hitByBolt(game)) { this.dead = true; world.burst(this.x + 3, this.y + 3, ['#7af0ff', '#ffffff'], 8, 1.5); return; }
    }
  }
  draw(ctx, cam, time) {
    const x = Math.round(this.x - cam), y = Math.round(this.y);
    ctx.fillStyle = '#1b6cff'; ctx.fillRect(x, y + 1, 6, 4); ctx.fillRect(x + 1, y, 4, 6);
    ctx.fillStyle = time % 4 < 2 ? '#7af0ff' : '#ffffff'; ctx.fillRect(x + 1, y + 1, 4, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 2, 2, 2);
  }
}

// ---------------- Enemies ----------------
class Enemy {
  constructor(x, y) { Object.assign(this, { x, y, vx: 0, vy: 0, enemy: true, active: false, knocked: false, t: 0 }); }
  checkActive(world) { if (!this.active && this.x < world.camX + VIEW_W + 24 && this.x > world.camX - 64) this.active = true; }
  onPlayer(p, game) {
    if (this.knocked || this.flat) return;
    if (this.stompable && p.vy > 0 && p.y + p.h - this.y < 9) {
      this.stomp(game);
      p.vy = Input.down('jump') ? -6.2 : -4; game.combo++;
      const pts = Math.min(100 * Math.pow(2, game.combo - 1), 1600);
      game.score += pts; game.world.popText(this.x + this.w / 2, this.y - 6, String(pts));
      Audio8.play('stomp');
    } else game.hurtPlayer();
  }
  stomp(game) { this.knockOut(game); }
  knockOut(game) {
    if (this.knocked) return;
    this.knocked = true; this.vy = -3.5; this.vx = (Math.random() < 0.5 ? -1 : 1) * 0.8;
    game.score += 100; Audio8.play('stomp');
  }
  hitByBolt(game) { if (this.knocked || this.flat) return false; this.knockOut(game); game.world.popText(this.x + this.w / 2, this.y - 6, '200'); return true; }
  updateKnocked(world) {
    this.vy += 0.3; this.x += this.vx; this.y += this.vy;
    if (this.y > ROWS * TILE + 32) this.dead = true;
  }
}

class Bug extends Enemy {
  constructor(x, y) { super(x + 1, y + 2); this.w = 14; this.h = 14; this.vx = -0.5; this.stompable = true; }
  update(world) {
    this.checkActive(world); if (!this.active) return;
    this.t++;
    if (this.knocked) return this.updateKnocked(world);
    if (this.flat) { if (--this.flat <= 0) this.dead = true; return; }
    this.vy = Math.min(this.vy + 0.35, 5);
    const info = world.moveBody(this);
    if (info.hitX) this.vx = -this.vx;
    // bugs bump into each other
    for (const o of world.entities) if (o !== this && o instanceof Bug && o.active && !o.knocked && !o.flat && overlap(this, o)) {
      if ((this.vx < 0 && o.x < this.x) || (this.vx > 0 && o.x > this.x)) this.vx = -this.vx;
    }
    if (this.y > ROWS * TILE + 16) this.dead = true;
  }
  stomp() { this.flat = 30; this.vx = 0; }
  draw(ctx, cam) {
    const x = Math.round(this.x - 1 - cam), y = Math.round(this.y - 2);
    if (this.flat) return ctx.drawImage(SPR.bugFlat, x, y);
    const img = SPR.bug[Math.floor(this.t / 10) % 2][this.vx > 0 ? 1 : 0];
    if (this.knocked) { ctx.save(); ctx.translate(x, y + 16); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore(); return; }
    ctx.drawImage(img, x, y);
  }
}

class Drone extends Enemy {
  constructor(x, y, spec) {
    super(x + 2, y + 2); this.w = 12; this.h = 10; this.baseX = this.x; this.baseY = this.y;
    this.range = spec.range || 48; this.stompable = true; this.dir = -1;
  }
  update(world) {
    this.checkActive(world); if (!this.active) return;
    this.t++;
    if (this.knocked) return this.updateKnocked(world);
    const nx = this.baseX + Math.sin(this.t * 0.02) * this.range;
    this.dir = nx < this.x ? -1 : 1;
    this.x = nx; this.y = this.baseY + Math.sin(this.t * 0.09) * 4;
  }
  draw(ctx, cam) {
    const img = SPR.drone[Math.floor(this.t / 5) % 2][this.dir > 0 ? 1 : 0];
    const x = Math.round(this.x - 2 - cam), y = Math.round(this.y - 4);
    if (this.knocked) { ctx.save(); ctx.translate(x, y + 16); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore(); return; }
    ctx.drawImage(img, x, y);
  }
}

class Spark extends Enemy {
  constructor(x, y, spec) {
    super(x + 3, y + 3); this.w = 10; this.h = 10; this.baseX = this.x; this.baseY = this.y;
    Object.assign(this, { axis: spec.axis || 'x', range: spec.range || 48, speed: spec.speed || 0.03, phase: spec.phase || 0 });
  }
  update(world) {
    this.checkActive(world); if (!this.active) return;
    this.t++;
    const o = (0.5 - 0.5 * Math.cos(this.t * this.speed + this.phase)) * this.range;
    if (this.axis === 'x') this.x = this.baseX + o; else this.y = this.baseY + o;
  }
  hitByBolt() { return false; }
  draw(ctx, cam, time) {
    const cx = Math.round(this.x + 5 - cam), cy = Math.round(this.y + 5);
    ctx.fillStyle = '#ffe14a';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + time * 0.3, r = 5 + ((time + i * 3) % 5);
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    ctx.fillStyle = '#ff9d1a'; ctx.fillRect(cx - 4, cy - 3, 8, 6); ctx.fillRect(cx - 3, cy - 4, 6, 8);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(cx - 3, cy - 2, 6, 4); ctx.fillRect(cx - 2, cy - 3, 4, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

class MovingPlatform {
  constructor(x, y, spec) {
    Object.assign(this, { x, y, baseX: x, baseY: y, w: (spec.w || 3) * TILE, h: 6, axis: spec.axis || 'x', range: spec.range || 48,
      speed: spec.speed || 0.015, phase: spec.phase || 0, t: 0, dx: 0, dy: 0, active: true });
  }
  update() {
    this.t++;
    const o = (0.5 - 0.5 * Math.cos(this.t * this.speed + this.phase)) * this.range;
    const nx = this.axis === 'x' ? this.baseX + o : this.baseX, ny = this.axis === 'y' ? this.baseY + o : this.baseY;
    this.dx = nx - this.x; this.dy = ny - this.y; this.x = nx; this.y = ny;
  }
  draw(ctx, cam, time, world) {
    const x = Math.round(this.x - cam), y = Math.round(this.y);
    const n = this.w / TILE;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = '#1b1430'; ctx.fillRect(x + i * 16, y, 16, 7);
      ctx.fillStyle = world.theme === 'cavern' ? '#d9a441' : world.theme === 'sky' ? '#ffd23f' : '#c9c9e0';
      ctx.fillRect(x + i * 16 + 1, y + 1, 14, 4);
      ctx.fillStyle = '#ffffff99'; ctx.fillRect(x + i * 16 + 1, y + 1, 14, 1);
      ctx.fillStyle = '#1b1430'; ctx.fillRect(x + i * 16 + 7, y + 2, 2, 2);
    }
  }
}

class Firebar {
  constructor(x, y, spec) { Object.assign(this, { cx: x + 8, cy: y + 8, len: spec.len || 5, speed: spec.speed || 0.03, a: 0, active: true, x, y, w: 16, h: 16 }); }
  balls() { const out = []; for (let i = 0; i < this.len; i++) out.push({ x: this.cx + Math.cos(this.a) * i * 8 - 4, y: this.cy + Math.sin(this.a) * i * 8 - 4, w: 8, h: 8 }); return out; }
  update(world, game) {
    this.a += this.speed;
    const p = game.player, hb = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 };
    if (this.balls().some(b => overlap(b, hb))) game.hurtPlayer();
  }
  draw(ctx, cam, time) { for (const b of this.balls()) drawFireball(ctx, Math.round(b.x - cam), Math.round(b.y), time); }
}

function drawFireball(ctx, x, y, time) {
  ctx.fillStyle = '#c2280a'; ctx.fillRect(x + 1, y, 6, 8); ctx.fillRect(x, y + 1, 8, 6);
  ctx.fillStyle = time % 6 < 3 ? '#ff8a1a' : '#ffb21a'; ctx.fillRect(x + 1, y + 1, 6, 6);
  ctx.fillStyle = '#ffe14a'; ctx.fillRect(x + 2, y + 2, 4, 4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 3, 2, 2);
}

class LavaBubble extends Enemy {
  constructor(x, y, spec) { super(x + 3, y); this.w = 10; this.h = 12; this.baseY = y + 4; this.y = this.baseY; this.wait = spec.delay || 0; }
  update(world) {
    this.checkActive(world); if (!this.active) return;
    this.t++;
    if (this.wait > 0) { this.wait--; this.y = this.baseY + 20; return; }
    if (this.vy === 0 && this.y >= this.baseY) this.vy = -7.2;
    this.vy += 0.2; this.y += this.vy;
    if (this.vy > 0 && this.y > this.baseY + 16) { this.vy = 0; this.wait = 110; this.y = this.baseY + 20; }
  }
  hitByBolt() { return false; }
  draw(ctx, cam, time) {
    if (this.wait > 0) return;
    const x = Math.round(this.x - cam), y = Math.round(this.y);
    ctx.save();
    if (this.vy > 0) { ctx.translate(x, y + 12); ctx.scale(1, -1); } else ctx.translate(x, y);
    ctx.fillStyle = '#c2280a'; ctx.fillRect(1, 0, 8, 12); ctx.fillRect(0, 2, 10, 8);
    ctx.fillStyle = '#ff8a1a'; ctx.fillRect(1, 2, 8, 9);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(2, 4, 6, 5);
    ctx.fillStyle = '#1b1430'; ctx.fillRect(3, 5, 1, 2); ctx.fillRect(6, 5, 1, 2);
    if (time % 8 < 4) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(4, 11, 2, 2); }
    ctx.restore();
  }
}

class CometSpawner {
  constructor(x, y, spec) { Object.assign(this, { x0: x, x1: spec.x1, timer: 120, active: true, x, y: 0, w: 0, h: 0 }); }
  update(world, game) {
    const p = game.player;
    if (p.x < this.x0 || p.x > this.x1) return;
    if (--this.timer > 0) return;
    this.timer = 95 + Math.random() * 70;
    world.entities.push(new CometWarn(p.x + 70 + Math.random() * 150));
  }
  draw() {}
}
class CometWarn {
  constructor(x) { this.x = x; this.t = 45; }
  update(world) { if (--this.t <= 0) { this.dead = true; world.entities.push(new Comet(this.x, -14)); } }
  draw(ctx, cam, time) {
    if (time % 8 < 5) { const x = Math.round(this.x - cam); ctx.fillStyle = '#ff4fa3'; ctx.fillRect(x - 4, 2, 9, 11); drawText(ctx, '!', x - 2, 4, '#ffffff'); }
  }
}
class Comet extends Enemy {
  constructor(x, y) { super(x, y); this.w = 8; this.h = 8; this.vx = -1.3; this.vy = 2.4; this.active = true; this.trail = []; }
  update(world) {
    this.t++;
    this.trail.push([this.x, this.y]); if (this.trail.length > 10) this.trail.shift();
    this.x += this.vx; this.y += this.vy;
    if (world.solidAt(Math.floor((this.x + 4) / TILE), Math.floor((this.y + 7) / TILE)) || this.y > ROWS * TILE) {
      this.dead = true; world.burst(this.x + 4, this.y + 4, ['#c08cff', '#ffffff', '#ff4fa3'], 12, 2); Audio8.play('break');
    }
  }
  hitByBolt(game) { this.dead = true; game.world.burst(this.x + 4, this.y + 4, ['#c08cff', '#ffffff'], 10, 2); game.score += 200; return true; }
  draw(ctx, cam) {
    this.trail.forEach(([tx, ty], i) => { ctx.fillStyle = i % 2 ? '#8a3ffc' : '#c08cff'; const s = 1 + (i >> 2); ctx.fillRect(Math.round(tx + 4 - cam), Math.round(ty + 3), s, s); });
    const x = Math.round(this.x - cam), y = Math.round(this.y);
    ctx.fillStyle = '#8a3ffc'; ctx.fillRect(x, y + 1, 8, 6); ctx.fillRect(x + 1, y, 6, 8);
    ctx.fillStyle = '#e0c4ff'; ctx.fillRect(x + 1, y + 2, 5, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 3, 2, 2);
  }
}

class Spring {
  constructor(x, y) { Object.assign(this, { x, y, w: 16, h: 16, squash: 0, active: true }); }
  update(world, game) {
    if (this.squash > 0) this.squash--;
    const p = game.player;
    if (p.vy > 0 && p.x + p.w > this.x + 2 && p.x < this.x + 14 && p.y + p.h >= this.y + 4 && p.y + p.h <= this.y + 14) {
      p.y = this.y + 4 - p.h; p.vy = Input.down('jump') ? -10.5 : -8; p.onGround = false; this.squash = 10; Audio8.play('spring');
    }
  }
  draw(ctx, cam) { ctx.drawImage(SPR.spring[this.squash ? 1 : 0], Math.round(this.x - cam), this.y); }
}

class Checkpoint {
  constructor(x, y) { Object.assign(this, { x, y, w: 8, h: 16, on: false, flagY: 0, active: true }); }
  update(world, game) {
    if (!this.on && game.player.x > this.x) {
      this.on = true; world.checkpoint = { x: this.x, y: this.y }; Audio8.play('checkpoint');
      world.popText(this.x + 4, this.y - 36, 'CHECKPOINT!', '#7dffb5');
    }
    if (this.on && this.flagY < 14) this.flagY += 0.7;
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam);
    ctx.fillStyle = '#1b1430'; ctx.fillRect(x + 3, this.y - 26, 3, 42);
    ctx.fillStyle = '#c9c9e0'; ctx.fillRect(x + 4, this.y - 26, 1, 42);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 2, this.y - 29, 5, 4);
    const fy = Math.round(this.y - 8 - this.flagY);
    ctx.fillStyle = this.on ? '#19b394' : '#6d6d8a'; ctx.fillRect(x + 6, fy, 10, 7);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 9, fy + 2, 3, 3);
  }
}

class FlagGoal {
  constructor(x, y) { Object.assign(this, { x: x + 6, y: 2 * TILE, w: 4, h: GY * TILE - 2 * TILE, flagY: 2 * TILE + 8, active: true, done: false, castleX: x + 5 * TILE }); }
  update(world, game) { if (!this.done && overlap(this, game.player)) { this.done = true; game.finishLevel(this); } }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam);
    // castle
    const cx = Math.round(this.castleX - cam), base = GY * TILE;
    ctx.fillStyle = '#5b5b7a'; ctx.fillRect(cx, base - 64, 80, 64);
    ctx.fillStyle = '#8a86b0'; for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 16 + 2, base - 72, 12, 8);
    ctx.fillStyle = '#9a9ab8'; ctx.fillRect(cx + 2, base - 62, 76, 60);
    ctx.fillStyle = '#5b5b7a'; for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) ctx.fillRect(cx + 2 + i * 16 + (r % 2) * 8, base - 62 + r * 15, 1, 14);
    for (let r = 1; r < 4; r++) ctx.fillRect(cx + 2, base - 62 + r * 15, 76, 1);
    ctx.fillStyle = '#1b1430'; ctx.fillRect(cx + 30, base - 30, 20, 30); ctx.fillRect(cx + 32, base - 33, 16, 3);
    ctx.fillStyle = '#8a3ffc'; ctx.fillRect(cx + 38, base - 92, 2, 22); ctx.fillRect(cx + 40, base - 92, 10, 7);
    // pole
    ctx.fillStyle = '#1e7a2a'; ctx.fillRect(x, this.y, 3, this.h);
    ctx.fillStyle = '#7de87a'; ctx.fillRect(x + 1, this.y, 1, this.h);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, this.y - 6, 7, 7); ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 1, this.y - 5, 2, 2);
    ctx.drawImage(SPR.flag, x - 14, Math.round(this.flagY));
    ctx.fillStyle = '#5a3200'; ctx.fillRect(x - 6, GY * TILE - 4, 15, 4);
  }
}

class Door {
  constructor(x, y) { Object.assign(this, { x: x + 4, y: y + 4, w: 24, h: 28, active: true, done: false }); }
  update(world, game) {
    const p = game.player;
    if (!this.done && p.onGround && overlap(this, p) && Math.abs((p.x + p.w / 2) - (this.x + 12)) < 8) { this.done = true; game.enterBoss(this); }
  }
  draw(ctx, cam, time) {
    const x = Math.round(this.x - 4 - cam), base = GY * TILE;
    ctx.fillStyle = '#3d2470'; ctx.fillRect(x - 40, base - 96, 112, 96);
    ctx.fillStyle = '#5a3a9a'; for (let r = 0; r < 6; r++) for (let i = 0; i < 7; i++) ctx.fillRect(x - 40 + i * 16 + (r % 2) * 8, base - 96 + r * 16, 15, 15);
    ctx.fillStyle = '#3d2470'; for (let i = 0; i < 7; i++) ctx.fillRect(x - 40 + i * 16, base - 104, 10, 8);
    ctx.fillStyle = '#ff4fa3'; ctx.fillRect(x + 8, base - 92, 16, 14); drawText(ctx, 'B', x + 14, base - 89, '#ffffff');
    ctx.fillStyle = '#120814'; ctx.fillRect(x + 2, base - 32, 28, 32); ctx.fillRect(x + 6, base - 36, 20, 4);
    ctx.fillStyle = time % 30 < 15 ? '#ff7a1a55' : '#ff7a1a33'; ctx.fillRect(x + 4, base - 28, 24, 28);
  }
}

// ---------------- Boss: KING BUGZER ----------------
class Boss extends Enemy {
  constructor(x, y) {
    super(x, y);
    Object.assign(this, { w: 34, h: 36, hp: 10, maxHp: 10, dir: -1, fireT: 120, jumpT: 200, minionT: 260, mouth: 0, inv: 0, state: 'idle', walkT: 60, stompable: true });
    this.y = 10 * TILE - this.h;
    this.vx = -0.5;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(world, game) {
    this.t++;
    if (this.inv > 0) this.inv--;
    if (this.state === 'dying') {
      this.vy += 0.15; this.y += this.vy;
      if (this.y > ROWS * TILE + 40) { this.dead = true; }
      return;
    }
    if (this.state === 'idle') { if (game.player.x > world.def.arena.x0 + 40) { this.state = 'fight'; this.active = true; game.startBossFight(); } else return; }
    if (this.state === 'frozen') return;
    const p = game.player, A = world.def.arena;
    const phase2 = this.hp <= this.maxHp / 2;
    this.dir = (p.x + p.w / 2) < (this.x + this.w / 2) ? -1 : 1;
    // walk back & forth on the bridge
    if (--this.walkT <= 0) { this.walkT = 50 + Math.random() * 80; this.vx = (Math.random() < 0.5 ? -1 : 1) * (phase2 ? 0.9 : 0.55); }
    const minX = (A.bridgeX0 + 4) * TILE, maxX = (A.bridgeX1 - 1) * TILE - this.w;
    if (this.x < minX) this.vx = Math.abs(this.vx); if (this.x > maxX) this.vx = -Math.abs(this.vx);
    // jump
    if (--this.jumpT <= 0 && this.onGround) { this.vy = phase2 ? -5.5 : -4.5; this.jumpT = 150 + Math.random() * 120; }
    this.vy = Math.min(this.vy + 0.25, 6);
    const info = world.moveBody(this);
    this.onGround = info.ground;
    if (this.y > ROWS * TILE) { this.defeat(game, true); return; }
    // fire breath
    if (--this.fireT <= 0) {
      this.mouth = 24; this.fireT = phase2 ? 75 : 115;
    }
    if (this.mouth > 0 && --this.mouth === 8) {
      const mx = this.dir < 0 ? this.x - 8 : this.x + this.w - 12;
      const targets = [9 * TILE - 2, 8 * TILE, 6.8 * TILE];
      world.entities.push(new BossFire(mx, this.y + 14, this.dir, targets[Math.floor(Math.random() * targets.length)]));
      if (phase2 && Math.random() < 0.5) world.entities.push(new BossFire(mx, this.y + 14, this.dir, targets[Math.floor(Math.random() * targets.length)], 1.6));
      Audio8.play('fire');
    }
    // minions in phase 2
    if (phase2 && --this.minionT <= 0) {
      this.minionT = 300; const b = new Bug(this.x + (this.dir < 0 ? -8 : this.w), this.y - 4); b.active = true; b.vx = this.dir * 0.6; world.entities.push(b);
    }
  }
  onPlayer(p, game) {
    if (this.state !== 'fight') return;
    if (p.vy > 0 && p.y + p.h - this.y < 12 && this.inv === 0) {
      p.vy = -6; this.damage(game, 2);
    } else if (this.inv < 40) game.hurtPlayer();
  }
  hitByBolt(game) { if (this.state !== 'fight') return false; if (this.inv === 0) this.damage(game, 1); return true; }
  damage(game, n) {
    this.hp -= n; this.inv = 45; Audio8.play('boss');
    game.world.burst(this.x + this.w / 2, this.y + 10, ['#ffd23f', '#ffffff', '#ff4fa3'], 10, 2);
    if (this.hp <= 0) this.defeat(game, false);
  }
  defeat(game, viaLava) {
    if (this.state === 'dying') return;
    this.state = 'dying'; this.vy = viaLava ? 1 : -4; this.inv = 0;
    game.bossDefeated(this);
  }
  draw(ctx, cam, time) {
    let f = this.mouth > 0 ? 'open' : (Math.floor(this.t / 14) % 2 ? 'walkA' : 'walkB');
    if (this.inv > 0 && Math.floor(time / 3) % 2) f = 'hurt';
    if (this.state === 'dying') f = 'hurt';
    const img = SPR.boss[f][this.dir < 0 ? 0 : 1];
    const x = Math.round(this.x - 7 - cam), y = Math.round(this.y - 8);
    if (this.state === 'dying' && this.vy > 0) { ctx.save(); ctx.translate(x, y + 44); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore(); return; }
    ctx.drawImage(img, x, y);
  }
}

class BossFire extends Enemy {
  constructor(x, y, dir, targetY, speed = 2.1) { super(x, y); Object.assign(this, { w: 20, h: 8, vx: dir * speed, targetY, active: true, dir }); }
  update(world) {
    this.t++;
    this.y += Math.max(-1, Math.min(1, (this.targetY - this.y) * 0.06));
    this.x += this.vx;
    if (this.x < world.camX - 40 || this.x > world.camX + VIEW_W + 40) this.dead = true;
  }
  hitByBolt() { return false; }
  draw(ctx, cam, time) {
    const x = Math.round(this.x - cam), y = Math.round(this.y);
    ctx.save(); if (this.dir > 0) { ctx.translate(x + 20, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
    const f = time % 6 < 3;
    ctx.fillStyle = '#c2280a'; ctx.fillRect(0, 2, 20, 4); ctx.fillRect(2, 1, 14, 6);
    ctx.fillStyle = f ? '#ff8a1a' : '#ffb21a'; ctx.fillRect(1, 2, 16, 4); ctx.fillRect(18, f ? 1 : 3, 2, 2);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(1, 3, 10, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(1, 3, 4, 2);
    ctx.restore();
  }
}

class BossSwitch {
  constructor(x, y) { Object.assign(this, { x, y, w: 16, h: 24, on: false, active: true }); }
  update(world, game) {
    const p = game.player;
    if (!this.on && p.x + p.w > this.x + 1 && p.x < this.x + 15 && p.y < this.y + this.h) { this.on = true; game.bossSwitch(this); }
  }
  draw(ctx, cam) { ctx.drawImage(this.on ? SPR.switchOn : SPR.switchOff, Math.round(this.x - cam), Math.round(this.y)); }
}

class Trophy {
  constructor(x, y) { Object.assign(this, { x, y, w: 24, h: 32, active: true, done: false, t: 0 }); }
  update(world, game) { this.t++; if (!this.done && game.bossBeaten && overlap(this, game.player)) { this.done = true; game.ending(); } }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam), y = Math.round(this.y + Math.sin(this.t * 0.06) * 2);
    ctx.fillStyle = '#5a3200'; ctx.fillRect(x + 5, y + 26, 14, 6);
    ctx.fillStyle = '#ffb800'; ctx.fillRect(x + 9, y + 18, 6, 8); ctx.fillRect(x + 2, y + 6, 20, 12); ctx.fillRect(x, y + 6, 3, 7); ctx.fillRect(x + 21, y + 6, 3, 7);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x + 4, y + 7, 3, 9);
    ctx.fillStyle = '#8a3ffc'; ctx.fillRect(x + 9, y - 4, 6, 6); ctx.fillRect(x + 11, y - 6, 2, 10); ctx.fillRect(x + 7, y - 2, 10, 2);
    if (this.t % 40 < 20) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 18, y + 2, 1, 3); ctx.fillRect(x + 17, y + 3, 3, 1); }
    drawText(ctx, 'END', x + 12, y + 36, '#ffd23f', { align: 'center', shadow: '#000' });
  }
}

function spawnEntity(spec, world) {
  const { x, y } = spec;
  switch (spec.type) {
    case 'bug': return new Bug(x, y);
    case 'drone': return new Drone(x, y, spec);
    case 'spark': return new Spark(x, y, spec);
    case 'plat': return new MovingPlatform(x, y, spec);
    case 'firebar': return new Firebar(x, y, spec);
    case 'bubble': return new LavaBubble(x, y, spec);
    case 'comets': return new CometSpawner(x, y, spec);
    case 'spring': return new Spring(x, y);
    case 'checkpoint': return new Checkpoint(x, y);
    case 'flag': return new FlagGoal(x, y);
    case 'door': return new Door(x, y);
    case 'boss': return new Boss(x, y);
    case 'switch': return new BossSwitch(x, y);
    case 'trophy': return new Trophy(x, y);
  }
  console.warn('unknown entity', spec.type);
  return null;
}
