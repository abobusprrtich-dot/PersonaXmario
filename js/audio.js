// Chiptune SFX + tiny music sequencer on WebAudio. All tunes are original.

const Audio8 = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false;
  try { muted = localStorage.getItem('px-muted') === '1'; } catch (e) { /* storage blocked */ }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('px-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
  }

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) {
    const m = /^([A-G]#?)(\d)$/.exec(n); if (!m) return 0;
    return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
  }

  function tone(f, t, dur, type = 'square', vol = 0.3, dest = sfxGain, slideTo = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(t, dur, vol = 0.3, dest = sfxGain, hp = 400) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur);
  }

  const SFX = {
    jump: t => tone(260, t, 0.16, 'square', 0.18, sfxGain, 620),
    coin: t => { tone(988, t, 0.07, 'square', 0.16); tone(1319, t + 0.07, 0.25, 'square', 0.16); },
    stomp: t => { tone(400, t, 0.1, 'square', 0.2, sfxGain, 120); noise(t, 0.06, 0.15); },
    bump: t => tone(140, t, 0.09, 'triangle', 0.4, sfxGain, 90),
    break: t => { noise(t, 0.25, 0.3, sfxGain, 200); tone(180, t, 0.15, 'square', 0.12, sfxGain, 60); },
    power: t => { ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(freq(n), t + i * 0.06, 0.1, 'square', 0.14)); },
    appear: t => { ['G4', 'C5', 'E5', 'G5'].forEach((n, i) => tone(freq(n), t + i * 0.05, 0.08, 'triangle', 0.25)); },
    pipe: t => { [0, 1, 2].forEach(i => tone(220 - i * 40, t + i * 0.12, 0.1, 'square', 0.18)); },
    hurt: t => { tone(600, t, 0.3, 'square', 0.18, sfxGain, 100); },
    die: t => { ['B4', 'F5', 'F5', 'F5', 'E5', 'D5', 'C5'].forEach((n, i) => tone(freq(n), t + 0.3 + i * 0.13, 0.12, 'square', 0.16)); tone(300, t, 0.25, 'square', 0.2, sfxGain, 80); },
    bolt: t => tone(1200, t, 0.08, 'square', 0.1, sfxGain, 300),
    info: t => { tone(784, t, 0.06, 'square', 0.14); tone(1175, t + 0.06, 0.12, 'square', 0.14); },
    boss: t => { tone(90, t, 0.35, 'sawtooth', 0.3, sfxGain, 50); noise(t, 0.3, 0.2, sfxGain, 100); },
    fire: t => { noise(t, 0.2, 0.18, sfxGain, 800); tone(300, t, 0.2, 'sawtooth', 0.1, sfxGain, 120); },
    spring: t => tone(200, t, 0.25, 'triangle', 0.35, sfxGain, 900),
    checkpoint: t => { ['E5', 'G5', 'B5', 'E6'].forEach((n, i) => tone(freq(n), t + i * 0.08, 0.12, 'square', 0.14)); },
    collapse: t => { noise(t, 1.0, 0.35, sfxGain, 80); tone(120, t, 1.0, 'sawtooth', 0.2, sfxGain, 30); },
    clear: t => { ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(freq(n), t + i * 0.11, 0.16, 'square', 0.15)); },
    select: t => tone(660, t, 0.06, 'square', 0.12),
  };

  function play(name) {
    if (!ctx || muted) return;
    const f = SFX[name]; if (f) f(ctx.currentTime + 0.005);
  }

  // ---- music: patterns of 16th notes. '.' = rest, '-' = hold ----
  const SONGS = {
    fields: {
      bpm: 138,
      lead: 'E5 . G5 . C6 . G5 . A5 . G5 . E5 . D5 . C5 . E5 . G5 . E5 . F5 . E5 . D5 - - . E5 . G5 . C6 . D6 . E6 . D6 . C6 . A5 . G5 . E5 . D5 . E5 . C5 - - - . . . .',
      bass: 'C3 . C3 . G2 . G2 . A2 . A2 . F2 . F2 . C3 . C3 . G2 . G2 . F2 . F2 . G2 . G2 . C3 . C3 . E3 . E3 . F3 . F3 . A2 . A2 . G2 . G2 . G2 . G2 . C3 . G2 . C3 . . . .',
    },
    cavern: {
      bpm: 120,
      lead: 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 . E5 . . . . . . . A4 . C5 . E5 . B5 . A5 . E5 . C5 . B4 . A4 . . . . . . . F4 . A4 . C5 . F5 . E5 . C5 . A4 . G4 . G#4 . B4 . E5 . . . . .',
      bass: 'A2 . . . A2 . . . A2 . . . G2 . . . F2 . . . F2 . . . E2 . . . E2 . . . A2 . . . A2 . . . A2 . . . G2 . . . F2 . . . F2 . . . E2 . . . E2 . . . F2 . . . F2 . . . D2 . . . E2 . . .',
    },
    sky: {
      bpm: 150,
      lead: 'G4 . C5 . E5 . G5 - - . F5 . E5 . D5 . E5 . C5 . G4 . A4 . C5 . D5 - - . C5 . A4 . G4 . A4 . B4 . C5 . D5 . E5 . F5 . G5 . A5 - - . G5 . F5 . E5 . D5 - - - . . . .',
      bass: 'C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . A2 . E3 . A2 . E3 . F2 . C3 . G2 . D3 . C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . D3 . A3 . G2 . D3 . G2 . G2 . G2 . G2 .',
    },
    boss: {
      bpm: 168,
      lead: 'E5 . E5 . D#5 . E5 . . . G5 . F#5 . E5 . B4 . C5 . D5 . E5 . . . E5 . D#5 . E5 . A5 . G5 . F#5 . E5 . D#5 . . . B4 . . .',
      bass: 'E2 E2 . E2 E2 . E2 E2 . G2 . E2 E2 . E2 . C2 C2 . C2 C2 . C2 C2 . D2 . B1 B1 . B1 .',
    },
    room: {
      bpm: 100,
      lead: 'C5 . . . E5 . . . G5 . . . E5 . . . F5 . . . A5 . . . C6 . . . A5 . . . G5 . . . E5 . . . D5 . . . B4 . . . C5 . . . . . . . . . . . . . . .',
      bass: 'C3 . . . . . . . . . . . . . . . F2 . . . . . . . . . . . . . . . G2 . . . . . . . . . . . . . . . C3 . . . . . . . G2 . . . . . . .',
    },
    title: null,
  };
  SONGS.title = SONGS.fields;

  let current = null, timer = null, step = 0, nextTime = 0;
  function parse(s) { return s.trim().split(/\s+/); }

  function playMusic(name) {
    if (!ctx) return;
    if (current && current.name === name) return;
    stopMusic();
    const song = SONGS[name]; if (!song) return;
    current = { name, bpm: song.bpm, lead: parse(song.lead), bass: parse(song.bass) };
    step = 0; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function stopMusic() { if (timer) clearInterval(timer); timer = null; current = null; }

  function schedule() {
    if (!current || !ctx) return;
    const stepDur = 60 / current.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      const voice = (seq, type, vol, oct) => {
        const n = seq[step % seq.length];
        if (n && n !== '.' && n !== '-') {
          let hold = 1; while (seq[(step + hold) % seq.length] === '-') hold++;
          tone(freq(n) * oct, nextTime, stepDur * hold * 0.95, type, vol, musicGain);
        }
      };
      voice(current.lead, 'square', 0.09, 1);
      voice(current.bass, 'triangle', 0.22, 1);
      nextTime += stepDur; step++;
    }
  }

  return { init, play, playMusic, stopMusic, setMuted, isMuted: () => muted };
})();
