// Keyboard + handheld controls (D-pad, A/B, START/SELECT), merged into one set of virtual buttons.

const Input = (() => {
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'run', KeyJ: 'run', ShiftLeft: 'run', ShiftRight: 'run',
    KeyE: 'read', Enter: 'start',
    Escape: 'pause', KeyP: 'pause',
  };
  // what each handheld button means to the overlays (fed to key listeners)
  const PAD_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space', run: 'KeyX', start: 'Enter', select: 'KeyC' };
  // what each handheld button means to the game
  const PAD_GAME = { left: 'left', right: 'right', up: 'read', down: 'down', jump: 'jump', run: 'run', start: 'pause', select: null };

  const held = {}, padHeld = {}, pressedQ = new Set();
  const listeners = [];
  const emit = e => listeners.forEach(fn => fn(e));

  window.addEventListener('keydown', e => {
    const b = KEYMAP[e.code];
    if (b) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !e.target.closest?.('input, textarea')) e.preventDefault();
      if (!held[b]) pressedQ.add(b);
      held[b] = true;
    }
    // listeners run after queuing so an overlay can clear the press it consumed
    emit(e);
  });
  window.addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) held[b] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; releaseAll(); });

  // ---- handheld pad ----
  const padState = {}; // logical pad button -> pressed
  function setPad(name, on) {
    if (!!padState[name] === on) return;
    padState[name] = on;
    const g = PAD_GAME[name];
    if (g) { if (on && !padHeld[g]) pressedQ.add(g); padHeld[g] = on; }
    if (on) {
      try { navigator.vibrate && navigator.vibrate(8); } catch (err) { /* not allowed */ }
      emit({ code: PAD_KEYS[name], virtual: true, target: document.body, preventDefault() {} });
    }
    document.querySelectorAll(`[data-pad-vis="${name}"]`).forEach(el => el.classList.toggle('on', on));
  }
  function releaseAll() { for (const k in padState) setPad(k, false); for (const k in padHeld) padHeld[k] = false; }

  function bindPad() {
    // D-pad: one surface, direction from the thumb's offset so sliding works
    const dpad = document.getElementById('dpad');
    for (const d of ['up', 'down', 'left', 'right']) dpad.querySelector('.' + d).dataset.padVis = d;
    const dirs = new Map();
    const dpadUpdate = () => {
      const all = { left: false, right: false, up: false, down: false };
      for (const d of dirs.values()) for (const k in d) if (d[k]) all[k] = true;
      for (const k in all) setPad(k, all[k]);
    };
    const dpadMove = e => {
      const r = dpad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const dz = 0.22;
      dirs.set(e.pointerId, {
        left: dx < -dz && Math.abs(dx) > Math.abs(dy) * 0.45,
        right: dx > dz && Math.abs(dx) > Math.abs(dy) * 0.45,
        up: dy < -dz && Math.abs(dy) > Math.abs(dx) * 0.6,
        down: dy > dz && Math.abs(dy) > Math.abs(dx) * 0.6,
      });
      dpadUpdate();
    };
    dpad.addEventListener('pointerdown', e => { e.preventDefault(); dpad.setPointerCapture?.(e.pointerId); dpadMove(e); });
    dpad.addEventListener('pointermove', e => { if (dirs.has(e.pointerId)) dpadMove(e); });
    const dpadEnd = e => { dirs.delete(e.pointerId); dpadUpdate(); };
    dpad.addEventListener('pointerup', dpadEnd); dpad.addEventListener('pointercancel', dpadEnd);

    // A/B: a thumb resting between the two buttons presses both (run + jump)
    const ab = document.getElementById('ab');
    const btnA = ab.querySelector('[data-ab="jump"]'), btnB = ab.querySelector('[data-ab="run"]');
    btnA.dataset.padVis = 'jump'; btnB.dataset.padVis = 'run';
    const abTouches = new Map();
    const abUpdate = () => {
      let a = false, b = false;
      for (const t of abTouches.values()) { a = a || t.a; b = b || t.b; }
      setPad('jump', a); setPad('run', b);
    };
    const dist = (el, x, y) => { const r = el.getBoundingClientRect(); return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) / (r.width / 2); };
    const abMove = e => {
      const da = dist(btnA, e.clientX, e.clientY), db = dist(btnB, e.clientX, e.clientY);
      let a = da < 1.2, b = db < 1.2;
      if (!a && !b) { if (da < db) a = da < 2.2; else b = db < 2.2; } // forgiving: nearest button wins
      abTouches.set(e.pointerId, { a, b }); abUpdate();
    };
    ab.addEventListener('pointerdown', e => { e.preventDefault(); ab.setPointerCapture?.(e.pointerId); abMove(e); });
    ab.addEventListener('pointermove', e => { if (abTouches.has(e.pointerId)) abMove(e); });
    const abEnd = e => { abTouches.delete(e.pointerId); abUpdate(); };
    ab.addEventListener('pointerup', abEnd); ab.addEventListener('pointercancel', abEnd);

    // START / SELECT
    document.querySelectorAll('#device [data-btn]').forEach(el => {
      const name = el.dataset.btn; el.dataset.padVis = name;
      el.addEventListener('pointerdown', e => { e.preventDefault(); setPad(name, true); });
      const off = e => { e.preventDefault(); setPad(name, false); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    });
    document.getElementById('device').addEventListener('contextmenu', e => e.preventDefault());
  }

  let frame = new Set();
  return {
    down: b => !!(held[b] || padHeld[b]),
    pressed: b => frame.has(b),
    // called once per game tick: moves queued presses into this tick
    tick() { frame = new Set(pressedQ); pressedQ.clear(); },
    clear() { pressedQ.clear(); frame = new Set(); },
    bindPad,
    onKey(fn) { listeners.push(fn); },
  };
})();
