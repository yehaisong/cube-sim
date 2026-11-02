// A general step solver shared by the advanced methods (CFOP, Roux, ZZ,
// Petrus, Corners-first, Blindfolded). A method is a list of stages; each
// stage says what "done" means and how to search for the next chunk:
//
//   pieces    – put named pieces home, one unit (e.g. an F2L pair) at a time,
//               with IDA* over tracked pieces and small pattern databases.
//   algs      – recognise a last-layer case: U-turns + known algorithms.
//   predicate – short brute-force search for a goal (Roux last six edges).
//   bld       – Old Pochmann: setup moves + swap algorithm + undo setup.
//
// Everything works in a fixed frame: yellow U, green F, orange R, white D.
(function (global) {
  'use strict';
  const C = global.Cube;

  // ---- Pieces by name ("DFR", "UF", "U") -----------------------------------

  const NAME_CACHE = new Map();
  function piece(name) {
    let p = NAME_CACHE.get(name);
    if (p) return p;
    const pos = [0, 0, 0];
    for (const ch of name) {
      const n = C.FACE_NORMALS[ch];
      for (let i = 0; i < 3; i++) if (n[i]) pos[i] = n[i];
    }
    const homes = C.stickerNormals(pos).map(n => C.INDEX.get(C.key(pos, n)));
    const colors = homes.map(i => C.SCHEME[C.FACELETS[i].face]);
    p = { name, pos, homes, colors, ref: homes[0], refColor: colors[0], set: C.colorSet(colors) };
    NAME_CACHE.set(name, p);
    return p;
  }

  const isHome = (s, name) => { const p = piece(name); return p.homes.every((i, k) => s[i] === p.colors[k]); };
  const allHome = (s, names) => names.every(n => isHome(s, n));

  const CENTER_POS = Object.values(C.FACE_NORMALS);
  // Where is this piece's reference sticker right now? (a facelet index)
  function track(s, name) {
    const p = piece(name);
    const list = p.homes.length === 1 ? CENTER_POS : p.homes.length === 2 ? C.ALL_EDGES : C.ALL_CORNERS;
    const pos = C.locate(s, p.colors, list);
    for (const n of C.stickerNormals(pos)) {
      const i = C.INDEX.get(C.key(pos, n));
      if (s[i] === p.refColor) return i;
    }
    return -1;
  }

  // ---- Moves ---------------------------------------------------------------

  const PERM_CACHE = new Map();
  function perm(tok) {
    let p = PERM_CACHE.get(tok);
    if (!p) {
      p = new Int16Array(54);
      const s = C.applyMove([...Array(54).keys()], tok); // s[j] = facelet that moved to j
      for (let j = 0; j < 54; j++) p[s[j]] = j;
      PERM_CACHE.set(tok, p);
    }
    return p;
  }

  const expand = faces => faces.flatMap(f => [f, f + "'", f + '2']);
  const MOVES = {
    all: expand(['U', 'D', 'R', 'L', 'F', 'B']),
    noD: expand(['U', 'R', 'L', 'F', 'B']),
    URF: expand(['U', 'R', 'F']),
    RU: expand(['R', 'U']),
    LUR: expand(['L', 'U', 'R']),
    RUMr: expand(['R', 'U', 'M', 'r']),
    MU: expand(['M', 'U']),
    ZZ: expand(['U', 'D', 'L', 'R']).concat(['F2', 'B2']),
    sliceAll: expand(['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S']),
  };
  const AXIS = { R: 0, L: 0, M: 0, r: 0, l: 0, x: 0, U: 1, D: 1, E: 1, u: 1, d: 1, y: 1, F: 2, B: 2, S: 2, f: 2, b: 2, z: 2 };
  const RANK = { L: 0, l: 1, M: 2, r: 3, R: 4, x: 5, D: 0, d: 1, E: 2, u: 3, U: 4, y: 5, B: 0, b: 1, S: 2, f: 3, F: 4, z: 5 };

  // Moves on the same axis commute, so only allow them in one order.
  const allowed = (tok, last) => !last || AXIS[tok[0]] !== AXIS[last[0]] || RANK[tok[0]] > RANK[last[0]];

  // ---- Pattern databases over up to 3 tracked pieces --------------------------

  const TABLES = new Map();
  function table(names, moves) {
    const key = moves.join(' ') + '|' + names.join(',');
    let t = TABLES.get(key);
    if (t) return t;
    const k = names.length;
    const size = 54 ** k;
    const dist = new Uint8Array(size).fill(255);
    const perms = moves.map(perm);
    const enc = a => a.reduce((acc, v) => acc * 54 + v, 0);
    const start = names.map(n => piece(n).ref);
    const queue = [start];
    dist[enc(start)] = 0;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      const d = dist[enc(cur)];
      for (const p of perms) {
        const nx = cur.map(i => p[i]);
        const e = enc(nx);
        if (dist[e] === 255) { dist[e] = d + 1; queue.push(nx); }
      }
    }
    t = { dist, k };
    TABLES.set(key, t);
    return t;
  }

  // Pack units into heuristic groups of at most 3 pieces, never splitting a unit of <= 3.
  function groups(units) {
    const out = [];
    let cur = [];
    for (const u of units) {
      if (u.length > 3) {
        for (let i = 0; i < u.length; i += 3) out.push(u.slice(i, i + 3));
        continue;
      }
      if (cur.length + u.length > 3) { out.push(cur); cur = []; }
      cur = cur.concat(u);
    }
    if (cur.length) out.push(cur);
    return out;
  }

  // ---- Edge orientation (F/B axis, as used by ZZ and Petrus) -----------------

  // Each edge slot has a "primary" facelet: its U/D sticker, or F/B for middle-layer slots.
  const EDGE_SLOTS = C.ALL_EDGES.map(pos => {
    const ax = pos[1] ? 1 : 2;
    const n = [0, 0, 0]; n[ax] = pos[ax];
    const other = C.stickerNormals(pos).find(m => m[ax] === 0);
    return { pos, primary: C.INDEX.get(C.key(pos, n)), secondary: C.INDEX.get(C.key(pos, other)) };
  });
  const SLOT_OF_FACELET = new Map();
  EDGE_SLOTS.forEach((sl, i) => { SLOT_OF_FACELET.set(sl.primary, [i, 0]); SLOT_OF_FACELET.set(sl.secondary, [i, 1]); });
  const PRIMARY_COLORS = new Set(['y', 'w']);
  const SECOND_COLORS = new Set(['g', 'b']);

  function eoOf(s) {
    let bits = 0;
    EDGE_SLOTS.forEach((sl, i) => {
      const a = s[sl.primary], b = s[sl.secondary];
      const prim = PRIMARY_COLORS.has(a) || PRIMARY_COLORS.has(b) ? PRIMARY_COLORS : SECOND_COLORS;
      if (!prim.has(a)) bits |= 1 << i;
    });
    return bits;
  }

  const EO_MOVE = new Map();
  function eoMove(tok) {
    let m = EO_MOVE.get(tok);
    if (m) return m;
    const p = perm(tok);
    m = EDGE_SLOTS.map(sl => {
      const [to, side] = SLOT_OF_FACELET.get(p[sl.primary]);
      return { to, flip: side };
    });
    EO_MOVE.set(tok, m);
    return m;
  }
  function applyEO(bits, tok) {
    const m = eoMove(tok);
    let out = 0;
    for (let i = 0; i < 12; i++) if (((bits >> i) & 1) ^ m[i].flip) out |= 1 << m[i].to;
    return out;
  }
  let EO_DIST = null;
  function eoDist(bits) {
    if (!EO_DIST) {
      EO_DIST = new Uint8Array(4096).fill(255);
      EO_DIST[0] = 0;
      const q = [0];
      for (let i = 0; i < q.length; i++) {
        for (const t of MOVES.all) {
          const nx = applyEO(q[i], t);
          if (EO_DIST[nx] === 255) { EO_DIST[nx] = EO_DIST[q[i]] + 1; q.push(nx); }
        }
      }
    }
    return EO_DIST[bits];
  }

  // ---- IDA* over tracked pieces (+ optional edge orientation) ----------------

  // keepUnits: units that must end home; targetUnits: candidate units, the
  // first one that can be finished within the depth bound wins.
  function piecesSearch(s, { keepUnits, targetUnits, moves, needEO = false, maxDepth = 14, nodeLimit = 3e6 }) {
    const perms = moves.map(perm);
    let nodes = 0;
    const cands = targetUnits.map(unit => {
      const names = keepUnits.flat().concat(unit);
      const gs = groups(keepUnits.concat([unit]));
      const idxOf = new Map(names.map((n, i) => [n, i]));
      return {
        unit, names,
        homes: names.map(n => piece(n).ref),
        start: names.map(n => track(s, n)),
        tabs: gs.map(g => ({ t: table(g, moves), at: g.map(n => idxOf.get(n)) })),
      };
    });
    const eo0 = needEO ? eoOf(s) : 0;

    const h = (c, cur, eo) => {
      let best = needEO ? eoDist(eo) : 0;
      for (const { t, at } of c.tabs) {
        let e = 0;
        for (const i of at) e = e * 54 + cur[i];
        const d = t.dist[e];
        if (d > best) best = d;
      }
      return best;
    };

    for (let bound = 0; bound <= maxDepth; bound++) {
      for (const c of cands) {
        const path = [];
        const dfs = (cur, eo, g, last) => {
          const hv = h(c, cur, eo);
          if (hv === 0) return true;
          if (g + hv > bound) return false;
          if (++nodes > nodeLimit) throw new Error('limit');
          for (let m = 0; m < moves.length; m++) {
            const tok = moves[m];
            if (!allowed(tok, last)) continue;
            const p = perms[m];
            const nx = cur.map(i => p[i]);
            path.push(tok);
            if (dfs(nx, needEO ? applyEO(eo, tok) : 0, g + 1, tok)) return true;
            path.pop();
          }
          return false;
        };
        try {
          if (dfs(c.start, eo0, 0, null)) return { unit: c.unit, moves: path };
        } catch (e) {
          if (e.message === 'limit') return null;
          throw e;
        }
      }
    }
    return null;
  }

  // Short full-state search for a goal predicate.
  function predicateSearch(s, goal, moves, maxDepth) {
    const path = [];
    const dfs = (t, depth, last) => {
      if (depth === 0) return goal(t);
      for (const tok of moves) {
        if (!allowed(tok, last)) continue;
        path.push(tok);
        if (dfs(C.applyMove(t, tok), depth - 1, tok)) return true;
        path.pop();
      }
      return false;
    };
    for (let d = 0; d <= maxDepth; d++) if (dfs(s, d, null)) return path.slice();
    return null;
  }

  // ---- Stage solvers ---------------------------------------------------------

  const AUF = [[], ['U'], ['U2'], ["U'"]];
  const unitsDone = (s, units) => units.every(u => allHome(s, u));

  function stageDone(stage, s) {
    if (stage.goal) return stage.goal(s);
    return unitsDone(s, stage.units) && (!stage.eo || eoOf(s) === 0);
  }

  // Setup + algorithm + undo setup, for cases a short search can't reach (e.g. two flipped edges).
  function solveConjugate(stage, s, keep) {
    const alg = C.parseAlg(stage.fallback.alg.moves);
    const moves = MOVES[stage.fallback.setupMoves];
    const before = stage.units.filter(u => allHome(s, u)).length;
    const setups = [[]].concat(moves.map(m => [m]), moves.flatMap(a => moves.filter(b => allowed(b, a)).map(b => [a, b])));
    for (const S of setups) {
      const t = C.applyMoves(s, S.concat(alg, C.invertAlg(S)));
      if (allHome(t, keep) && stage.units.filter(u => allHome(t, u)).length > before) {
        return { moves: S.concat(alg, C.invertAlg(S)), text: `Use ${stage.fallback.alg.name}${S.length ? ' with setup moves before and after' : ''}.` };
      }
    }
    return null;
  }

  function solvePieces(method, stage, s) {
    const keepUnits = method.keepBefore(stage).concat(stage.keepExtra || []).filter(u => allHome(s, u));
    const done = stage.units.filter(u => allHome(s, u));
    const todo = stage.units.filter(u => u.length && !allHome(s, u));
    if (!todo.length) todo.push([]); // only edge orientation is left to fix
    const opts = { keepUnits: keepUnits.concat(done), moves: MOVES[stage.moves], needEO: !!stage.eo, maxDepth: stage.maxDepth || 14 };
    let res = null;
    if (stage.joint && todo.length > 1 && todo.flat().length <= (stage.jointMax || 99)) {
      res = piecesSearch(s, Object.assign({}, opts, { targetUnits: [todo.flat()], nodeLimit: 4e5 }));
    }
    if (!res) {
      const ordered = stage.ordered ? [todo[0]] : todo;
      res = piecesSearch(s, Object.assign({}, opts, { targetUnits: ordered, nodeLimit: stage.fallback ? 1.5e6 : 3e6 }));
    }
    if (!res && stage.fallback) return solveConjugate(stage, s, opts.keepUnits.flat());
    if (!res) return null;
    return { moves: res.moves, text: stage.explain(res.unit, s, res.moves) };
  }

  function solveAlgs(method, stage, s) {
    const keep = method.keepBefore(stage).flat();
    const ok = t => stage.goal(t) && allHome(t, keep);
    let best = null;
    const consider = (chunks, t) => {
      const len = chunks.reduce((n, c) => n + c.moves.length, 0);
      if (!best || len < best.len) best = { chunks, len };
    };
    const rec = (t, chunks, left) => {
      for (let a = 0; a < 4; a++) {
        const ta = C.applyMoves(t, AUF[a]);
        if (ok(ta)) consider(chunks.concat(a ? [{ auf: AUF[a] }] : []).map(fill), ta);
        if (left === 0) continue;
        for (const alg of stage.algs) {
          const mv = C.parseAlg(alg.moves);
          rec(C.applyMoves(ta, mv), chunks.concat([{ auf: AUF[a], alg }]), left - 1);
        }
      }
    };
    const fill = c => Object.assign({}, c, { moves: (c.auf || []).concat(c.alg ? C.parseAlg(c.alg.moves) : []) });
    for (let n = 0; n <= (stage.maxAlgs || 2) && !best; n++) rec(s, [], n);
    if (!best) return null;
    const first = best.chunks[0];
    if (!first) return null;
    const steps = [];
    if (first.auf && first.auf.length) {
      steps.push({ text: first.alg ? `Turn the top (U) so the case lines up for ${first.alg.name}.` : 'Turn the top (U) to line everything up.', moves: first.auf });
    }
    if (first.alg) {
      steps.push({ text: `${stage.recognize ? stage.recognize(first.alg) : ''}Do ${first.alg.name}: ${first.alg.moves}.`, moves: C.parseAlg(first.alg.moves) });
    }
    const more = best.chunks.length - 1;
    return { steps, title: stage.title + (more > 0 ? ` (${more} more after this)` : '') };
  }

  function solvePredicate(method, stage, s) {
    const keep = method.keepBefore(stage).flat();
    const moves = predicateSearch(s, t => stage.goal(t) && allHome(t, keep), MOVES[stage.moves], stage.maxDepth || 10);
    if (!moves) return null;
    return { moves, text: stage.explain(s, moves) };
  }

  // ---- Corners-first edges: setup + commutator + undo --------------------------

  const CENTERS = ['U', 'F', 'R', 'D', 'L', 'B'];
  const SLICES = expand(['M', 'E', 'S']);
  const COMMUTATORS = MOVES.all.flatMap(x => SLICES.flatMap(y => [
    [x, y, C.invertMove(x), C.invertMove(y)],
    [y, x, C.invertMove(y), C.invertMove(x)],
  ]));

  function solveCommutator(stage, s) {
    if (!allHome(s, CENTERS)) {
      const mv = predicateSearch(s, t => allHome(t, CENTERS), SLICES, 4);
      return mv && { title: stage.title, steps: [{ text: 'First line the centers back up with slice turns.', moves: mv }] };
    }
    const keep = stage.keep.concat(CENTERS, stage.pieces.filter(e => isHome(s, e)));
    // An edge home scores 2; in its slot but flipped scores 1 (the flip algorithm finishes those).
    const score = t => stage.pieces.reduce((n, e) => {
      const p = piece(e);
      return n + (isHome(t, e) ? 2 : C.colorSet(p.homes.map(i => t[i])) === p.set ? 1 : 0);
    }, 0);
    const before = score(s);
    const algs = COMMUTATORS.map(k => ({ k, comm: true })).concat([{ k: C.parseAlg(stage.flip.moves), comm: false }]);
    const all = MOVES.sliceAll;
    const extend = list => list.flatMap(S => all.filter(b => allowed(b, S[S.length - 1])).map(b => S.concat(b)));
    let setups = [[]];
    // Depth 3 only for the flip algorithm: two flipped edges can sit far from UF/UB.
    for (let depth = 0; depth <= 3; depth++) {
      if (depth > 0) setups = extend(setups);
      let best = null;
      for (const S of setups) {
        const s1 = C.applyMoves(s, S);
        for (const { k, comm } of algs) {
          if (depth === 3 && comm) continue;
          const t = C.applyMoves(C.applyMoves(s1, k), C.invertAlg(S));
          if (!allHome(t, keep)) continue;
          const gain = score(t) - before;
          if (gain <= 0) continue;
          const len = 2 * S.length + k.length - gain; // prefer short, prefer solving more
          if (!best || len < best.len) best = { S, k, comm, len, gain };
        }
      }
      if (best) {
        const steps = [];
        if (best.S.length) steps.push({ text: 'Setup: move the edges into the spots the commutator works on.', moves: best.S });
        steps.push(best.comm
          ? { text: `Commutator ${best.k.join(' ')}: a face turn, a slice turn, then undo both. It cycles three edges and leaves every corner alone.`, moves: best.k }
          : { text: `Two edges are flipped: use ${stage.flip.name}.`, moves: best.k });
        if (best.S.length) steps.push({ text: 'Undo the setup.', moves: C.invertAlg(best.S) });
        return { title: stage.title, steps };
      }
    }
    // Rare twisty 3-cycles: search the last few edges directly.
    const open = stage.pieces.filter(e => !isHome(s, e));
    if (open.length <= 4) {
      const kept = stage.pieces.filter(e => isHome(s, e));
      const res = piecesSearch(s, {
        keepUnits: groups(stage.keep.map(k => [k])).concat(groups(kept.map(k => [k])), [CENTERS.slice(0, 3), CENTERS.slice(3)]),
        targetUnits: [open], moves: MOVES.sliceAll, maxDepth: 14, nodeLimit: 4e6,
      });
      if (res) return { title: stage.title, steps: [{ text: `Finish the last ${open.length} edges together: they need a slightly longer sequence that still brings every corner back.`, moves: res.moves }] };
    }
    return null;
  }

  // ---- Blindfolded (Old Pochmann) --------------------------------------------

  const BLD = {
    edge: {
      buffer: 'UR', swap: "R U R' U' R' F R2 U' R' U' R U R' F'", swapName: 'T-perm',
      setupMoves: expand(['L', 'D', 'M', 'E']),
      list: ['UF', 'UB', 'UL', 'DF', 'DB', 'DL', 'DR', 'FR', 'FL', 'BR', 'BL'],
    },
    corner: {
      buffer: 'UBL', swap: "R U' R' U' R U R' F' R U R' U' R' F R", swapName: 'Y-swap',
      setupMoves: expand(['R', 'D', 'F']),
      list: ['UFR', 'UFL', 'UBR', 'DFR', 'DFL', 'DBR', 'DBL'],
    },
  };
  // Where the swap algorithm sends the buffer's reference sticker = the spot to set targets up to.
  for (const k of Object.keys(BLD)) {
    const b = BLD[k];
    const p = perm;
    let i = piece(b.buffer).ref;
    for (const t of C.parseAlg(b.swap)) i = p(t)[i];
    b.swapSpot = i;
    // Shortest setup for every target facelet (BFS backwards from the swap spot).
    const setups = new Map([[i, []]]);
    const q = [i];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      for (const t of b.setupMoves) {
        // moving facelet x by t lands on cur  =>  setup for x is t + setup(cur)
        const inv = perm(C.invertMove(t));
        const x = inv[cur];
        if (!setups.has(x)) { setups.set(x, [t].concat(setups.get(cur))); q.push(x); }
      }
    }
    b.setups = setups;
  }

  const stickerName = idx => {
    const f = C.FACELETS[idx];
    return `${C.COLOR_NAMES[C.SCHEME[f.face]]} sticker of the ${pieceAt(idx)}`;
  };
  function pieceAt(idx) {
    const pos = C.FACELETS[idx].pos;
    const names = C.stickerNormals(pos).map(n => Object.keys(C.FACE_NORMALS).find(k => C.FACE_NORMALS[k].join() === n.join()));
    return names.join('') + (names.length === 2 ? ' edge' : ' corner');
  }

  function solveBld(stage, s) {
    const b = BLD[stage.bld];
    const bp = piece(b.buffer);
    const solvedAll = b.list.concat(b.buffer).every(n => isHome(s, n));
    if (solvedAll) return null;
    // Which sticker sits in the buffer's reference spot, and where does it belong?
    const col = bp.homes.map(i => s[i]);
    const set = C.colorSet(col);
    let target = null, why = '';
    if (set !== bp.set) {
      const owner = b.list.map(piece).find(p => p.set === set);
      const k = owner.colors.indexOf(col[0]);
      target = owner.homes[k];
      why = `The buffer (${b.buffer}) holds the ${C.pieceName(owner.colors)} piece. Its ${C.COLOR_NAMES[col[0]]} sticker belongs at the ${stickerName(target)} — that is your target.`;
    } else {
      // Buffer piece is home (maybe flipped/twisted): break into a new cycle.
      const open = b.list.map(piece).find(p => !p.homes.every((i, k) => s[i] === p.colors[k]));
      if (!open) {
        return null;
      }
      target = open.homes[0];
      why = `The buffer holds its own piece, so start a new cycle: shoot to any unsolved piece — here the ${stickerName(target)}.`;
    }
    const setup = b.setups.get(target) || [];
    const steps = [{ text: why, moves: [] }];
    if (setup.length) steps.push({ text: `Setup: bring the target to the swap spot without touching the buffer.`, moves: setup });
    steps.push({ text: `Swap it with the buffer: ${b.swapName}.`, moves: C.parseAlg(b.swap) });
    if (setup.length) steps.push({ text: 'Undo the setup moves.', moves: C.invertAlg(setup) });
    return { title: stage.title, steps };
  }

  // ---- Whole-cube rotations ----------------------------------------------------

  const ROTATIONS = (() => {
    const out = [];
    const seen = new Set();
    const q = [[]];
    const keyOf = toks => CENTER_POS.map(n => C.center(C.applyMoves(C.solvedState(), toks), n)).join('');
    for (let i = 0; i < q.length; i++) {
      const k = keyOf(q[i]);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(q[i]);
      for (const t of ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'"]) q.push(q[i].concat(t));
    }
    return out.map(toks => toks.length > 1 && toks[0][0] === toks[1][0] ? toks : toks);
  })();

  function frameOk(method, s) {
    const faces = method.frame === 'lr' ? ['R', 'L'] : ['U', 'F', 'R'];
    return faces.every(f => C.center(s, C.FACE_NORMALS[f]) === C.SCHEME[f]);
  }

  function holdStep(method, s) {
    let best = null;
    for (const r of ROTATIONS) {
      const t = C.applyMoves(s, r);
      if (!frameOk(method, t)) continue;
      const score = method.stages[0].units ? method.stages[0].units.flat().filter(n => isHome(t, n)).length : 0;
      if (!best || score > best.score || (score === best.score && r.length < best.r.length)) best = { r, score };
    }
    const where = method.frame === 'lr' ? 'orange center on the right and the red center on the left' : 'yellow center on top and the green center facing you';
    return { title: 'Hold the cube', steps: [{ text: `Hold the cube with the ${where}. The coach uses that grip for every step.`, moves: best ? best.r : [] }] };
  }

  // ---- Public: build a method ------------------------------------------------------

  function makeMethod(def) {
    const m = Object.assign({ frame: 'all' }, def);
    m.stageIds = m.stages.map(st => st.id);
    m.keepBefore = stage => {
      const out = [];
      for (const st of m.stages) {
        if (st === stage) break;
        if (st.units) out.push(...st.units);
      }
      return out;
    };
    m.stageOf = s => {
      if (C.isSolved(s)) return 'done';
      if (!frameOk(m, s)) return 'hold';
      for (const st of m.stages) if (!stageDone(st, s)) return st.id;
      return 'done';
    };
    m.next = s => {
      const id = m.stageOf(s);
      if (id === 'done') return { stage: id, title: 'Solved!', steps: [] };
      if (id === 'hold') return Object.assign({ stage: id }, holdStep(m, s));
      const stage = m.stages.find(st => st.id === id);
      let r = null;
      if (stage.kind === 'algs') r = solveAlgs(m, stage, s);
      else if (stage.kind === 'bld') r = solveBld(stage, s);
      else if (stage.kind === 'commutator') r = solveCommutator(stage, s);
      else {
        const one = stage.kind === 'predicate' ? solvePredicate(m, stage, s) : solvePieces(m, stage, s);
        if (one) r = { title: stage.title, steps: [{ text: one.text, moves: one.moves }] };
      }
      if (!r) return { stage: id, title: "I'm stuck", steps: [], stuck: true };
      return Object.assign({ stage: id }, r);
    };
    // A practice position for a stage: scramble with moves that keep earlier stages solved.
    m.example = id => {
      const stage = m.stages.find(st => st.id === id);
      const macros = (stage.example || m.defaultExample).map(a => C.parseAlg(a));
      for (let tries = 0; tries < 60; tries++) {
        let s = C.solvedState();
        const len = stage.exampleLength || 25;
        for (let i = 0; i < len; i++) s = C.applyMoves(s, macros[Math.floor(Math.random() * macros.length)]);
        if (m.stageOf(s) === id) return s;
      }
      return null;
    };
    return m;
  }

  const name = n => C.pieceName(piece(n).colors);

  global.Engine = { piece, isHome, allHome, track, MOVES, makeMethod, eoOf, name, BLD };
})(typeof globalThis !== 'undefined' ? globalThis : window);
