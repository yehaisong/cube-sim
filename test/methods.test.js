// Runs every advanced method's coach on random scrambles; reports solve rate and timing.
require('../js/cube.js');
require('../js/engine.js');
require('../js/methods.js');
const C = globalThis.Cube, M = globalThis.METHODS;
const N = +(process.argv[2] || 10);
const only = process.argv[3];
let anyFail = false;
for (const [id, m] of Object.entries(M)) {
  if (only && id !== only) continue;
  let ok = 0, moves = 0, slowest = 0, slowStage = '';
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    let s = C.applyMoves(C.solvedState(), C.scramble());
    let done = false;
    for (let step = 0; step < 120; step++) {
      const ts = Date.now();
      const h = m.next(s);
      const dt = Date.now() - ts;
      if (dt > slowest) { slowest = dt; slowStage = h.stage; }
      if (h.stage === 'done') { done = true; break; }
      if (h.stuck) { console.log(`  ${id}: stuck at ${h.stage}`); break; }
      const mv = [].concat(...h.steps.map(x => x.moves));
      if (!mv.length) { console.log(`  ${id}: empty step at ${h.stage}`); break; }
      s = C.applyMoves(s, mv);
      moves += mv.length;
    }
    if (done) ok++;
  }
  // Every stage should be able to produce a practice position.
  const noExample = m.stages.filter(st => !m.example(st.id)).map(st => st.id);
  if (ok < N || noExample.length) anyFail = true;
  console.log(`${id.padEnd(7)} ${ok}/${N} solved, avg ${(moves / N).toFixed(0)} moves, slowest hint ${slowest}ms (${slowStage}), ${Date.now() - t0}ms${noExample.length ? ', NO EXAMPLE: ' + noExample : ''}`);
}
process.exit(anyFail ? 1 : 0);
