(function () {
  'use strict';
  const C = window.Cube, K = window.Coach, LESSONS = window.LESSONS;
  const $ = sel => document.querySelector(sel);

  // Every method exposes the same shape: lessons, stages, stageOf, next, example.
  const NOTATION = LESSONS.find(l => l.id === 'notation');
  const METHOD_LIST = [{
    id: 'beginner', name: 'Beginner (layer by layer)', lessons: LESSONS, stages: K.STAGES,
    stageOf: K.stageOf, next: K.next,
    example: l => {
      for (let tries = 0; tries < 40; tries++) {
        const s = K.advance(C.applyMoves(C.solvedState(), C.scramble()), (t, stage) => l.example(t, stage, C.stats(t)));
        if (s) return s;
      }
      return null;
    },
    holdLabel: 'Hold white on the bottom',
  }].concat(Object.values(window.METHODS).map(m => ({
    id: m.id, name: m.name, lessons: [NOTATION].concat(m.lessons), stages: m.stages,
    stageOf: m.stageOf, next: m.next, example: l => m.example(l.stage),
    holdLabel: m.frame === 'lr' ? 'Hold orange right, red left' : 'Hold yellow on top, green in front',
  })));
  let method = METHOD_LIST[0];

  // ---- State ----------------------------------------------------------------

  let state = C.solvedState();
  let history = [];
  let version = 0;
  let lesson = method.lessons[0];
  let hint = null;          // { title, steps, flat: [{tok, step}], pos, version, stale }
  let playing = false;
  let stopReq = false;
  let exampleLoaded = false;
  let speed = 260;

  // ---- 3D cube (CSS transforms) -----------------------------------------------

  // Several "panes" can show the same cube from different cameras. Each pane
  // has its own copy of the 3D faces; moves animate all of them together.
  const viewsEl = $('#views');
  const viewBar = $('#viewBar');
  const ORIENT = {
    '1,0,0': 'rotateY(90deg)', '-1,0,0': 'rotateY(-90deg)',
    '0,1,0': 'rotateX(90deg)', '0,-1,0': 'rotateX(-90deg)',
    '0,0,1': '', '0,0,-1': 'rotateY(180deg)',
  };
  const NORMALS = Object.keys(ORIENT).map(k => k.split(',').map(Number));
  const NO_ROT = 'rotate3d(1,0,0,0deg) ';
  const MAX_VIEWS = 4;

  // rx tilts the camera (negative looks down on the top), ry spins around the vertical axis.
  const VIEWS = {
    iso: { label: '3D', rx: -28, ry: -36 },
    isoUnder: { label: '3D under', rx: 32, ry: -36 },
    front: { label: 'Front', rx: 0, ry: 0 },
    back: { label: 'Back', rx: 0, ry: 180 },
    left: { label: 'Left', rx: 0, ry: 90 },
    right: { label: 'Right', rx: 0, ry: -90 },
    top: { label: 'Top', rx: -90, ry: 0 },
    bottom: { label: 'Bottom', rx: 90, ry: 0 },
  };

  let panes = [];
  let highlightKind = '';

  function buildFaces(cubeEl) {
    const faces = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const pos = [x, y, z];
      const kind = ['', 'center', 'edge', 'corner'][Math.abs(x) + Math.abs(y) + Math.abs(z)];
      for (const n of NORMALS) {
        const idx = C.INDEX.get(C.key(pos, n));
        const el = document.createElement('div');
        el.className = 'face ' + kind;
        if (idx !== undefined) {
          const st = document.createElement('div');
          st.className = 'sticker';
          el.appendChild(st);
        } else {
          el.classList.add('inner');
        }
        cubeEl.appendChild(el);
        faces.push({ el, pos, n, idx, sticker: el.firstChild, base: '' });
      }
    }
    return faces;
  }

  function makePane(name) {
    const sceneEl = document.createElement('div');
    sceneEl.className = 'scene';
    sceneEl.title = 'Drag to look around · double-click to reset this view';
    const label = document.createElement('span');
    label.className = 'pane-label';
    const cubeEl = document.createElement('div');
    cubeEl.className = 'cube';
    cubeEl.dataset.hl = highlightKind;
    const mainBtn = document.createElement('button');
    mainBtn.className = 'pane-main-btn';
    mainBtn.textContent = '⤢ Make main';
    mainBtn.title = 'Show this view as the big main view';
    mainBtn.addEventListener('pointerdown', e => e.stopPropagation());
    mainBtn.addEventListener('dblclick', e => e.stopPropagation());
    mainBtn.addEventListener('click', () => makeMain(name));
    sceneEl.append(label, mainBtn, cubeEl);
    const pane = { name, sceneEl, cubeEl, label, faces: buildFaces(cubeEl), view: { rx: VIEWS[name].rx, ry: VIEWS[name].ry } };
    setLabel(pane, false);
    applyView(pane);

    let drag = null;
    sceneEl.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY, ...pane.view };
      cubeEl.classList.remove('glide');
      sceneEl.setPointerCapture(e.pointerId);
    });
    sceneEl.addEventListener('pointermove', e => {
      if (!drag) return;
      pane.view.ry = drag.ry + (e.clientX - drag.x) * 0.5;
      pane.view.rx = Math.max(-90, Math.min(90, drag.rx - (e.clientY - drag.y) * 0.5));
      applyView(pane);
      setLabel(pane, true);
    });
    const endDrag = () => { drag = null; };
    sceneEl.addEventListener('pointerup', endDrag);
    sceneEl.addEventListener('pointercancel', endDrag);
    sceneEl.addEventListener('dblclick', () => glideTo(pane, pane.name));
    cubeEl.addEventListener('transitionend', e => { if (e.target === cubeEl) cubeEl.classList.remove('glide'); });
    return pane;
  }

  const applyView = p => { p.cubeEl.style.transform = `rotateX(${p.view.rx}deg) rotateY(${p.view.ry}deg)`; };
  const setLabel = (p, moved) => { p.label.textContent = VIEWS[p.name].label + (moved ? ' (moved)' : ''); };

  function glideTo(pane, name) {
    const target = VIEWS[name];
    // Spin the short way round, however far the user has dragged.
    const dy = ((target.ry - pane.view.ry) % 360 + 540) % 360 - 180;
    pane.view = { rx: target.rx, ry: pane.view.ry + dy };
    pane.cubeEl.classList.add('glide');
    applyView(pane);
    setLabel(pane, false);
  }

  // The first view is the big main view; the rest stack beside it.
  const sideEl = document.createElement('div');
  sideEl.className = 'side-views';

  function setViews(names) {
    const keep = new Map(panes.map(p => [p.name, p]));
    panes = names.map(n => keep.get(n) || makePane(n));
    panes.forEach((p, i) => p.sceneEl.classList.toggle('is-main', i === 0));
    sideEl.replaceChildren(...panes.slice(1).map(p => p.sceneEl));
    viewsEl.replaceChildren(panes[0].sceneEl, ...(panes.length > 1 ? [sideEl] : []));
    viewsEl.dataset.count = panes.length;
    $('#mainViewSelect').replaceChildren(...names.map(n => new Option(VIEWS[n].label, n)));
    $('#mainViewSelect').value = names[0];
    $('#mainViewPick').hidden = names.length < 2;
    try { localStorage.setItem('cube-coach-views', JSON.stringify(names)); } catch (e) { /* storage unavailable */ }
    viewBar.querySelectorAll('.vbtn').forEach(b => {
      const on = names.includes(b.dataset.view);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
      b.disabled = !on && names.length >= MAX_VIEWS;
    });
    $('#viewHint').textContent = names.length >= MAX_VIEWS
      ? 'Showing a main view and 3 side views (the most). Click a view to hide it.'
      : `Click to show or hide views — one main view plus up to ${MAX_VIEWS - 1} side views.`;
    layout();
    paint();
  }

  function makeMain(name) {
    const names = panes.map(p => p.name);
    setViews([name].concat(names.filter(n => n !== name)));
  }
  $('#mainViewSelect').addEventListener('change', e => makeMain(e.target.value));

  viewBar.addEventListener('click', e => {
    const b = e.target.closest('.vbtn');
    if (!b) return;
    const names = panes.map(p => p.name);
    const name = b.dataset.view;
    if (names.includes(name)) {
      if (names.length > 1) setViews(names.filter(n => n !== name));
    } else if (names.length < MAX_VIEWS) {
      setViews(names.concat(name));
    }
  });

  function layout() {
    for (const p of panes) {
      const w = p.sceneEl.clientWidth, h = p.sceneEl.clientHeight;
      // The turned cube spans roughly 4.5 cubies; leave a little margin around it.
      const S = Math.max(22, Math.min(180, Math.floor(Math.min(w / 5.2, h / 5.2))));
      p.cubeEl.style.setProperty('--s', S + 'px');
      for (const f of p.faces) {
        const [x, y, z] = f.pos;
        f.base = `translate3d(${x * S}px,${-y * S}px,${z * S}px) ${ORIENT[f.n.join(',')]} translateZ(${S / 2}px)`;
        f.el.style.transition = 'none';
        f.el.style.transform = NO_ROT + f.base;
      }
    }
  }

  // Color focus: when non-empty, only these colors are drawn; the rest turn grey.
  let focus = [];
  const colorBar = $('#colorBar');

  function setFocus(colors) {
    focus = colors.length >= 6 ? [] : colors;
    try { localStorage.setItem('cube-coach-focus', JSON.stringify(focus)); } catch (e) { /* storage unavailable */ }
    colorBar.querySelectorAll('.cbtn').forEach(b => {
      const on = b.dataset.color ? focus.includes(b.dataset.color) : !focus.length;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    paint();
  }

  colorBar.addEventListener('click', e => {
    const b = e.target.closest('.cbtn');
    if (!b) return;
    const c = b.dataset.color;
    if (!c) setFocus([]);
    else if (focus.includes(c)) setFocus(focus.filter(x => x !== c));
    else setFocus(focus.concat(c));
  });

  // Cube style: plain colors, or a picture cube with one image per face.
  let skin = 'standard';
  // Picture-down direction of each center (by color), kept up to date move by move.
  let centerDown = null;
  const skinSelect = $('#skinSelect');
  for (const [id, sk] of Object.entries(window.Skins.SKINS)) skinSelect.add(new Option(sk.name, id));
  skinSelect.addEventListener('change', () => setSkin(skinSelect.value));
  function setSkin(id) {
    skin = window.Skins.SKINS[id] ? id : 'standard';
    skinSelect.value = skin;
    viewsEl.dataset.skin = skin;
    try { localStorage.setItem('cube-coach-skin', skin); } catch (e) { /* storage unavailable */ }
    paint();
  }

  function paint() {
    const { images, turn } = window.Skins.SKINS[skin];
    const tiles = images ? window.Skins.tiles(state, turn, centerDown) : null;
    for (const p of panes) {
      for (const f of p.faces) {
        if (f.idx === undefined) continue;
        const c = state[f.idx];
        const dim = focus.length && !focus.includes(c);
        const st = f.sticker.style;
        f.sticker.dataset.c = dim ? 'dim' : c;
        if (tiles && !dim) {
          const t = tiles[f.idx];
          st.backgroundImage = `url("${images[t.color]}")`;
          st.backgroundPosition = `${t.col * 50}% ${t.row * 50}%`;
          st.transform = t.rot ? `rotate(${t.rot}deg)` : '';
        } else if (st.backgroundImage) {
          st.backgroundImage = st.backgroundPosition = st.transform = '';
        }
      }
    }
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Easing curves. In a run of moves the layer keeps its speed from one move to
  // the next: speed up on the first, glide through the middle, settle on the last.
  const EASE = {
    single: k => (1 - Math.cos(Math.PI * k)) / 2,
    start: k => 1 - Math.cos(Math.PI * k / 2),
    middle: k => k,
    end: k => Math.sin(Math.PI * k / 2),
  };
  let lastMoveEnd = 0;
  let lastHadMore = false;

  // Animate frame by frame (no CSS transitions), so nothing waits on timers
  // and the final frame swaps straight to the repainted cube.
  function animateMove(tok, ms, more, quiet) {
    const mv = C.parseMove(tok);
    const axis = [0, 0, 0];
    axis[mv.axis] = 1;
    const cssAxis = `${axis[0]},${-axis[1]},${axis[2]}`;
    const angle = -mv.q * 90;
    const continuing = lastHadMore && performance.now() - lastMoveEnd < 80;
    const kind = continuing ? (more ? 'middle' : 'end') : (more ? 'start' : 'single');
    const ease = EASE[kind];
    let dur = Math.abs(mv.q) === 2 ? ms * 1.4 : ms;
    if (kind === 'middle') dur *= 0.75; // matches the speed the start curve ends on
    Sound.turn(dur / 1000, Math.abs(mv.q), quiet);
    const moving = [].concat(...panes.map(p => p.faces)).filter(f => mv.layers.includes(f.pos[mv.axis]));
    for (const f of moving) f.el.style.transition = 'none';
    return new Promise(resolve => {
      const t0 = performance.now();
      const frame = now => {
        const k = Math.min(1, (now - t0) / dur);
        const a = angle * ease(k);
        for (const f of moving) f.el.style.transform = `rotate3d(${cssAxis},${a}deg) ${f.base}`;
        if (k < 1) { requestAnimationFrame(frame); return; }
        for (const f of moving) f.el.style.transform = NO_ROT + f.base;
        lastMoveEnd = performance.now();
        lastHadMore = more;
        resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  // Every move runs through one queue so animations never overlap.
  // `more` says another move follows right away, so the turns can flow together.
  let chain = Promise.resolve();
  function move(tok, source = 'user', ms = speed, more = false) {
    const p = chain.then(async () => {
      await animateMove(tok, ms, more, source === 'scramble');
      if (!centerDown) centerDown = window.Skins.centerDefaults(state);
      centerDown = window.Skins.twistCenters(centerDown, state, tok);
      const wasSolved = C.isSolved(state);
      state = C.applyMove(state, tok);
      if (!wasSolved && C.isSolved(state) && source !== 'scramble') Sound.solved();
      version++;
      if (source === 'undo') history.pop();
      else history.push(tok);
      if (source !== 'hint' && hint) hint.stale = true;
      paint();
      refresh();
    });
    chain = p.catch(console.error);
    return p;
  }

  function setState(s) {
    state = s;
    centerDown = null; // no turning history: centers start upright
    history = [];
    version++;
    hint = null;
    paint();
    refresh();
  }

  // ---- Move buttons & keyboard -------------------------------------------------

  const grid = $('#moveGrid');
  for (const f of ['U', 'D', 'R', 'L', 'F', 'B']) {
    const g = document.createElement('div');
    g.className = 'move-group';
    for (const t of [f, f + "'", f + '2']) g.appendChild(moveButton(t));
    grid.appendChild(g);
  }
  for (const f of ['M', 'E', 'S', 'r']) {
    const g = document.createElement('div');
    g.className = 'move-group slice';
    for (const t of [f, f + "'", f + '2']) g.appendChild(moveButton(t));
    grid.appendChild(g);
  }
  const rotRow = document.createElement('div');
  rotRow.className = 'move-group rot';
  for (const t of ['y', "y'", 'x', "x'"]) rotRow.appendChild(moveButton(t));
  grid.appendChild(rotRow);

  function moveButton(t) {
    const b = document.createElement('button');
    b.className = 'mbtn';
    b.textContent = t;
    b.title = describeMove(t);
    b.addEventListener('click', () => { if (!playing) move(t); });
    return b;
  }

  function describeMove(t) {
    const names = {
      U: 'top', D: 'bottom', R: 'right', L: 'left', F: 'front', B: 'back',
      M: 'middle slice (like L)', E: 'equator slice (like D)', S: 'standing slice (like F)', r: 'right two layers',
      x: 'whole cube (like R)', y: 'whole cube (like U)', z: 'whole cube (like F)',
    };
    const dir = t.endsWith('2') ? 'twice' : t.endsWith("'") ? 'counter-clockwise' : 'clockwise';
    return `Turn ${names[t[0]]} ${dir}`;
  }

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || playing) return;
    const k = e.key.toLowerCase();
    const map = { u: 'U', d: 'D', r: 'R', l: 'L', f: 'F', b: 'B', m: 'M', e: 'E', s: 'S', x: 'x', y: 'y', z: 'z' };
    if (map[k]) { e.preventDefault(); move(map[k] + (e.shiftKey ? "'" : '')); }
  });

  function undo() {
    if (playing || !history.length) return;
    move(C.invertMove(history[history.length - 1]), 'undo');
  }

  $('#undoBtn').addEventListener('click', undo);
  $('#resetBtn').addEventListener('click', () => {
    if (playing) return;
    exampleLoaded = false;
    $('#scrambleText').textContent = '';
    setState(C.solvedState());
  });
  $('#scrambleBtn').addEventListener('click', async () => {
    if (playing) return;
    exampleLoaded = lesson.practice || !!lesson.stage;
    setState(C.solvedState());
    playing = true;
    refresh();
    const scr = C.scramble();
    $('#scrambleText').textContent = 'Scramble: ' + scr.join(' ');
    for (let i = 0; i < scr.length; i++) await move(scr[i], 'scramble', 70, i < scr.length - 1);
    history = [];
    playing = false;
    refresh();
  });
  const soundSelect = $('#soundSelect');
  for (const [id, st] of Object.entries(Sound.STYLES)) soundSelect.add(new Option(st.name, id));
  soundSelect.add(new Option('Sound off', 'off'));
  soundSelect.value = Sound.style();
  soundSelect.addEventListener('change', () => Sound.setStyle(soundSelect.value));

  const speedEl = $('#speed');
  speedEl.addEventListener('input', () => { speed = 700 - Number(speedEl.value); });
  speed = 700 - Number(speedEl.value);

  // ---- Lessons ----------------------------------------------------------------

  const nav = $('#lessonNav');
  const methodSelect = $('#methodSelect');
  for (const m of METHOD_LIST) methodSelect.add(new Option(m.name, m.id));
  methodSelect.addEventListener('change', () => setMethod(methodSelect.value));

  function setMethod(id, lessonId) {
    if (playing) stopPlaying();
    method = METHOD_LIST.find(m => m.id === id) || METHOD_LIST[0];
    methodSelect.value = method.id;
    try { localStorage.setItem('cube-coach-method', method.id); } catch (e) { /* storage unavailable */ }
    nav.replaceChildren(...method.lessons.map(l => {
      const b = document.createElement('button');
      b.className = 'lesson-link';
      b.dataset.id = l.id;
      b.innerHTML = `<span class="check" aria-hidden="true"></span><span>${l.title}</span>`;
      b.addEventListener('click', () => openLesson(l.id));
      return b;
    }));
    const first = method.lessons.find(l => l.id !== 'notation') || method.lessons[0];
    openLesson(lessonId && method.lessons.some(l => l.id === lessonId) ? lessonId : first.id);
  }

  const chips = (toks, cls = '') => toks.map(t => `<span class="mv ${cls}">${t}</span>`).join(' ');

  function openLesson(id) {
    if (playing) stopPlaying();
    const LESSONS = method.lessons;
    lesson = LESSONS.find(l => l.id === id) || LESSONS[0];
    try { localStorage.setItem('cube-coach-lesson', lesson.id); } catch (e) { /* storage unavailable */ }
    exampleLoaded = false;
    hint = null;
    highlight('');
    const i = LESSONS.indexOf(lesson);
    const panel = $('#lessonPanel');
    let html = `<p class="eyebrow">Lesson ${i + 1} of ${LESSONS.length}</p><h2>${lesson.title}</h2>${lesson.body}`;
    for (const a of lesson.algs || []) {
      html += `<div class="alg">
        <div class="alg-head"><span class="alg-name">${a.name}</span>
          <span class="alg-btns"><button class="btn small" data-try="${a.moves}">Try it</button>
          <button class="btn small ghost" data-undo-alg="${a.moves}" title="Play it backwards">Reverse</button></span></div>
        <div class="alg-moves">${chips(C.parseAlg(a.moves))}</div>
        ${a.note ? `<p class="note">${a.note}</p>` : ''}
      </div>`;
    }
    if (lesson.stage || lesson.practice) {
      html += `<div class="coach">
        <div class="coach-title">Coach</div>
        <div class="coach-actions">
          ${lesson.practice ? '' : '<button class="btn" id="exampleBtn">Load an example</button>'}
          <button class="btn primary" id="hintBtn">Show me the next step</button>
          ${lesson.practice ? '<button class="btn" id="solveAllBtn">Solve it all, explaining each step</button>' : ''}
        </div>
        <div id="hint" class="hint"></div>
        <div id="lessonDone" class="lesson-done" hidden></div>
      </div>`;
    }
    html += `<div class="pager">
      ${i > 0 ? `<button class="btn ghost" data-go="${LESSONS[i - 1].id}">← ${LESSONS[i - 1].title}</button>` : '<span></span>'}
      ${i < LESSONS.length - 1 ? `<button class="btn ghost" data-go="${LESSONS[i + 1].id}">${LESSONS[i + 1].title} →</button>` : ''}
    </div>`;
    panel.innerHTML = html;
    panel.scrollTop = 0;
    nav.querySelectorAll('.lesson-link').forEach(b => b.classList.toggle('active', b.dataset.id === lesson.id));

    if (lesson.stage && !lesson.practice) loadExample();
    renderHint();
    refresh();
  }

  $('#lessonPanel').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go) openLesson(t.dataset.go);
    else if (t.dataset.try) playAlg(C.parseAlg(t.dataset.try));
    else if (t.dataset.undoAlg) playAlg(C.invertAlg(C.parseAlg(t.dataset.undoAlg)));
    else if (t.dataset.highlight !== undefined) highlight(t.dataset.highlight);
    else if (t.dataset.focus !== undefined) setFocus(t.dataset.focus.split('').filter(Boolean));
    else if (t.id === 'exampleBtn') loadExample();
    else if (t.id === 'hintBtn') showHint();
    else if (t.id === 'solveAllBtn') solveAll();
    else if (t.id === 'playBtn') playHint(false);
    else if (t.id === 'stepBtn') playHint(true);
    else if (t.id === 'stopBtn') stopPlaying();
  });

  function highlight(kind) {
    highlightKind = kind;
    for (const p of panes) p.cubeEl.dataset.hl = kind;
  }

  async function playAlg(toks) {
    if (playing) return;
    playing = true;
    refresh();
    for (let i = 0; i < toks.length; i++) await move(toks[i], 'user', speed, i < toks.length - 1);
    playing = false;
    refresh();
  }

  function loadExample() {
    if (playing) return;
    const s = method.example(lesson);
    if (!s) return;
    exampleLoaded = true;
    $('#scrambleText').textContent = 'Example position for this step';
    setState(s);
  }

  // ---- Coach hints -------------------------------------------------------------

  function showHint() {
    if (playing) return;
    const h = method.next(state);
    const flat = [];
    h.steps.forEach((st, i) => st.moves.forEach(tok => flat.push({ tok, step: i })));
    hint = Object.assign(h, { flat, pos: 0, version, stale: false });
    renderHint();
  }

  function renderHint() {
    const el = $('#hint');
    if (!el) return;
    if (!hint) {
      el.innerHTML = '';
      return;
    }
    if (hint.stage === 'done') {
      el.innerHTML = `<div class="hint-title success">The cube is solved! 🎉</div><p>Press Scramble to try another one.</p>`;
      return;
    }
    if (hint.stuck) {
      el.innerHTML = `<div class="hint-title">Hmm, I can't find a step from here.</div><p>Something may have gotten mixed up. Try Undo, or load a fresh example.</p>`;
      return;
    }
    let flatIdx = 0;
    const steps = hint.steps.map((st, i) => {
      const moves = st.moves.map(tok => {
        const j = flatIdx++;
        const cls = j < hint.pos ? 'done' : j === hint.pos && !hint.stale ? 'current' : '';
        return `<span class="mv ${cls}">${tok}</span>`;
      }).join(' ');
      const first = hint.flat.findIndex(f => f.step === i);
      const last = first + st.moves.length - 1;
      const stCls = st.moves.length && hint.pos > last ? 'done' : (first <= hint.pos && hint.pos <= last ? 'active' : '');
      return `<li class="${stCls}"><p>${st.text}</p>${moves ? `<div class="alg-moves">${moves}</div>` : ''}</li>`;
    }).join('');
    const finished = hint.pos >= hint.flat.length;
    el.innerHTML = `
      <div class="hint-title">${hint.title}</div>
      <ol class="hint-steps">${steps}</ol>
      ${hint.stale ? '<p class="stale">The cube changed since this hint. Ask the coach again for an up-to-date step.</p>' : ''}
      <div class="hint-controls">
        ${playing ? '<button class="btn" id="stopBtn">■ Stop</button>'
          : finished ? '<button class="btn primary" id="hintBtn">Next step →</button>'
          : hint.stale ? '' : `<button class="btn primary" id="playBtn">▶ Play it</button>
             <button class="btn" id="stepBtn">One move at a time ⏭</button>`}
      </div>`;
  }

  async function playHint(single) {
    if (playing || !hint || hint.stale) return;
    playing = true;
    stopReq = false;
    renderHint();
    refresh();
    while (hint && hint.pos < hint.flat.length && !stopReq) {
      // Flow into the next move unless stepping one at a time or pausing between steps.
      const nxt = hint.flat[hint.pos + 1];
      const more = !single && !!nxt && nxt.step === hint.flat[hint.pos].step;
      await move(hint.flat[hint.pos].tok, 'hint', speed, more);
      hint.pos++;
      renderHint();
      if (single) break;
      if (hint.pos < hint.flat.length && hint.flat[hint.pos].step !== hint.flat[hint.pos - 1].step) await sleep(speed * 1.5);
    }
    playing = false;
    renderHint();
    refresh();
  }

  function stopPlaying() { stopReq = true; }

  async function solveAll() {
    if (playing) return;
    while (!stopReq) {
      showHint();
      if (!hint || hint.stage === 'done' || hint.stuck) break;
      await sleep(speed * 2);
      await playHint(false);
      if (stopReq) break;
      await sleep(speed * 2);
    }
    stopReq = false;
  }

  // ---- Status / progress ---------------------------------------------------------

  function refresh() {
    const STAGE_IDS = method.stages.map(x => x.id);
    const stage = method.stageOf(state);
    const st = C.stats(state);
    const ci = stage === 'done' ? STAGE_IDS.length : Math.max(0, STAGE_IDS.indexOf(stage));
    const stageLabel = stage === 'done' ? 'Solved!' : stage === 'hold' ? method.holdLabel
      : `Working on: ${method.stages[ci].title}`;
    $('#stageLabel').textContent = stageLabel;
    $('#stageLabel').classList.toggle('solved', stage === 'done');
    $('#moveCount').textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;

    const doneFor = l => {
      if (l.id === 'daisy') return ci > 0 || (stage !== 'hold' && st.petals + st.cross === 4);
      if (l.stage) return ci > STAGE_IDS.indexOf(l.stage);
      return false;
    };
    nav.querySelectorAll('.lesson-link').forEach(b => {
      const l = method.lessons.find(x => x.id === b.dataset.id);
      b.classList.toggle('complete', doneFor(l) && stage !== 'hold');
    });

    const doneEl = $('#lessonDone');
    if (doneEl) {
      const LESSONS = method.lessons;
      const i = LESSONS.indexOf(lesson);
      const show = exampleLoaded && lesson.stage && doneFor(lesson) && !playing;
      doneEl.hidden = !show;
      if (show) {
        const nxt = LESSONS[i + 1];
        doneEl.innerHTML = `<b>Step complete! ✓</b> ${nxt ? `<button class="btn primary small" data-go="${nxt.id}">Next: ${nxt.title} →</button>` : ''}`;
      }
    }
    renderHint();

    document.querySelectorAll('.mbtn, #undoBtn, #scrambleBtn, #resetBtn').forEach(b => { b.disabled = playing; });
    $('#undoBtn').disabled = playing || !history.length;
  }

  // ---- Boot ----------------------------------------------------------------

  // Re-size the cube whenever its views change size (window, layout toggle, view changes).
  new ResizeObserver(() => layout()).observe(viewsEl);

  const wideBtn = $('#wideBtn');
  function setWide(on) {
    document.body.classList.toggle('wide-cube', on);
    wideBtn.textContent = on ? '☰ Show lessons' : '⤢ Bigger cube';
    wideBtn.setAttribute('aria-pressed', on);
    try { localStorage.setItem('cube-coach-wide', on ? '1' : ''); } catch (e) { /* storage unavailable */ }
  }
  wideBtn.addEventListener('click', () => setWide(!document.body.classList.contains('wide-cube')));
  try { setWide(localStorage.getItem('cube-coach-wide') === '1'); } catch (e) { setWide(false); }
  let savedViews = ['iso'];
  try {
    const v = JSON.parse(localStorage.getItem('cube-coach-views'));
    if (Array.isArray(v) && v.length && v.length <= MAX_VIEWS && v.every(n => VIEWS[n])) savedViews = v;
  } catch (e) { /* storage unavailable or bad data */ }
  setViews(savedViews);
  let savedFocus = [];
  try {
    const f = JSON.parse(localStorage.getItem('cube-coach-focus'));
    if (Array.isArray(f) && f.every(c => C.COLOR_NAMES[c])) savedFocus = f;
  } catch (e) { /* storage unavailable or bad data */ }
  setFocus(savedFocus);
  let savedSkin = 'standard';
  try { savedSkin = localStorage.getItem('cube-coach-skin') || 'standard'; } catch (e) { /* storage unavailable */ }
  setSkin(savedSkin);
  let startMethod = 'beginner', startLesson = null;
  try {
    startMethod = localStorage.getItem('cube-coach-method') || 'beginner';
    startLesson = localStorage.getItem('cube-coach-lesson');
  } catch (e) { /* storage unavailable */ }
  setMethod(startMethod, startLesson);
})();
