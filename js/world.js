// World: tiles, collision, block bumps, particles and level rendering.

const VIEW_W = 384, VIEW_H = 224;

class World {
  constructor(def) {
    this.def = def;
    this.w = def.w;
    this.tiles = def.tiles.map(r => r.slice());
    this.theme = def.theme;
    this.tileset = SPR.tiles[def.theme];
    this.bg = SPR.bg[def.theme];
    this.sky = buildSky((def.sky || ['#000', '#000'])[0], (def.sky || ['#000', '#000'])[1]);
    this.decor = def.decor || [];
    this.entities = [];
    this.particles = [];
    this.bumps = new Map();
    this.camX = 0;
    this.time = 0;
    this.checkpoint = { x: def.start.x, y: def.start.y };
    this.camLock = null;
    for (const spec of def.entities) {
      const e = spawnEntity(spec, this);
      if (e) this.entities.push(e);
    }
  }

  get pxW() { return this.w * TILE; }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.STONE; // side walls
    if (ty < 0 || ty >= ROWS) return T.EMPTY;
    return this.tiles[ty][tx];
  }
  setTile(tx, ty, t) { if (tx >= 0 && tx < this.w && ty >= 0 && ty < ROWS) this.tiles[ty][tx] = t; }
  solidAt(tx, ty) { return SOLID_TILES.has(this.tileAt(tx, ty)); }

  // Axis-separated tile collision. Returns info about what was hit.
  moveBody(e, opts = {}) {
    const info = { hitX: false, ground: false, head: [] };
    const prevBottom = e.y + e.h;
    // X
    e.x += e.vx;
    {
      const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
      if (e.vx > 0) {
        const tx = Math.floor((e.x + e.w - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { e.x = tx * TILE - e.w; info.hitX = true; break; }
      } else if (e.vx < 0) {
        const tx = Math.floor(e.x / TILE);
        for (let ty = y0; ty <= y1; ty++) if (this.solidAt(tx, ty)) { e.x = (tx + 1) * TILE; info.hitX = true; break; }
      }
    }
    // Y
    e.y += e.vy;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (SOLID_TILES.has(t) || (t === T.SEMI && !opts.noSemi && prevBottom <= ty * TILE + 0.5)) {
          e.y = ty * TILE - e.h; e.vy = 0; info.ground = true; break;
        }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty) || (opts.hidden && this.tileAt(tx, ty) === T.HIDDEN)) info.head.push(tx);
      if (info.head.length) { e.y = (ty + 1) * TILE; e.vy = 0; info.headRow = ty; }
    }
    return info;
  }

  // Is there floor right below the body? (for platforms/ledges checks)
  groundBelow(e) {
    const ty = Math.floor((e.y + e.h + 1) / TILE);
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    for (let tx = x0; tx <= x1; tx++) { const t = this.tileAt(tx, ty); if (SOLID_TILES.has(t) || t === T.SEMI) return true; }
    return false;
  }

  overlapsTile(box, types, inset = 2) {
    const x0 = Math.floor((box.x + inset) / TILE), x1 = Math.floor((box.x + box.w - inset) / TILE);
    const y0 = Math.floor((box.y + inset) / TILE), y1 = Math.floor((box.y + box.h - inset) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (types.has(this.tileAt(tx, ty))) return { tx, ty };
    return null;
  }

  bump(tx, ty, game) {
    const t = this.tileAt(tx, ty);
    const key = tx + ',' + ty;
    const startBump = () => this.bumps.set(key, 10);
    if (t === T.QCOIN || t === T.HIDDEN) {
      if (t === T.HIDDEN) game.world.popText(tx * TILE + 8, ty * TILE - 20, 'SECRET!', '#7dffb5');
      this.setTile(tx, ty, T.USED); startBump();
      this.entities.push(new CoinPop(tx * TILE + 4, ty * TILE - 8));
      game.addCoin(tx * TILE + 8, ty * TILE - 16);
    } else if (t === T.QPOWER) {
      this.setTile(tx, ty, T.USED); startBump();
      this.entities.push(new UnoItem(tx * TILE, ty * TILE));
      Audio8.play('appear');
    } else if (t === T.BRICK) {
      if (game.player.powered) {
        this.setTile(tx, ty, T.EMPTY);
        const cols = this.theme === 'cavern' ? ['#5a6275', '#232733'] : [THEMES[this.theme].brick[0], THEMES[this.theme].brick[2]];
        for (let i = 0; i < 4; i++) this.particles.push({ x: tx * TILE + 4 + (i % 2) * 8, y: ty * TILE + 4 + (i >> 1) * 8, vx: (i % 2 ? 1.2 : -1.2), vy: (i >> 1) ? -3 : -5, g: 0.3, life: 70, size: 5, color: cols[i % 2] });
        Audio8.play('break'); game.score += 50;
      } else { startBump(); Audio8.play('bump'); }
    } else if (t === T.INFO) {
      startBump(); Audio8.play('info');
      game.openPartAt(tx);
    } else {
      Audio8.play('bump');
    }
    // knock out enemies standing on the bumped tile
    for (const e of this.entities) {
      if (!e.enemy || e.dead || !e.active) continue;
      const bottom = e.y + e.h;
      if (Math.abs(bottom - ty * TILE) < 3 && e.x + e.w > tx * TILE && e.x < (tx + 1) * TILE) e.knockOut?.(game);
    }
    // bounce coins sitting on top
    if (this.tileAt(tx, ty - 1) === T.COIN) { this.setTile(tx, ty - 1, T.EMPTY); game.addCoin(tx * TILE + 8, (ty - 1) * TILE); this.entities.push(new CoinPop(tx * TILE + 4, (ty - 1) * TILE)); }
  }

  burst(x, y, colors, n = 8, speed = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 0.12, life: 25 + Math.random() * 20, size: 2, color: colors[i % colors.length] });
    }
  }
  popText(x, y, str, color = '#fff') { this.particles.push({ x, y, vx: 0, vy: -0.6, g: 0, life: 50, text: str, color }); }

  updateParticles() {
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; if (p.text) p.vy *= 0.96; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const [k, v] of this.bumps) { if (v <= 1) this.bumps.delete(k); else this.bumps.set(k, v - 1); }
  }

  // ---------- rendering ----------
  drawBackground(ctx) {
    ctx.drawImage(this.sky, 0, 0);
    for (const layer of this.bg) {
      const off = -Math.floor((this.camX * layer.speed) % 512);
      for (let x = off; x < VIEW_W; x += 512) ctx.drawImage(layer.img, x, 0);
    }
    // ambient animation
    if (this.theme === 'cavern') {
      for (let i = 0; i < 14; i++) {
        const x = ((hash(i, 40) * 900 - this.camX * 0.2) % 520 + 520) % 520 - 20, y = 20 + hash(i, 41) * 170;
        const on = Math.sin(this.time * 0.05 + i * 1.7) > 0.3;
        ctx.fillStyle = on ? ['#ff4f6b', '#7dffb5', '#ffe08a'][i % 3] : '#1a2a22';
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    } else if (this.theme === 'sky') {
      for (let i = 0; i < 3; i++) { // decorative streaking comets
        const t = (this.time * 0.6 + i * 260) % 700;
        const x = 420 - t + i * 40, y = -10 + t * 0.35 + i * 20;
        ctx.fillStyle = '#c08cff66'; ctx.fillRect(Math.round(x + 4), Math.round(y - 2), 14, 1);
        ctx.fillStyle = '#ffffffcc'; ctx.fillRect(Math.round(x), Math.round(y - 2), 3, 2);
      }
    } else if (this.theme === 'castle') {
      // dithered lava glow near the floor, pulsing between two densities
      if (!World.glow) World.glow = [0.4, 0.6].map(k => paint(VIEW_W, 74, (x, y) => dith(x, y, y / 74 * k) ? '#3a1418' : null));
      ctx.drawImage(World.glow[Math.sin(this.time * 0.05) > 0 ? 1 : 0], 0, 150);
    }
  }

  drawTiles(ctx) {
    const ts = this.tileset, cam = Math.floor(this.camX);
    const x0 = Math.max(0, Math.floor(cam / TILE)), x1 = Math.min(this.w - 1, x0 + Math.ceil(VIEW_W / TILE) + 1);
    const qf = [0, 0, 0, 1, 2, 1][Math.floor(this.time / 8) % 6];
    for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = this.tiles[ty][tx]; if (!t) continue;
      let img = null;
      switch (t) {
        case T.GROUND: {
          const top = !(ty > 0 && this.tiles[ty - 1][tx] === T.GROUND);
          ctx.drawImage(top ? ts.groundTop : ts.groundFill, tx * TILE - cam, ty * TILE);
          if (tx > 0 && this.tiles[ty][tx - 1] !== T.GROUND) ctx.drawImage(top ? ts.edgeTopL : ts.edgeL, tx * TILE - cam, ty * TILE);
          if (tx < this.w - 1 && this.tiles[ty][tx + 1] !== T.GROUND) ctx.drawImage(top ? ts.edgeTopR : ts.edgeR, tx * TILE - cam, ty * TILE);
          continue;
        }
        case T.WATER: img = (ty > 0 && this.tiles[ty - 1][tx] === T.WATER ? ts.waterFill : ts.waterTop)[Math.floor(this.time / 24) % 2]; break;
        case T.BRICK: img = ts.brick; break;
        case T.QCOIN: case T.QPOWER: img = ts.q[qf]; break;
        case T.USED: img = ts.used; break;
        case T.SOLID: img = ts.solid; break;
        case T.STONE: img = ts.stone; break;
        case T.PIPE_TL: img = ts.pipeTL; break; case T.PIPE_TR: img = ts.pipeTR; break;
        case T.PIPE_L: img = ts.pipeL; break; case T.PIPE_R: img = ts.pipeR; break;
        case T.PIPE_BL: img = ts.pipeBL; break; case T.PIPE_BR: img = ts.pipeBR; break;
        case T.SEMI: img = ts.semi; break;
        case T.LAVA: img = (ty > 0 && this.tiles[ty - 1][tx] === T.LAVA ? ts.lavaFill : ts.lavaTop)[Math.floor(this.time / 20) % 2]; break;
        case T.BRIDGE: img = ts.bridge; break;
        case T.CHAIN: img = ts.chain; break;
        case T.SPIKES: img = ts.spikes; break;
        case T.COIN: img = ts.coin[Math.floor(this.time / 8) % 4]; break;
        case T.INFO: img = Game.isPartReadAt(tx) ? ts.infoRead : ts.info[Math.floor(this.time / 20) % 2]; break;
      }
      if (!img) continue;
      const b = this.bumps.get(tx + ',' + ty);
      const oy = b ? -Math.round(Math.sin(Math.PI * (10 - b) / 10) * 5) : 0;
      ctx.drawImage(img, tx * TILE - cam, ty * TILE + oy);
    }
  }

  // scenery behind the tiles: placed props + auto grass tufts / flowers on ground tops
  drawDecor(ctx) {
    const cam = Math.floor(this.camX), D = SPR.deco, t = this.time;
    const x0 = Math.max(0, Math.floor(cam / TILE) - 1), x1 = Math.min(this.w - 1, x0 + Math.ceil(VIEW_W / TILE) + 2);
    if (this.theme === 'fields' || this.theme === 'sky') {
      for (let tx = x0; tx <= x1; tx++) for (let ty = 1; ty < ROWS; ty++) {
        if (this.tiles[ty][tx] !== T.GROUND || this.tiles[ty - 1][tx] !== T.EMPTY) continue;
        const h = hash(tx, ty * 7 + 3);
        const img = h < 0.22 ? D.tuft : h < 0.29 ? D.flowerA : h < 0.34 ? D.flowerB : null;
        if (img) ctx.drawImage(img, tx * TILE - cam + Math.floor(hash(tx, 9) * 8), ty * TILE - img.height);
      }
    } else if (this.theme === 'cavern') {
      for (let tx = x0; tx <= x1; tx++) for (let ty = 1; ty < ROWS; ty++) {
        if (this.tiles[ty][tx] !== T.GROUND || this.tiles[ty - 1][tx] !== T.EMPTY) continue;
        const h = hash(tx, ty * 5 + 1);
        if (h < 0.12) { const l = D.led[(tx % 3)][Math.floor(t / 30 + tx) % 2]; ctx.drawImage(l, tx * TILE - cam + 4, ty * TILE - 14); }
        else if (h < 0.18) ctx.drawImage(D.resistor, tx * TILE - cam - 1, ty * TILE - 6);
        else if (h < 0.22) ctx.drawImage(D.capacitor, tx * TILE - cam + 3, ty * TILE - 16);
      }
    }
    for (const d of this.decor) {
      const x = d.x - cam;
      if (x > VIEW_W + 16 || x < -80) continue;
      let img = D[d.type];
      if (Array.isArray(img)) img = Array.isArray(img[0]) ? img[d.v || 0][Math.floor(t / 30) % 2] : img[Math.floor(t / (d.type === 'torch' ? 7 : 14)) % img.length];
      if (img) ctx.drawImage(img, Math.round(x), Math.round(d.y - img.height));
    }
  }

  drawParticles(ctx) {
    const cam = Math.floor(this.camX);
    for (const p of this.particles) {
      if (p.text) { drawText(ctx, p.text, p.x - cam, p.y, p.color, { align: 'center', shadow: '#000' }); continue; }
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cam), Math.round(p.y), p.size, p.size);
    }
  }
}
