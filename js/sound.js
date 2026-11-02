// Sound effects, made on the fly with Web Audio (no audio files).
// A turn is a soft glide of filtered noise that swells and fades with the
// layer's movement (no click when it lands). Solving plays a short chime.
(function (global) {
  'use strict';

  // Each style: glide loudness, the band of the noise [center Hz, width Q],
  // and grit (0 = smooth, 1 = rough and scratchy).
  const STYLES = {
    smooth: { name: 'Smooth glide', glide: 0.035, grit: 0.15, glideBand: [1800, 0.5] },
    clacky: { name: 'Fuller glide', glide: 0.04, grit: 0.3, glideBand: [1500, 0.6] },
    classic: { name: 'Gritty (classic cube)', glide: 0.08, grit: 0.85, glideBand: [1100, 0.8] },
  };

  let ctx = null;
  let noise = null;
  let master = null;
  let style = 'smooth';
  try {
    const saved = localStorage.getItem('cube-coach-sound');
    if (saved === 'off' || STYLES[saved]) style = saved;
  } catch (e) { /* storage unavailable */ }

  function audio() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // A gentle compressor keeps fast runs of turns from getting harsh.
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -18;
      master.ratio.value = 4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // The glide: soft, airy noise that swells and fades with the turn.
  // Grit chops it into tiny bumps, like rougher plastic rubbing.
  function glide(at, length, st, level) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(st.glideBand[0] * 0.8, at);
    bp.frequency.linearRampToValueAtTime(st.glideBand[0] * 1.3, at + length); // rising "whoosh"
    bp.Q.value = st.glideBand[1];
    const g = ctx.createGain();
    const n = 64;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const shape = Math.sin(Math.PI * k) ** 2;
      env[i] = Math.max(0.0001, st.glide * level * shape * (1 - st.grit + st.grit * Math.random() * 2));
    }
    g.gain.setValueCurveAtTime(env, at, length);
    src.connect(bp).connect(g).connect(master);
    src.start(at, Math.random() * 0.5, length + 0.02);
  }

  // A layer turn lasting `seconds`: just the glide, no click when it lands.
  // Half turns glide a bit louder; scramble turns are quieter.
  const GLIDE_BOOST = 2.5; // the glide used to sit under the clack, so lift it
  function turn(seconds = 0.25, quarters = 1, quiet = false, forceStyle) {
    const st = STYLES[forceStyle || style];
    if (!st || !audio()) return;
    const t = ctx.currentTime + 0.005;
    const level = (quiet ? 0.45 : 1) * GLIDE_BOOST;
    const len = Math.max(0.05, seconds);
    glide(t, len, st, level * (quarters === 2 ? 1.2 : 1));
  }

  // A rising arpeggio for a solved cube.
  function solved() {
    if (style === 'off' || !audio()) return;
    const t = ctx.currentTime + 0.05;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const s = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (i === 3 ? 0.9 : 0.35));
      o.connect(g).connect(master);
      o.start(s);
      o.stop(s + 1);
    });
  }

  // Choose a style ('off' for silence) and play a sample of it.
  function setStyle(id) {
    style = id === 'off' || STYLES[id] ? id : 'smooth';
    try { localStorage.setItem('cube-coach-sound', style); } catch (e) { /* storage unavailable */ }
    if (style !== 'off') {
      turn(0.22);
      setTimeout(() => turn(0.18), 260);
      setTimeout(() => turn(0.26, 2), 470);
    }
  }

  global.Sound = {
    STYLES, turn, solved, setStyle,
    style: () => style,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
