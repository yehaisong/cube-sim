// Cube model: 54 facelets addressed by (position, normal) in a right-handed
// frame where +x = Right, +y = Up, +z = Front. A state is an array of 54
// color letters; a move is a precomputed permutation of facelet indices.
(function (global) {
  'use strict';

  const FACE_NORMALS = {
    U: [0, 1, 0], D: [0, -1, 0],
    R: [1, 0, 0], L: [-1, 0, 0],
    F: [0, 0, 1], B: [0, 0, -1],
  };

  // Held the way the beginner method wants it: yellow up, white down, green front.
  const SCHEME = { U: 'y', D: 'w', F: 'g', B: 'b', R: 'o', L: 'r' };

  const COLOR_NAMES = { w: 'white', y: 'yellow', g: 'green', b: 'blue', o: 'orange', r: 'red' };

  const key = (p, n) => p.join(',') + '|' + n.join(',');

  const FACELETS = [];
  const INDEX = new Map();
  for (const face of ['U', 'D', 'F', 'B', 'R', 'L']) {
    const n = FACE_NORMALS[face];
    const ax = n.findIndex(v => v !== 0);
    const others = [0, 1, 2].filter(i => i !== ax);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const p = [0, 0, 0];
        p[ax] = n[ax];
        p[others[0]] = a;
        p[others[1]] = b;
        INDEX.set(key(p, n), FACELETS.length);
        FACELETS.push({ pos: p, normal: n, face });
      }
    }
  }

  // Rotate an integer vector by q quarter turns (counter-clockwise, right-hand rule).
  function rot(v, axis, q) {
    q = ((q % 4) + 4) % 4;
    let [x, y, z] = v;
    for (let i = 0; i < q; i++) {
      if (axis === 0) [y, z] = [-z, y];
      else if (axis === 1) [x, z] = [z, -x];
      else [x, y] = [-y, x];
    }
    return [x, y, z];
  }

  const ALL = [-1, 0, 1];
  const MOVE_DEFS = {
    R: { axis: 0, layers: [1], q: -1 }, L: { axis: 0, layers: [-1], q: 1 },
    M: { axis: 0, layers: [0], q: 1 }, x: { axis: 0, layers: ALL, q: -1 },
    U: { axis: 1, layers: [1], q: -1 }, D: { axis: 1, layers: [-1], q: 1 },
    E: { axis: 1, layers: [0], q: 1 }, y: { axis: 1, layers: ALL, q: -1 },
    F: { axis: 2, layers: [1], q: -1 }, B: { axis: 2, layers: [-1], q: 1 },
    S: { axis: 2, layers: [0], q: -1 }, z: { axis: 2, layers: ALL, q: -1 },
    // Wide moves: the face plus the middle slice next to it.
    r: { axis: 0, layers: [0, 1], q: -1 }, l: { axis: 0, layers: [-1, 0], q: 1 },
    u: { axis: 1, layers: [0, 1], q: -1 }, d: { axis: 1, layers: [-1, 0], q: 1 },
    f: { axis: 2, layers: [0, 1], q: -1 }, b: { axis: 2, layers: [-1, 0], q: 1 },
  };

  function parseMove(tok) {
    const m = /^([RLUDFBMESxyzrludfb])(2'?|')?$/.exec(tok);
    if (!m) throw new Error('Unknown move: ' + tok);
    const def = MOVE_DEFS[m[1]];
    let q = def.q;
    if (m[2] === "'") q = -q;
    else if (m[2]) q *= 2;
    return { base: m[1], axis: def.axis, layers: def.layers, q };
  }

  function parseAlg(str) {
    const toks = str.replace(/[’′`]/g, "'").trim().split(/\s+/).filter(Boolean);
    toks.forEach(parseMove);
    return toks;
  }

  const PERMS = new Map();
  function permFor(tok) {
    let p = PERMS.get(tok);
    if (p) return p;
    const mv = parseMove(tok);
    p = new Int16Array(54);
    FACELETS.forEach((f, i) => {
      p[i] = mv.layers.includes(f.pos[mv.axis])
        ? INDEX.get(key(rot(f.pos, mv.axis, mv.q), rot(f.normal, mv.axis, mv.q)))
        : i;
    });
    PERMS.set(tok, p);
    return p;
  }

  function applyMove(s, tok) {
    const p = permFor(tok);
    const out = new Array(54);
    for (let i = 0; i < 54; i++) out[p[i]] = s[i];
    return out;
  }

  function applyMoves(s, toks) {
    for (const t of toks) s = applyMove(s, t);
    return s;
  }

  const solvedState = () => FACELETS.map(f => SCHEME[f.face]);

  function invertMove(t) {
    if (t.endsWith('2')) return t.replace("'", '');
    if (t.endsWith("'")) return t.slice(0, -1);
    return t + "'";
  }
  const invertAlg = toks => toks.slice().reverse().map(invertMove);

  function scramble(len = 22) {
    const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
    const axisOf = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
    const out = [];
    let lastAxis = -1, axisCount = 0;
    while (out.length < len) {
      const f = faces[Math.floor(Math.random() * 6)];
      const ax = axisOf[f];
      if (out.length && out[out.length - 1][0] === f) continue;
      if (ax === lastAxis && axisCount >= 2) continue;
      axisCount = ax === lastAxis ? axisCount + 1 : 1;
      lastAxis = ax;
      out.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
    }
    return out;
  }

  // ---- Inspection helpers -------------------------------------------------

  const at = (s, p, n) => s[INDEX.get(key(p, n))];
  const center = (s, n) => at(s, n, n);

  function stickerNormals(p) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      if (p[i]) { const n = [0, 0, 0]; n[i] = p[i]; out.push(n); }
    }
    return out;
  }

  const pieceSolved = (s, p) => stickerNormals(p).every(n => at(s, p, n) === center(s, n));
  const pieceColors = (s, p) => stickerNormals(p).map(n => at(s, p, n));
  const colorSet = arr => arr.slice().sort().join('');
  // Right spot, possibly twisted or flipped.
  const piecePlaced = (s, p) =>
    colorSet(pieceColors(s, p)) === colorSet(stickerNormals(p).map(n => center(s, n)));

  const POS = {
    dEdges: [[0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0]],
    dCorners: [[1, -1, 1], [1, -1, -1], [-1, -1, -1], [-1, -1, 1]],
    eEdges: [[1, 0, 1], [1, 0, -1], [-1, 0, -1], [-1, 0, 1]],
    uEdges: [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]],
    uCorners: [[1, 1, 1], [1, 1, -1], [-1, 1, -1], [-1, 1, 1]],
  };
  const UP = [0, 1, 0];

  const countSolved = (s, list) => list.reduce((n, p) => n + (pieceSolved(s, p) ? 1 : 0), 0);

  function stats(s) {
    return {
      petals: POS.uEdges.filter(p => at(s, p, UP) === 'w').length,
      cross: countSolved(s, POS.dEdges),
      corners: countSolved(s, POS.dCorners),
      middle: countSolved(s, POS.eEdges),
      yellowEdgesUp: POS.uEdges.filter(p => at(s, p, UP) === 'y').length,
      uEdges: countSolved(s, POS.uEdges),
      uCornersPlaced: POS.uCorners.filter(p => piecePlaced(s, p)).length,
      yellowCornersUp: POS.uCorners.filter(p => at(s, p, UP) === 'y').length,
    };
  }

  const isSolved = s => FACELETS.every((f, i) => s[i] === center(s, f.normal));

  // Every piece of a given kind, mapped from sorted color string -> position.
  function locate(s, colors, list) {
    const want = colorSet(colors);
    return list.find(p => colorSet(pieceColors(s, p)) === want) || null;
  }

  const ALL_EDGES = [].concat(POS.dEdges, POS.eEdges, POS.uEdges);
  const ALL_CORNERS = [].concat(POS.dCorners, POS.uCorners);

  // White/yellow first reads naturally: "white-red-blue corner".
  const NAME_ORDER = 'wygbor';
  const pieceName = colors => colors.slice()
    .sort((a, b) => NAME_ORDER.indexOf(a) - NAME_ORDER.indexOf(b))
    .map(c => COLOR_NAMES[c]).join('-');

  global.Cube = {
    FACE_NORMALS, SCHEME, COLOR_NAMES, FACELETS, INDEX, POS, UP, ALL_EDGES, ALL_CORNERS,
    key, rot, parseMove, parseAlg, applyMove, applyMoves, solvedState, invertMove, invertAlg,
    scramble, at, center, stickerNormals, pieceSolved, pieceColors, piecePlaced, colorSet,
    stats, isSolved, locate, pieceName,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
