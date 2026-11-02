// The advanced methods, built on the shared engine, plus their lessons.
(function (global) {
  'use strict';
  const C = global.Cube, E = global.Engine;
  const n = E.name;
  const cn = c => C.COLOR_NAMES[c];

  // ---- Shared algorithms -----------------------------------------------------

  const A = {
    line: { name: 'the line algorithm', moves: "F R U R' U' F'" },
    ell: { name: 'the L algorithm', moves: "f R U R' U' f'" },
    sune: { name: 'Sune', moves: "R U R' U R U2 R'" },
    antisune: { name: 'Antisune', moves: "R U2 R' U' R U' R'" },
    h: { name: 'H (double headlights)', moves: "F R U R' U' R U R' U' R U R' U' F'" },
    pi: { name: 'Pi (bruno)', moves: "R U2 R2 U' R2 U' R2 U2 R" },
    headlights: { name: 'Headlights (U)', moves: "R2 D R' U2 R D' R' U2 R'" },
    t: { name: 'T (chameleon)', moves: "r U R' U' r' F R F'" },
    bowtie: { name: 'Bowtie (L)', moves: "F' r U R' U' r' F R" },
    aa: { name: 'Aa-perm', moves: "x R' U R' D2 R U' R' D2 R2 x'" },
    yperm: { name: 'Y-perm', moves: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
    ua: { name: 'Ua-perm', moves: "R U' R U R U R U' R' U' R2" },
    ub: { name: 'Ub-perm', moves: "R2 U R U R' U' R' U' R' U R'" },
    hperm: { name: 'H-perm', moves: 'M2 U M2 U2 M2 U M2' },
    zperm: { name: 'Z-perm', moves: "M2 U M2 U M' U2 M2 U2 M' U2" },
    flip: { name: 'the edge-flip algorithm', moves: "M' U M' U M' U2 M U M U M U2" },
  };
  const OCLL = [A.sune, A.antisune, A.h, A.pi, A.headlights, A.t, A.bowtie];

  const U_FACE = C.FACELETS.map((f, i) => f.face === 'U' ? i : -1).filter(i => i >= 0);
  const U_EDGES = ['UF', 'UR', 'UB', 'UL'];
  const U_CORNERS = ['UFR', 'UFL', 'UBR', 'UBL'];
  const D_CORNERS = ['DFR', 'DFL', 'DBR', 'DBL'];
  const ALL_EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];
  const upSticker = name => C.INDEX.get(C.key(E.piece(name).pos, C.UP));
  const AUF = [[], ['U'], ['U2'], ["U'"]];
  const upToAUF = (s, names) => AUF.some(a => E.allHome(C.applyMoves(s, a), names));

  const goals = {
    yellowCross: s => U_EDGES.every(e => s[upSticker(e)] === 'y'),
    yellowFace: s => U_FACE.every(i => s[i] === 'y'),
    yellowCorners: s => U_CORNERS.every(c => s[upSticker(c)] === 'y'),
    cornersPermuted: s => upToAUF(s, U_CORNERS),
    solved: s => C.isSolved(s),
  };

  const LL_EXAMPLE = [A.sune.moves, A.line.moves, "R U R' U' R' F R2 U' R' U' R U R' F'", A.yperm.moves, 'U', 'U2'];
  // Each last-layer step gets positions that keep the earlier steps solved.
  const OLL2_EXAMPLE = [A.sune.moves, A.antisune.moves, "R U R' U' R' F R2 U' R' U' R U R' F'", 'U'];
  const PLL1_EXAMPLE = [A.aa.moves, A.yperm.moves, A.ua.moves, 'U'];
  const PLL2_EXAMPLE = [A.ua.moves, A.ub.moves, A.hperm.moves, 'U'];
  const llStages = (prefix, withCross) => [
    ...(withCross ? [{
      id: prefix + 'oll1', title: 'OLL 1 · Yellow cross', kind: 'algs', goal: goals.yellowCross,
      algs: [A.line, A.ell], example: LL_EXAMPLE, exampleLength: 8,
      recognize: a => a === A.line ? 'Line (or dot): hold it left-to-right. ' : 'L shape: hold it at back-left. ',
    }] : []),
    {
      id: prefix + 'oll2', title: withCross ? 'OLL 2 · Yellow face' : 'OCLL · Yellow face', kind: 'algs', goal: goals.yellowFace,
      algs: OCLL, example: OLL2_EXAMPLE, exampleLength: 8, recognize: a => `This is the ${a.name.split(' ')[0]} case. `,
    },
    {
      id: prefix + 'pll1', title: 'PLL 1 · Corners', kind: 'algs', goal: goals.cornersPermuted,
      algs: [A.aa, A.yperm], example: PLL1_EXAMPLE, exampleLength: 6,
      recognize: a => a === A.aa ? 'One side has "headlights" (two matching corners): put them at the back. ' : 'No headlights: the corners swap diagonally. ',
    },
    {
      id: prefix + 'pll2', title: 'PLL 2 · Edges', kind: 'algs', goal: goals.solved,
      algs: [A.ua, A.ub, A.hperm, A.zperm], example: PLL2_EXAMPLE, exampleLength: 4,
      recognize: a => (a === A.ua || a === A.ub) ? 'Three edges cycle: put the solved side at the back. ' : a === A.hperm ? 'Opposite edges swap. ' : 'Neighboring edges swap. ',
    },
  ];

  const ALL_SINGLE = E.MOVES.all;
  const singles = key => E.MOVES[key];
  const pairText = u => `Pair up the ${n(u[0])} corner with the ${n(u[1])} edge, then insert the pair into its slot.`;
  const blockText = (block, u, mv) => u.length > 2
    ? `Build the ${block} in one go: ${mv.length} moves.`
    : u.length === 2 ? `Add the ${n(u[0])} corner and ${n(u[1])} edge to the ${block}.`
      : `Place the ${n(u[0])} ${E.piece(u[0]).homes.length === 3 ? 'corner' : 'edge'} into the ${block}.`;

  // ---- CFOP ------------------------------------------------------------------

  const F2L_EXAMPLE = ['R', 'L', 'F', 'B'].flatMap(x => [`${x} U ${x}'`, `${x} U' ${x}'`, `${x}' U ${x}`, `${x}' U' ${x}`]).concat(['U', 'U2']);

  const cfop = E.makeMethod({
    id: 'cfop', name: 'CFOP (Fridrich)',
    defaultExample: ALL_SINGLE,
    stages: [
      {
        id: 'cross', title: 'Cross', kind: 'pieces', moves: 'all', joint: true, maxDepth: 10,
        units: [['DF'], ['DR'], ['DB'], ['DL']],
        explain: (u, s, mv) => u.length > 1
          ? `Plan the whole white cross at once: these ${mv.length} moves put ${u.length} white edges on the bottom, each matching its side center.`
          : `Place the ${n(u[0])} edge on the bottom, white side down, lined up with its center.`,
      },
      {
        id: 'f2l', title: 'F2L · First two layers', kind: 'pieces', moves: 'noD',
        units: [['DFR', 'FR'], ['DFL', 'FL'], ['DBR', 'BR'], ['DBL', 'BL']],
        explain: pairText, example: F2L_EXAMPLE, exampleLength: 30,
      },
      ...llStages('', true),
    ],
  });

  // ---- Roux --------------------------------------------------------------------

  const LSE_EDGES = ['UF', 'UB', 'DF', 'DB', 'UL', 'UR'];
  function lseEO(s) {
    // Look at whichever edge sits in each last-six-edges slot.
    return LSE_EDGES.every(name => {
      const pos = E.piece(name).pos;
      return C.stickerNormals(pos).some(nrm => {
        const c = C.at(s, pos, nrm);
        return (c === 'y' || c === 'w') && ['y', 'w'].includes(C.center(s, nrm));
      });
    });
  }
  const blocks = ['DL', 'DFL', 'FL', 'DBL', 'BL', 'DR', 'DFR', 'FR', 'DBR', 'BR'];
  const cornersHome = s => E.allHome(s, U_CORNERS);

  const roux = E.makeMethod({
    id: 'roux', name: 'Roux', frame: 'lr',
    defaultExample: ALL_SINGLE,
    stages: [
      {
        id: 'fb', title: 'First block (left)', kind: 'pieces', moves: 'all', joint: true,
        units: [['DL'], ['DFL', 'FL'], ['DBL', 'BL']],
        explain: (u, s, mv) => blockText('left 1×2×3 block', u, mv),
      },
      {
        id: 'sb', title: 'Second block (right)', kind: 'pieces', moves: 'RUMr',
        units: [['DR'], ['DFR', 'FR'], ['DBR', 'BR']],
        explain: (u, s, mv) => blockText('right 1×2×3 block (only R, r, U and M turns, so the left block stays put)', u, mv),
        example: singles('RUMr'),
      },
      {
        id: 'cmll', title: 'CMLL · Top corners', kind: 'algs',
        goal: s => goals.yellowCorners(s) && goals.cornersPermuted(s),
        algs: OCLL.concat([A.aa, A.yperm]), example: LL_EXAMPLE.concat(['M', "M'"]), exampleLength: 8,
        recognize: a => `Corner case: ${a.name.split(' ')[0]}. `,
      },
      {
        id: 'eo', title: 'LSE · Orient edges', kind: 'predicate', moves: 'MU', maxDepth: 12,
        goal: s => upToAUF(s, U_CORNERS) && lseEO(s),
        explain: () => "Fix the edges so each has its yellow or white sticker facing the yellow/white centers. Use only M and U.",
        example: singles('MU'),
      },
      {
        id: 'ulur', title: 'LSE · UL & UR edges', kind: 'predicate', moves: 'MU', maxDepth: 12,
        goal: s => lseEO(s) && cornersHome(s) && E.allHome(s, ['UL', 'UR']),
        explain: () => 'Bring the red-yellow and orange-yellow edges to the left and right of the top, corners lined up.',
        example: ['M2', 'U', 'U2', "U'"], exampleLength: 20,
      },
      {
        id: 'lsem', title: 'LSE · Middle slice', kind: 'predicate', moves: 'MU', maxDepth: 10,
        goal: goals.solved,
        explain: () => 'Finish the middle slice with M and U2 moves.',
        example: ['M2', "M' U2 M U2", "U2 M' U2 M"], exampleLength: 6,
      },
    ],
  });

  // ---- ZZ ----------------------------------------------------------------------

  const zz = E.makeMethod({
    id: 'zz', name: 'ZZ',
    defaultExample: ALL_SINGLE,
    stages: [
      {
        id: 'eo', title: 'EO · Orient all edges', kind: 'pieces', moves: 'all', units: [[]], eo: true, maxDepth: 9,
        explain: (u, s, mv) => `Find the "bad" edges and fix them with F or B quarter turns: ${mv.length} moves.`,
      },
      {
        id: 'line', title: 'EOLine · Bottom line', kind: 'pieces', moves: 'ZZ', units: [['DF', 'DB']], eo: true,
        explain: () => 'Place the white-green and white-blue edges at the front and back of the bottom — only F2 and B2 on the front/back so edges stay good.',
        example: singles('ZZ'),
      },
      {
        id: 'left', title: 'F2L · Left block', kind: 'pieces', moves: 'LUR', eo: true,
        units: [['DL'], ['DFL', 'FL'], ['DBL', 'BL']],
        explain: (u, s, mv) => blockText('left block (only L, U, R turns)', u, mv),
        example: singles('LUR'),
      },
      {
        id: 'right', title: 'F2L · Right block', kind: 'pieces', moves: 'RU', eo: true,
        units: [['DR'], ['DFR', 'FR'], ['DBR', 'BR']],
        explain: (u, s, mv) => blockText('right block (only R and U)', u, mv),
        example: singles('RU'),
      },
      ...llStages('', false),
    ],
  });

  // ---- Petrus -----------------------------------------------------------------

  const petrus = E.makeMethod({
    id: 'petrus', name: 'Petrus',
    defaultExample: ALL_SINGLE,
    stages: [
      {
        id: 'b222', title: '2×2×2 block', kind: 'pieces', moves: 'all', joint: true,
        units: [['DL'], ['DB'], ['DBL', 'BL']],
        explain: (u, s, mv) => blockText('2×2×2 block at the back-left-bottom', u, mv),
      },
      {
        id: 'b223', title: 'Expand to 2×2×3', kind: 'pieces', moves: 'URF', joint: true,
        units: [['DF'], ['DFL', 'FL']],
        explain: (u, s, mv) => blockText('2×2×3 block (only U, R, F so the 2×2×2 stays put)', u, mv),
        example: singles('URF'),
      },
      {
        id: 'eo', title: 'Fix bad edges', kind: 'pieces', moves: 'URF', units: [[]], eo: true, maxDepth: 13,
        explain: (u, s, mv) => `Orient the remaining edges with U, R and F so the rest can be solved with just R and U: ${mv.length} moves.`,
        example: ["F R F'", "F R' F'", "F' U F", 'R', 'U'], exampleLength: 15,
      },
      {
        id: 'f2l', title: 'Finish first two layers', kind: 'pieces', moves: 'RU', eo: true,
        units: [['DR'], ['DFR', 'FR'], ['DBR', 'BR']],
        explain: (u, s, mv) => blockText('first two layers (only R and U)', u, mv),
        example: singles('RU'),
      },
      ...llStages('', false),
    ],
  });

  // ---- Corners first ------------------------------------------------------------

  const ALL_CORNER_NAMES = U_CORNERS.concat(D_CORNERS);
  const CF_EDGE_EXAMPLE = ['R', 'L', 'F', 'B', 'U', 'D'].flatMap(x => ['M', 'E', 'S'].map(y => `${x} ${y} ${x}' ${y}'`));
  const cornersFirst = E.makeMethod({
    id: 'cf', name: 'Corners first',
    defaultExample: ALL_SINGLE,
    stages: [
      {
        id: 'bottom', title: 'Bottom corners', kind: 'pieces', moves: 'all', joint: true, maxDepth: 11,
        units: [['DFR'], ['DFL'], ['DBR'], ['DBL']],
        explain: (u, s, mv) => u.length > 1 ? `Solve the ${u.length} white corners together: ${mv.length} moves.` : `Place the ${n(u[0])} corner.`,
      },
      {
        id: 'topo', title: 'Orient top corners', kind: 'algs', goal: goals.yellowCorners, algs: OCLL,
        example: LL_EXAMPLE.concat(CF_EDGE_EXAMPLE), exampleLength: 12, recognize: a => `Case: ${a.name.split(' ')[0]}. `,
      },
      {
        id: 'topp', title: 'Permute top corners', kind: 'algs', goal: s => E.allHome(s, ALL_CORNER_NAMES), algs: [A.aa, A.yperm],
        example: LL_EXAMPLE.concat(CF_EDGE_EXAMPLE), exampleLength: 12,
      },
      {
        id: 'edges', title: 'Edges with slice moves', kind: 'commutator',
        pieces: ALL_EDGE_NAMES, keep: ALL_CORNER_NAMES, flip: A.flip,
        goal: s => C.isSolved(s),
        example: CF_EDGE_EXAMPLE, exampleLength: 14,
      },
    ],
  });
  // The corner stages only care about corners.
  cornersFirst.stages[0].goal = s => E.allHome(s, D_CORNERS);

  // ---- Blindfolded: Old Pochmann -------------------------------------------------

  const edgesHomeOrULUB = s => {
    const others = ALL_EDGE_NAMES.filter(e => e !== 'UL' && e !== 'UB');
    if (!E.allHome(s, others)) return false;
    if (E.allHome(s, ['UL', 'UB'])) return true;
    // UL and UB swapped is what an odd number of corner swaps leaves behind — fine mid-corners.
    const ul = E.piece('UL'), ub = E.piece('UB');
    const holds = (slot, p) => C.colorSet(slot.homes.map(i => s[i])) === p.set && s[upSticker(slot.name)] === 'y';
    return holds(ul, ub) && holds(ub, ul);
  };
  const bld = E.makeMethod({
    id: 'bld', name: 'Blindfolded (Old Pochmann)',
    defaultExample: ALL_SINGLE,
    stages: [
      { id: 'edges', title: 'Edges · one target at a time', kind: 'bld', bld: 'edge', goal: edgesHomeOrULUB },
      {
        id: 'corners', title: 'Corners · one target at a time', kind: 'bld', bld: 'corner', goal: goals.solved,
        example: ["R U R' D R U' R' D'", "D R U R' D' R U' R'", "U R U R' D R U' R' D' U'",
          "R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'", 'U2 R U R\' D R U\' R\' D\' U2'],
        exampleLength: 6,
      },
    ],
  });

  // ---- Lessons ---------------------------------------------------------------------

  const llLessons = withCross => [
    ...(withCross ? [{
      stage: 'oll1', title: 'OLL 1 · Yellow cross',
      body: `<p>Look only at the top edges. Dot, L or line — like the beginner method, but with a faster L algorithm (it uses a wide <span class="mv">f</span>: the front two layers).</p>
        <ul><li><b>Line:</b> hold it left-to-right → line algorithm.</li><li><b>L:</b> hold it at back-left → L algorithm.</li><li><b>Dot:</b> line algorithm, then L algorithm.</li></ul>`,
      algs: [{ name: 'Line', moves: A.line.moves }, { name: 'L shape', moves: A.ell.moves }],
    }] : []),
    {
      stage: 'oll2', title: withCross ? 'OLL 2 · Yellow face' : 'OCLL · Yellow face',
      body: `<p>Now turn the top all yellow. Count the yellow corners on top and look at where the side yellows point. There are 7 cases, each with one algorithm:</p>
        <ul><li><b>1 corner up:</b> Sune or Antisune.</li><li><b>0 up:</b> H (two pairs of headlights) or Pi.</li><li><b>2 up:</b> Headlights, T or Bowtie.</li></ul>`,
      algs: OCLL.map(a => ({ name: a.name, moves: a.moves })),
    },
    {
      stage: 'pll1', title: 'PLL 1 · Corners',
      body: `<p>Look at the corners on the sides. Two corners on one side with the same color are <b>headlights</b>.</p>
        <ul><li><b>Headlights on one side:</b> hold them at the back and do the Aa-perm.</li><li><b>No headlights:</b> corners swap diagonally — Y-perm.</li></ul>`,
      algs: [{ name: 'Aa-perm', moves: A.aa.moves }, { name: 'Y-perm', moves: A.yperm.moves }],
    },
    {
      stage: 'pll2', title: 'PLL 2 · Edges',
      body: `<p>Last step! Now only edges are wrong.</p>
        <ul><li><b>One side fully solved:</b> hold it at the back; Ua (edges cycle counter-clockwise) or Ub (clockwise).</li><li><b>No side solved, opposite edges swapped:</b> H-perm.</li><li><b>No side solved, neighboring edges swapped:</b> Z-perm.</li></ul>`,
      algs: [A.ua, A.ub, A.hperm, A.zperm].map(a => ({ name: a.name, moves: a.moves })),
    },
  ];

  const lessons = {
    cfop: [
      {
        title: 'What is CFOP?',
        body: `<p>CFOP (named after Jessica Fridrich) is what most speedcubers use. It's the beginner method's big brother: same shape (bottom → middle → top), but each part is done in fewer, smarter moves.</p>
          <ol><li><b>Cross</b> — white cross on the bottom, planned all at once.</li><li><b>F2L</b> — the first two layers, one corner+edge <i>pair</i> at a time.</li><li><b>OLL</b> — make the top yellow.</li><li><b>PLL</b> — move the top pieces home.</li></ol>
          <p>Here you'll learn <b>4-look last layer</b>: 2 steps for OLL and 2 for PLL, about 16 algorithms. Full CFOP uses 57 + 21 algorithms to do each in one look.</p>`,
      },
      {
        stage: 'cross', title: 'Cross',
        body: `<p>Same goal as the beginner cross, but solved directly on the bottom — no daisy. Good solvers plan the whole cross during inspection; it never needs more than 8 moves.</p>
          <p>Tip: solve it on the bottom from the start so you can see F2L pieces while you finish.</p>`,
      },
      {
        stage: 'f2l', title: 'F2L · Pairs',
        body: `<p>Instead of putting in a corner, then its edge, find a corner and its matching edge, <b>pair them up in the top layer</b>, and insert both with one short move like <span class="mv">R U R'</span>.</p>
          <ul><li>Keep the slot you're working on at the front-right (or front-left).</li><li>Never use D — it would break the cross.</li><li>Most cases are 3–11 moves. The coach shows a short way for whichever pair is easiest right now.</li></ul>`,
        algs: [{ name: 'Basic insert (right)', moves: "U R U' R'" }, { name: 'Basic insert (left)', moves: "U' L' U L" }, { name: 'Pair & insert', moves: "R U2 R' U' R U R'" }],
      },
      ...llLessons(true),
    ],
    roux: [
      {
        title: 'What is Roux?',
        body: `<p>Roux (by Gilles Roux) builds two blocks and leaves the middle slice for last. It uses very few algorithms and lots of <span class="mv">M</span> turns (the middle slice between L and R).</p>
          <ol><li><b>First block</b> — a 1×2×3 block on the left.</li><li><b>Second block</b> — a 1×2×3 block on the right.</li><li><b>CMLL</b> — solve the 4 top corners.</li><li><b>LSE</b> — the last six edges with only M and U.</li></ol>
          <p>The coach holds the cube with the orange center on the right and red on the left; M turns move the other centers around, which is normal in Roux.</p>`,
      },
      { stage: 'fb', title: 'First block', body: `<p>Build a 1×2×3 block on the left: the white-red edge on the bottom-left, plus two corner/edge pairs (front and back). It's fully intuitive — any moves are allowed because nothing is solved yet.</p>` },
      { stage: 'sb', title: 'Second block', body: `<p>Build the same block on the right, but only using <span class="mv">R</span>, <span class="mv">r</span>, <span class="mv">U</span> and <span class="mv">M</span>. None of them touch the left block.</p>` },
      {
        stage: 'cmll', title: 'CMLL · Top corners',
        body: `<p>Solve the 4 top corners without caring about the edges. Full CMLL has 42 algorithms; here we do it in two looks: orient the corners (7 cases, same as OCLL), then permute them (Aa or Y).</p>`,
        algs: OCLL.concat([A.aa, A.yperm]).map(a => ({ name: a.name, moves: a.moves })),
      },
      { stage: 'eo', title: 'LSE · Edge orientation', body: `<p>Only six edges are left, and they can all be solved with <span class="mv">M</span> and <span class="mv">U</span>. First "orient" them: every edge should show its yellow or white sticker on the yellow/white faces. <span class="mv">M' U M'</span>-style moves flip edges.</p>` },
      { stage: 'ulur', title: 'LSE · UL and UR', body: `<p>Put the red-yellow and orange-yellow edges into the left and right of the top layer (often by placing them together at the bottom first, then <span class="mv">M2</span>).</p>` },
      { stage: 'lsem', title: 'LSE · Finish', body: `<p>The last four edges live in the middle slice. A few <span class="mv">M2</span> and <span class="mv">U2</span> moves finish the cube.</p>` },
    ],
    zz: [
      {
        title: 'What is ZZ?',
        body: `<p>ZZ (by Zbigniew Zborowski) starts by <b>orienting every edge</b>. After that, the whole cube can be solved turning only <span class="mv">L</span>, <span class="mv">U</span> and <span class="mv">R</span> — no cube rotations, very smooth.</p>
          <ol><li><b>EO</b> — orient all 12 edges.</li><li><b>Line</b> — white-green and white-blue edges on the bottom.</li><li><b>F2L</b> — left block, then right block with only L/U/R.</li><li><b>Last layer</b> — edges are already oriented, so skip the yellow cross step.</li></ol>`,
      },
      {
        stage: 'eo', title: 'Edge orientation',
        body: `<p>An edge is <b>good</b> if you could solve it with only R, L, U, D (no F or B quarter turns). Quick check: look at the yellow/white stickers on edges. On the top and bottom they should face up/down; in the middle layer, look at the green/blue sticker instead — it should face front/back.</p>
          <p>Each <span class="mv">F</span> or <span class="mv">B</span> quarter turn flips 4 edges. Bring bad edges onto the front, then turn F.</p>`,
      },
      { stage: 'line', title: 'EOLine', body: `<p>Place the white-green edge at bottom-front and the white-blue edge at bottom-back. Only half turns on F and B now, or you'll break orientation.</p>` },
      { stage: 'left', title: 'Left block', body: `<p>Build the left 1×2×3 block with <span class="mv">L</span>, <span class="mv">U</span> and <span class="mv">R</span>.</p>` },
      { stage: 'right', title: 'Right block', body: `<p>Finish the first two layers on the right using only <span class="mv">R</span> and <span class="mv">U</span>.</p>` },
      ...llLessons(false),
    ],
    petrus: [
      {
        title: 'What is Petrus?',
        body: `<p>Petrus (by Lars Petrus) grows a block step by step, then orients edges so the rest is just <span class="mv">R</span> and <span class="mv">U</span>. It teaches block building beautifully.</p>
          <ol><li><b>2×2×2 block</b> at the back-left-bottom.</li><li><b>2×2×3</b> — extend it to the front.</li><li><b>Fix bad edges</b>.</li><li><b>Finish F2L</b> with R and U.</li><li><b>Last layer</b>.</li></ol>`,
      },
      { stage: 'b222', title: '2×2×2 block', body: `<p>Build a 2×2×2 cube in the back-left-bottom: the white-blue-red corner, its three edges, and the matching centers. Make little pairs first, then join them.</p>` },
      { stage: 'b223', title: '2×2×3 block', body: `<p>Extend the block to the front: add the white-green edge and the white-green-red corner + green-red edge pair. Use only <span class="mv">U</span>, <span class="mv">R</span>, <span class="mv">F</span> so the 2×2×2 isn't touched.</p>` },
      { stage: 'eo', title: 'Fix bad edges', body: `<p>Same idea as ZZ: an edge is "bad" if it can't be solved with just R and U. Bring bad edges to the front or top and turn F to flip them.</p>` },
      { stage: 'f2l', title: 'Finish F2L', body: `<p>Complete the first two layers with only <span class="mv">R</span> and <span class="mv">U</span>.</p>` },
      ...llLessons(false),
    ],
    cf: [
      {
        title: 'What is corners-first?',
        body: `<p>The oldest family of methods — many early record holders used it. Solve all 8 corners first (like a 2×2 cube), then slot edges in with <b>slice moves</b>, which never disturb corners.</p>
          <ol><li><b>Bottom corners</b>.</li><li><b>Top corners</b> — orient, then permute.</li><li><b>Edges</b> with commutators like <span class="mv">R E R' E'</span>.</li></ol>`,
      },
      { stage: 'bottom', title: 'Bottom corners', body: `<p>Get the 4 white corners onto the bottom, each matching its side centers. Ignore all the edges.</p>` },
      { stage: 'topo', title: 'Orient top corners', body: `<p>Make the 4 top corners yellow on top — the same 7 cases as OCLL.</p>`, algs: OCLL.map(a => ({ name: a.name, moves: a.moves })) },
      { stage: 'topp', title: 'Permute top corners', body: `<p>Headlights at the back → Aa-perm. No headlights → Y-perm.</p>`, algs: [A.aa, A.yperm].map(a => ({ name: a.name, moves: a.moves })) },
      {
        stage: 'edges', title: 'Edges',
        body: `<p>A <b>commutator</b> <span class="mv">X Y X' Y'</span> with a face turn X and a slice turn Y swaps three edges and leaves every corner where it was. Combine them to place edges one at a time.</p>
          <p>Two edges flipped in place? Use the edge-flip algorithm.</p>`,
        algs: [{ name: 'Edge 3-cycle', moves: "R E R' E'" }, { name: 'Edge 3-cycle (top)', moves: "M' U2 M U2" }, { name: 'Flip UF and UB', moves: A.flip.moves }],
      },
    ],
    bld: [
      {
        title: 'Solving blindfolded',
        body: `<p>Blind solvers look at the cube, memorize it, put on a blindfold and solve. <b>Old Pochmann</b> is the classic first method: one piece at a time, always with the same swap algorithm.</p>
          <ul><li>A fixed <b>buffer</b> spot: UR for edges, UBL for corners.</li><li>See which sticker sits in the buffer → that's your <b>target</b>.</li><li><b>Setup moves</b> bring the target to the swap spot (without touching the buffer), do the swap algorithm, undo the setup.</li><li>Repeat. If the buffer holds its own piece, "break into a new cycle" by shooting to any unsolved piece.</li></ul>
          <p class="tip">Parity: the edge swap (T-perm) also swaps two corners, and the corner swap swaps two edges. With an odd number of edge targets, real blind solvers add a parity fix. The coach reads the cube live, so it handles that automatically.</p>`,
      },
      { stage: 'edges', title: 'Edges', body: `<p>Buffer: <b>UR</b>. Swap spot: <b>UL</b>. Setup moves use only L, D, M and E, which never touch the buffer or the corners the T-perm swaps.</p>`, algs: [{ name: 'T-perm (swap UR ↔ UL)', moves: "R U R' U' R' F R2 U' R' U' R U R' F'" }] },
      { stage: 'corners', title: 'Corners', body: `<p>Buffer: <b>UBL</b>. Setup moves use only R, D and F. The swap is a Y-perm without its first and last moves.</p>`, algs: [{ name: 'Corner swap', moves: "R U' R' U' R U R' F' R U R' U' R' F R" }] },
    ],
  };

  const methods = { cfop, roux, zz, petrus, cf: cornersFirst, bld };
  for (const [id, m] of Object.entries(methods)) {
    m.lessons = lessons[id].map((l, i) => Object.assign({ id: `${id}-${l.stage || 'intro' + i}` }, l));
    m.lessons.push({ id: `${id}-practice`, title: 'Practice: full solve', practice: true, body: `<p>Scramble and solve with ${m.name}. Ask the coach whenever you're unsure — it detects which step you're on.</p>` });
  }

  global.METHODS = methods;
})(typeof globalThis !== 'undefined' ? globalThis : window);
