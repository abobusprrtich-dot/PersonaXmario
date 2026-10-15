// Keyboard + on-screen touch controls, merged into one set of virtual buttons.

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
  const held = {}, touchHeld = {}, pressedQ = new Set();
  const isDown = b => !!(held[b] || touchHeld[b]);
  const listeners = [];

  window.addEventListener('keydown', e => {
    const b = KEYMAP[e.code];
    if (b) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !e.target.closest?.('input, textarea')) e.preventDefault();
      if (!held[b]) pressedQ.add(b);
      held[b] = true;
    }
    // listeners run after queuing so an overlay can clear the press it consumed
    listeners.forEach(fn => fn(e));
  });
  window.addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) held[b] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in touchHeld) touchHeld[k] = false; });

  function bindTouch(root) {
    root.querySelectorAll('[data-btn]').forEach(el => {
      const b = el.dataset.btn;
      const on = e => { e.preventDefault(); if (!touchHeld[b]) pressedQ.add(b); touchHeld[b] = true; el.classList.add('on'); };
      const off = e => { e.preventDefault(); touchHeld[b] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }

  let frame = new Set();
  return {
    down: isDown,
    pressed: b => frame.has(b),
    // called once per game tick: moves queued presses into this tick
    tick() { frame = new Set(pressedQ); pressedQ.clear(); },
    clear() { pressedQ.clear(); frame = new Set(); },
    bindTouch,
    onKey(fn) { listeners.push(fn); },
  };
})();
