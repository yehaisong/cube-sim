// Cube styles. A picture cube shows one image per face, cut into 9 tiles.
// Since every sticker then looks different, we work out for each facelet
// which tile is sitting there and how far it has been turned.
(function (global) {
  'use strict';
  const C = global.Cube;

  const SKINS = {
    standard: { name: 'Standard colors' },
    ljc: {
      name: 'LJC Global cube',
      images: {
        y: 'assets/ljc/yellow.png', r: 'assets/ljc/red.png', g: 'assets/ljc/green.png',
        o: 'assets/ljc/orange.png', b: 'assets/ljc/blue.png', w: 'assets/ljc/white.webp',
      },
      turn: { w: 180 }, // degrees to turn a face's picture
    },
  };
  // Same cube with the A.S.K. picture on the white side.
  SKINS.ljcAsk = {
    name: 'LJC A.S.K. cube',
    images: Object.assign({}, SKINS.ljc.images, { w: 'assets/ljc/white-ask.webp' }),
    turn: { w: 180 },
  };

  // How each face is drawn on screen: the picture's "right" and "down" in cube space.
  const BASIS = {
    U: { r: [1, 0, 0], d: [0, 0, 1] }, D: { r: [1, 0, 0], d: [0, 0, -1] },
    F: { r: [1, 0, 0], d: [0, -1, 0] }, B: { r: [-1, 0, 0], d: [0, -1, 0] },
    R: { r: [0, 0, -1], d: [0, -1, 0] }, L: { r: [0, 0, 1], d: [0, -1, 0] },
  };

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
  const scale = (v, k) => v.map(x => x * k);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const faceOf = n => Object.keys(C.FACE_NORMALS).find(f => same(C.FACE_NORMALS[f], n));
  const colorOfNormal = n => C.SCHEME[faceOf(n)];
  const normalOfColor = c => C.FACE_NORMALS[Object.keys(C.SCHEME).find(f => C.SCHEME[f] === c)];

  // Rotation taking orthonormal a→a2, b→b2 (so a×b → a2×b2), applied to v.
  function rotateBy(a, b, a2, b2, v) {
    const c = cross(a, b), c2 = cross(a2, b2);
    return add(scale(a2, dot(v, a)), scale(b2, dot(v, b)), scale(c2, dot(v, c)));
  }

  // Home position of every edge/corner, keyed by its color set.
  const HOME = new Map();
  for (const p of C.ALL_EDGES.concat(C.ALL_CORNERS)) {
    HOME.set(C.colorSet(C.stickerNormals(p).map(colorOfNormal)), p);
  }

  // A center has one sticker, so its twist can't be read from the colors.
  // Without history, assume the centers turned together with the whole cube:
  // the yellow and green centers tell us how the cube is being held.
  function whereIsCenter(state, c) {
    return Object.values(C.FACE_NORMALS).find(n => C.center(state, n) === c);
  }
  function defaultCenterDown(state, color) {
    const dh = BASIS[faceOf(normalOfColor(color))].d;
    return rotateBy(normalOfColor('y'), normalOfColor('g'), whereIsCenter(state, 'y'), whereIsCenter(state, 'g'), dh);
  }

  // Picture "down" direction of every center, keyed by color, for the given state.
  function centerDefaults(state) {
    const out = {};
    for (const c of Object.values(C.SCHEME)) out[c] = defaultCenterDown(state, c);
    return out;
  }

  // Turn the tracked centers that sit in the layers a move turns.
  function twistCenters(centers, state, tok) {
    const mv = C.parseMove(tok);
    const out = Object.assign({}, centers);
    for (const n of Object.values(C.FACE_NORMALS)) {
      if (mv.layers.includes(n[mv.axis])) {
        const c = C.center(state, n);
        out[c] = C.rot(out[c], mv.axis, mv.q);
      }
    }
    return out;
  }

  // For each facelet: which face picture, which tile (col,row), and rotation in degrees.
  // `centers` (optional) gives each center's tracked picture-down direction.
  function tiles(state, turn = {}, centers = null) {
    return C.FACELETS.map((f, i) => {
      const pos = f.pos, n = f.normal;
      const color = state[i];
      const nh = normalOfColor(color); // the face this sticker came from
      let homePos, down;
      const dh = BASIS[faceOf(nh)].d;
      const normals = C.stickerNormals(pos);
      if (normals.length === 1) {
        homePos = nh;
        down = centers && centers[color] ? centers[color] : defaultCenterDown(state, color);
      } else {
        const cols = normals.map(m => C.at(state, pos, m));
        homePos = HOME.get(C.colorSet(cols));
        // Pair two of the piece's stickers: where they started vs. where they are now.
        const [m1, m2] = normals;
        const h1 = normalOfColor(cols[0]), h2 = normalOfColor(cols[1]);
        down = rotateBy(h1, h2, m1, m2, dh);
      }
      const B = BASIS[faceOf(nh)];
      let col = dot(homePos, B.r) + 1, row = dot(homePos, B.d) + 1;
      const cur = BASIS[f.face];
      let rot = same(down, cur.d) ? 0 : same(down, scale(cur.r, -1)) ? 90 : same(down, scale(cur.d, -1)) ? 180 : 270;
      // A picture turned a quarter clockwise puts tile (col,row) where (row, 2-col) was.
      for (let q = 0; q < ((turn[color] || 0) / 90) % 4; q++) {
        [col, row] = [row, 2 - col];
        rot = (rot + 90) % 360;
      }
      return { color, col, row, rot };
    });
  }

  global.Skins = { SKINS, tiles, centerDefaults, twistCenters };
})(typeof globalThis !== 'undefined' ? globalThis : window);
