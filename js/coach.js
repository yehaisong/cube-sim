// The coach: looks at a cube state, works out which beginner-method step the
// learner is on, and finds the next chunk of moves *the way a human following
// the method would do it* (setup turns + the step's algorithm), with
// plain-language explanations for each part.
(function (global) {
  'use strict';
  const C = global.Cube;
  const am = C.applyMoves;
  const UP = C.UP;
  const D_N = [0, -1, 0];

  const A = s => s.split(' ');
  const ALGS = {
    sexy: A("R U R' U'"),
    midRight: A("U R U' R' U' F' U F"),
    midLeft: A("U' L' U L U F U' F'"),
    yCross: A("F R U R' U' F'"),
    yEdges: A("R U R' U R U2 R' U"),
    yCorners: A("U R U' L' U R' U' L"),
    twist: A("R' D' R D"),
  };

  const POW = { U: [[], ['U'], ['U2'], ["U'"]], y: [[], ['y'], ['y2'], ["y'"]] };
  const Upow = b => POW.U[b & 3];
  const Ypow = b => POW.y[b & 3];
  const rep = (alg, k) => [].concat(...Array(k).fill(alg));
  const cn = c => C.COLOR_NAMES[c];
  const fmt = toks => toks.join(' ');

  const STAGES = [
    { id: 'cross', title: 'White cross' },
    { id: 'corners', title: 'White corners' },
    { id: 'middle', title: 'Middle layer' },
    { id: 'ycross', title: 'Yellow cross' },
    { id: 'yedges', title: 'Yellow edges' },
    { id: 'ycorners', title: 'Position yellow corners' },
    { id: 'yorient', title: 'Twist yellow corners' },
  ];

  const f2lDone = st => st.cross === 4 && st.corners === 4 && st.middle === 4;

  function stageOf(s) {
    if (C.isSolved(s)) return 'done';
    if (C.center(s, D_N) !== 'w') return 'hold';
    const st = C.stats(s);
    if (!f2lDone(st)) {
      // Halfway through R' D' R D the bottom looks broken on purpose.
      // (The top may be turned while doing it, so check every U alignment.)
      const topEdgesOk = [0, 1, 2, 3].some(b => C.stats(am(s, Upow(b))).uEdges === 4);
      if (topEdgesOk && solveOrient(s, false)) return 'yorient';
      if (st.cross < 4) return 'cross';
      if (st.corners < 4) return 'corners';
      return 'middle';
    }
    if (st.yellowEdgesUp < 4) return 'ycross';
    if (st.uEdges < 4) return 'yedges';
    if (st.uCornersPlaced < 4) return 'ycorners';
    return 'yorient';
  }

  // Which named pieces are solved (used to say "the white-green edge").
  function solvedNames(s, list) {
    return new Set(list.filter(p => C.pieceSolved(s, p)).map(p => C.colorSet(C.pieceColors(s, p))));
  }
  function newlySolved(before, after, list) {
    const a = solvedNames(before, list);
    for (const p of list) {
      if (C.pieceSolved(after, p) && !a.has(C.colorSet(C.pieceColors(after, p)))) {
        return C.pieceColors(after, p);
      }
    }
    return null;
  }

  function best(cands) {
    let b = null;
    for (const c of cands) if (!b || c.len < b.len) b = c;
    return b;
  }

  // ---- Hold ---------------------------------------------------------------

  function holdStep(s) {
    for (const r of [['x2'], ['x'], ["x'"], ['z'], ["z'"]]) {
      if (C.center(am(s, r), D_N) === 'w') {
        return [{ text: 'Hold the cube with the white center on the bottom and the yellow center on top. Every step of this method uses that grip.', moves: r }];
      }
    }
    return null;
  }

  // ---- Step 1 & 2: daisy, then white cross ----------------------------------

  const FACE_MOVES = ['U', 'D', 'F', 'B', 'R', 'L'].flatMap(f => [f, f + "'", f + '2']);
  const OPP = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };

  function daisySearch(s) {
    const st = C.stats(s);
    const base = st.petals + st.cross;
    const score = t => { const x = C.stats(t); return x.petals + x.cross; };
    const path = [];
    function dfs(t, depth, last) {
      if (depth === 0) return score(t) > base;
      for (const m of FACE_MOVES) {
        const f = m[0];
        if (f === last || (OPP[f] === last && f < last)) continue;
        path.push(m);
        if (dfs(C.applyMove(t, m), depth - 1, f)) return true;
        path.pop();
      }
      return false;
    }
    for (let d = 1; d <= 6; d++) if (dfs(s, d, null)) return path.slice();
    return null;
  }

  function crossStep(s) {
    const st = C.stats(s);
    if (st.petals + st.cross < 4) {
      const moves = daisySearch(s);
      if (!moves) return null;
      const steps = [];
      let i = 0;
      while (i < moves.length - 1 && moves[i][0] === 'U') i++;
      if (i > 0) {
        steps.push({ text: 'Turn the top (U) to move your petals out of the way, so there is an empty spot next to the yellow center.', moves: moves.slice(0, i) });
      }
      steps.push({
        text: `Bring a white edge up next to the yellow center with its white sticker facing up. You have ${st.petals} of 4 petals so far.`,
        moves: moves.slice(i),
      });
      return { title: `Make the daisy (${st.petals}/4 petals)`, steps };
    }

    const cands = [];
    for (let b = 0; b < 4; b++) {
      for (const X of ['F', 'R', 'B', 'L']) {
        const moves = Upow(b).concat([X + '2']);
        const t = am(s, moves);
        const x = C.stats(t);
        if (x.cross > st.cross && x.cross + x.petals === 4) cands.push({ b, X, moves, len: moves.length });
      }
    }
    const c = best(cands);
    if (!c) return null;
    const n = C.FACE_NORMALS[c.X];
    const t1 = am(s, Upow(c.b));
    const side = C.at(t1, [n[0], 1, n[2]], n);
    const steps = [];
    steps.push(c.b
      ? { text: `Turn the top (U) until the ${cn(side)} sticker on the white-${cn(side)} petal sits right above the ${cn(side)} center.`, moves: Upow(c.b) }
      : { text: `The white-${cn(side)} petal already sits above the ${cn(side)} center.`, moves: [] });
    steps.push({ text: `Turn the ${cn(side)} face twice (${c.X}2). The edge swings down to the bottom, white side down.`, moves: [c.X + '2'] });
    return { title: `White cross (${st.cross}/4 edges)`, steps };
  }

  // ---- Step 3: white corners ------------------------------------------------

  function cornersStep(s) {
    const st = C.stats(s);
    const cands = [];
    for (let e = 0; e < 2; e++) {
      for (let a = 0; a < (e ? 4 : 1); a++) {
        const pre = e ? Ypow(a).concat(ALGS.sexy) : [];
        const s1 = am(s, pre);
        for (let c = 0; c < 4; c++) {
          for (let b = 0; b < 4; b++) {
            const setup = Ypow(c).concat(Upow(b));
            const s2 = am(s1, setup);
            let t = s2;
            for (let k = 1; k <= 5; k++) {
              t = am(t, ALGS.sexy);
              const x = C.stats(t);
              if (x.cross === 4 && x.corners > st.corners) {
                cands.push({ e, a, c, b, k, len: pre.length + setup.length + 4 * k, after: t });
                break;
              }
            }
          }
        }
      }
    }
    const c = best(cands);
    if (!c) return null;
    const piece = newlySolved(s, c.after, C.POS.dCorners);
    const name = piece ? C.pieceName(piece) : 'white';
    const sides = piece ? piece.filter(x => x !== 'w').map(cn) : null;
    const steps = [];
    if (c.e) {
      if (c.a) steps.push({ text: `Turn the whole cube so the stuck ${name} corner is at the front-right-bottom.`, moves: Ypow(c.a) });
      steps.push({ text: `That corner is in the bottom layer but in the wrong spot or twisted. Pop it up to the top layer with R U R' U'.`, moves: ALGS.sexy });
    }
    if (c.c) steps.push({ text: `Turn the whole cube (y) so the spot where the ${name} corner belongs${sides ? ` — between the ${sides[0]} and ${sides[1]} centers —` : ''} is at the front-right.`, moves: Ypow(c.c) });
    if (c.b) steps.push({ text: `Turn the top (U) to bring the ${name} corner right above that spot.`, moves: Upow(c.b) });
    steps.push({ text: `Repeat R U R' U' until the corner drops in with white on the bottom — ${c.k} time${c.k > 1 ? 's' : ''} here.`, moves: rep(ALGS.sexy, c.k) });
    return { title: `White corners (${st.corners}/4)`, steps };
  }

  // ---- Step 4: middle layer -------------------------------------------------

  function middleStep(s) {
    const st = C.stats(s);
    const cands = [];
    for (let e = 0; e < 2; e++) {
      for (let a = 0; a < (e ? 4 : 1); a++) {
        const pre = e ? Ypow(a).concat(ALGS.midRight) : [];
        const s1 = am(s, pre);
        for (let c = 0; c < 4; c++) {
          for (let b = 0; b < 4; b++) {
            const setup = Ypow(c).concat(Upow(b));
            const s2 = am(s1, setup);
            for (const side of ['right', 'left']) {
              const alg = side === 'right' ? ALGS.midRight : ALGS.midLeft;
              const t = am(s2, alg);
              const x = C.stats(t);
              if (x.cross === 4 && x.corners === 4 && x.middle > st.middle) {
                cands.push({ e, a, c, b, side, s2, len: pre.length + setup.length + alg.length, after: t });
              }
            }
          }
        }
      }
    }
    const c = best(cands);
    if (!c) return null;
    const front = C.at(c.s2, [0, 1, 1], [0, 0, 1]);
    const top = C.at(c.s2, [0, 1, 1], UP);
    const steps = [];
    if (c.e) {
      if (c.a) steps.push({ text: 'Turn the whole cube so the middle-layer edge that is in the wrong spot (or flipped) is at the front-right.', moves: Ypow(c.a) });
      steps.push({ text: "Kick it out to the top layer by doing the right-hand algorithm once: U R U' R' U' F' U F.", moves: ALGS.midRight });
    }
    if (c.c) steps.push({ text: `Turn the whole cube (y) so the ${cn(front)} center faces you.`, moves: Ypow(c.c) });
    steps.push(c.b
      ? { text: `Turn the top (U) until the ${cn(front)}-${cn(top)} edge sits above the ${cn(front)} center, its ${cn(front)} sticker matching — it looks like an upside-down T.`, moves: Upow(c.b) }
      : { text: `The ${cn(front)}-${cn(top)} edge already sits above the ${cn(front)} center, making an upside-down T.`, moves: [] });
    steps.push(c.side === 'right'
      ? { text: `Its top color (${cn(top)}) matches the center on the right, so it goes right: U R U' R' U' F' U F.`, moves: ALGS.midRight }
      : { text: `Its top color (${cn(top)}) matches the center on the left, so it goes left: U' L' U L U F U' F'.`, moves: ALGS.midLeft });
    return { title: `Middle layer (${st.middle}/4 edges)`, steps };
  }

  // ---- Step 5: yellow cross ---------------------------------------------------

  function shape(s) {
    const up = C.POS.uEdges.map(p => C.at(s, p, UP) === 'y'); // front, right, back, left
    const n = up.filter(Boolean).length;
    if (n === 4) return 'cross';
    if (n === 0) return 'dot';
    if (n === 2) return (up[0] && up[2]) || (up[1] && up[3]) ? 'line' : 'L';
    return 'odd';
  }

  function ycrossStep(s) {
    let found = null;
    const search = (t, n, chunks) => {
      if (C.stats(t).yellowEdgesUp === 4) { found = chunks; return true; }
      if (n === 0) return false;
      for (let b = 0; b < 4; b++) {
        const moves = Upow(b).concat(ALGS.yCross);
        if (search(am(t, moves), n - 1, chunks.concat([b]))) return true;
      }
      return false;
    };
    for (let n = 1; n <= 3 && !found; n++) search(s, n, []);
    if (!found) return null;
    const b = found[0];
    const sh = shape(s);
    const steps = [];
    if (sh === 'dot') steps.push({ text: 'You have a dot: only the center is yellow. Do the algorithm once from any side and you will get an L or a line.', moves: Upow(b) });
    else if (sh === 'L') steps.push({ text: 'You have an L shape. Turn the top (U) so the L points to the back and the left — like clock hands at 9:00.', moves: Upow(b) });
    else if (sh === 'line') steps.push({ text: 'You have a line. Turn the top (U) so the line runs left-to-right.', moves: Upow(b) });
    else steps.push({ text: 'Turn the top (U) into position.', moves: Upow(b) });
    steps.push({ text: "Do F R U R' U' F'.", moves: ALGS.yCross });
    return { title: `Yellow cross (you have a ${sh === 'L' ? 'L shape' : sh})`, steps };
  }

  // ---- Step 6: yellow edges ---------------------------------------------------

  function yedgesStep(s) {
    const cands = [];
    for (let b = 0; b < 4; b++) {
      const s1 = am(s, Upow(b));
      if (C.stats(s1).uEdges === 4) cands.push({ b, len: Upow(b).length, chunk: Upow(b) });
      for (let a = 0; a < 4; a++) {
        const first = Upow(b).concat(Ypow(a), ALGS.yEdges);
        const s2 = am(s, first);
        for (let d = 0; d < 4; d++) {
          if (C.stats(am(s2, Upow(d))).uEdges === 4) cands.push({ b, a, len: first.length + d, chunk: first });
          for (let c = 0; c < 4; c++) {
            const s3 = am(s2, Ypow(c).concat(ALGS.yEdges));
            if (C.stats(am(s3, Upow(d))).uEdges === 4) cands.push({ b, a, len: first.length + 8 + c + d + 1, chunk: first });
          }
        }
      }
    }
    const c = best(cands);
    if (!c) return null;
    const s1 = am(s, Upow(c.b));
    const matched = C.stats(s1).uEdges;
    const steps = [];
    if (c.a === undefined) {
      steps.push({ text: 'All four yellow edges are already in the right order — just turn the top (U) to line them up with their centers.', moves: Upow(c.b) });
      return { title: 'Yellow edges', steps };
    }
    steps.push({ text: `Turn the top (U) until two yellow edges match the centers below them${matched === 2 ? '' : ' (or as many as you can)'}.`, moves: Upow(c.b) });
    const backRight = C.pieceSolved(s1, [0, 1, -1]) && C.pieceSolved(s1, [1, 1, 0]);
    if (matched === 2 && !backRight && c.a !== undefined) {
      const opposite = C.pieceSolved(s1, [0, 1, 1]) === C.pieceSolved(s1, [0, 1, -1]);
      if (opposite) steps.push({ text: 'The two matching edges are opposite each other. Do the algorithm once from any side — then two neighbors will match.', moves: Ypow(c.a) });
      else steps.push({ text: 'Turn the whole cube (y) so the two matching edges are at the back and on the right.', moves: Ypow(c.a) });
    } else if (c.a) {
      steps.push({ text: 'Turn the whole cube (y) so the matching edges are at the back and on the right.', moves: Ypow(c.a) });
    }
    steps.push({ text: "Do R U R' U R U2 R' U. It swaps the front and left edges.", moves: ALGS.yEdges });
    return { title: `Yellow edges (${matched}/4 match)`, steps };
  }

  // ---- Step 7: position yellow corners ----------------------------------------

  function ycornersStep(s) {
    let found = null;
    const search = (t, n, chunks) => {
      if (C.stats(t).uCornersPlaced === 4) { found = chunks; return true; }
      if (n === 0) return false;
      for (let a = 0; a < 4; a++) {
        if (search(am(t, Ypow(a).concat(ALGS.yCorners)), n - 1, chunks.concat([a]))) return true;
      }
      return false;
    };
    for (let n = 1; n <= 3 && !found; n++) search(s, n, []);
    if (!found) return null;
    const a = found[0];
    const st = C.stats(s);
    const t = am(s, Ypow(a));
    const steps = [];
    if (st.uCornersPlaced >= 1) {
      const p = [1, 1, 1];
      const name = C.pieceName(C.pieceColors(t, p));
      steps.push({ text: `The ${name} corner is already in its right spot (its colors match the three centers around it, even if it is twisted). Turn the whole cube so it is at the front-right-top.`, moves: Ypow(a) });
    } else {
      steps.push({ text: 'No corner is in its right spot yet. Do the algorithm from any side and one will be.', moves: Ypow(a) });
    }
    steps.push({ text: "Do U R U' L' U R' U' L. It cycles the other three corners; repeat if they are not home yet.", moves: ALGS.yCorners });
    return { title: `Position yellow corners (${st.uCornersPlaced}/4 placed)`, steps };
  }

  // ---- Step 8: twist yellow corners ------------------------------------------

  const ufrYellowUp = t => C.at(t, [1, 1, 1], UP) === 'y';

  function solveOrient(s, allowY) {
    const tries = [];
    for (let a = 0; a < (allowY ? 4 : 1); a++) {
      const t0 = am(s, Ypow(a));
      const chunks = [];
      const dfs = (t, depth) => {
        if (C.stats(t).yellowCornersUp === 4) {
          for (let c = 0; c < 4; c++) {
            if (C.isSolved(am(t, Upow(c)))) { chunks.push({ finish: c }); return true; }
          }
          return false;
        }
        if (depth >= 5) return false;
        for (let b = 0; b < 4; b++) {
          const t1 = am(t, Upow(b));
          if (ufrYellowUp(t1)) continue;
          let t2 = t1;
          for (let k = 1; k <= 5; k++) {
            t2 = am(t2, ALGS.twist);
            if (!ufrYellowUp(t2)) continue;
            chunks.push({ b, k });
            if (dfs(t2, depth + 1)) return true;
            chunks.pop();
          }
        }
        return false;
      };
      if (dfs(t0, 0)) tries.push({ a, chunks });
      if (tries.length && a === 0) break;
    }
    return tries[0] || null;
  }

  function yorientStep(s) {
    const allowY = f2lDone(C.stats(s));
    const sol = solveOrient(s, allowY);
    if (!sol) return null;
    const steps = [];
    const first = sol.chunks[0];
    if (first.finish !== undefined) {
      steps.push({ text: 'Every corner has yellow on top. Turn the top (U) to line up the last layer — and the cube is solved!', moves: Upow(first.finish) });
      return { title: 'Finish!', steps };
    }
    if (sol.a) steps.push({ text: "Turn the whole cube so a corner that doesn't have yellow on top is at the front-right-top. From now on, don't rotate the whole cube!", moves: Ypow(sol.a) });
    else if (allowY) steps.push({ text: "The front-right-top corner doesn't have yellow on top yet. Keep holding the cube this way — from now on, don't rotate the whole cube!", moves: [] });
    if (first.b) steps.push({ text: 'Turn only the top (U) to bring the next corner without yellow on top to the front-right-top.', moves: Upow(first.b) });
    steps.push({ text: `Repeat R' D' R D until yellow faces up on that corner — ${first.k} time${first.k > 1 ? 's' : ''} here. The bottom will look scrambled: that's normal, it fixes itself once every corner is done.`, moves: rep(ALGS.twist, first.k) });
    const left = C.stats(s).yellowCornersUp;
    return { title: `Twist yellow corners (${left}/4 yellow up)`, steps };
  }

  // ---- Public ---------------------------------------------------------------

  const HANDLERS = {
    hold: s => { const st = holdStep(s); return st && { title: 'Hold the cube', steps: st }; },
    cross: crossStep, corners: cornersStep, middle: middleStep,
    ycross: ycrossStep, yedges: yedgesStep, ycorners: ycornersStep, yorient: yorientStep,
  };

  function next(s) {
    const stage = stageOf(s);
    if (stage === 'done') return { stage, title: 'Solved!', steps: [] };
    const h = HANDLERS[stage](s);
    if (!h) return { stage, title: "I'm stuck", steps: [], stuck: true };
    h.steps = h.steps.filter(st => st.moves.length || st.text);
    return Object.assign({ stage }, h);
  }

  const movesOf = hint => [].concat(...hint.steps.map(st => st.moves));

  // Play the coach on a copy until `until(state, stage)` is true. Used to
  // build realistic practice positions for each lesson.
  function advance(s, until, maxSteps = 80) {
    for (let i = 0; i < maxSteps; i++) {
      const stage = stageOf(s);
      if (until(s, stage)) return s;
      if (stage === 'done') return null;
      const h = next(s);
      if (h.stuck) return null;
      s = am(s, movesOf(h));
    }
    return null;
  }

  global.Coach = { ALGS, STAGES, stageOf, next, movesOf, advance, shape };
})(typeof globalThis !== 'undefined' ? globalThis : window);
