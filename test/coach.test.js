// Runs the coach on random scrambles and checks that it always solves the cube.
require('../js/cube.js');
require('../js/coach.js');
const C = globalThis.Cube, K = globalThis.Coach;
const N = +(process.argv[2] || 300);
let fails = 0, totalMoves = 0, maxStep = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const scr = C.scramble().concat(i % 3 ? [] : [['x', 'z2', "x'", 'z'][i % 4]]);
  let s = C.applyMoves(C.solvedState(), scr);
  let steps = 0, ok = false;
  while (steps < 100) {
    const ts = Date.now();
    const h = K.next(s);
    maxStep = Math.max(maxStep, Date.now() - ts);
    if (h.stage === 'done') { ok = true; break; }
    if (h.stuck) { console.log('STUCK at', h.stage, 'scramble', scr.join(' ')); break; }
    const mv = K.movesOf(h);
    if (!mv.length) { console.log('EMPTY step', h.stage, h.title); break; }
    s = C.applyMoves(s, mv);
    totalMoves += mv.length;
    steps++;
  }
  if (!ok) fails++;
}
console.log(`${N - fails}/${N} solved, avg ${(totalMoves / N).toFixed(0)} moves, slowest hint ${maxStep}ms, total ${Date.now() - t0}ms`);
process.exit(fails ? 1 : 0);
