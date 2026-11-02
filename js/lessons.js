// Lesson content. `example` says when a practice position for the lesson is
// ready (the coach plays a random scramble forward until it is true).
(function (global) {
  'use strict';

  global.LESSONS = [
    {
      id: 'intro',
      title: 'Meet the cube',
      body: `
        <p>A Rubik's Cube looks like 54 stickers, but it's really <b>26 pieces</b> of three kinds. Tap each kind to see it on the cube:</p>
        <div class="chip-row">
          <button class="btn small" data-highlight="center">Centers (6)</button>
          <button class="btn small" data-highlight="edge">Edges (12)</button>
          <button class="btn small" data-highlight="corner">Corners (8)</button>
          <button class="btn small ghost" data-highlight="">Show all</button>
        </div>
        <ul>
          <li><b>Centers</b> have one color and <b>never move</b> relative to each other. The center tells you the color of its whole face: the face with the red center is the red face.</li>
          <li><b>Edges</b> have two colors.</li>
          <li><b>Corners</b> have three colors.</li>
        </ul>
        <p>You never solve "a face" — you put <b>pieces</b> where they belong. We'll do it <b>layer by layer</b>, bottom to top, in 8 steps. Each step only needs a few moves to remember.</p>
        <p>Throughout, hold the cube with <b>yellow on top</b> and <b>white on the bottom</b>.</p>
        <p>Too many colors at once? Use the <b>Colors</b> buttons under the views to show only one color (say, white) and turn the others grey. Add more colors as you get comfortable.</p>
        <p class="tip">Drag the cube to look around it. Double-click to reset the view.</p>`,
    },
    {
      id: 'notation',
      title: 'How moves are written',
      body: `
        <p>Every face has a letter. Turning a letter means turning that face <b>clockwise, as if you were looking straight at that face</b>.</p>
        <table class="notation">
          <tr><td><b>U</b></td><td>Up (top)</td><td><b>D</b></td><td>Down (bottom)</td></tr>
          <tr><td><b>F</b></td><td>Front (facing you)</td><td><b>B</b></td><td>Back</td></tr>
          <tr><td><b>R</b></td><td>Right</td><td><b>L</b></td><td>Left</td></tr>
        </table>
        <ul>
          <li>A tick mark means <b>counter-clockwise</b>: <span class="mv">R'</span> is "R prime".</li>
          <li>A 2 means <b>turn it twice</b>: <span class="mv">U2</span>.</li>
          <li><span class="mv">M</span>, <span class="mv">E</span>, <span class="mv">S</span> turn a <b>middle slice</b>: M is between L and R (turns like L), E between U and D (like D), S between F and B (like F).</li>
          <li>A lowercase face letter is a <b>wide</b> turn: <span class="mv">r</span> turns the right face and the middle slice together.</li>
          <li>Lowercase <span class="mv">x</span> <span class="mv">y</span> <span class="mv">z</span> turn the <b>whole cube</b> in your hands. You'll mostly use <span class="mv">y</span>: spin the whole cube the same way <span class="mv">U</span> turns, so a new side faces you.</li>
        </ul>
        <p>Click any move under the cube (or use your keyboard: <kbd>R</kbd>, <kbd>Shift</kbd>+<kbd>R</kbd> for R′) to watch it.</p>
        <p>Try this famous little sequence. Doing it 6 times brings the cube back to where it started:</p>`,
      algs: [{ name: 'The "sexy move"', moves: "R U R' U'", note: 'You will use it in step 3. Press Try it 6 times!' }],
    },
    {
      id: 'daisy',
      stage: 'cross',
      title: 'Step 1 · The daisy',
      body: `
        <p><b>Goal:</b> put the 4 white edges around the <b>yellow</b> center, white stickers facing up. It looks like a flower — the daisy.</p>
        <p class="tip">Hard to spot the white edges? <button class="btn small" data-focus="w">Show only white</button> <button class="btn small ghost" data-focus="">Show all colors</button></p>
        <p>No algorithm here; just a few tricks:</p>
        <ul>
          <li><b>White edge on the bottom, white facing down?</b> Turn that side twice (e.g. <span class="mv">F2</span>).</li>
          <li><b>White edge in the middle layer?</b> Turn the side face it's on so it rises to the top, white up.</li>
          <li><b>White edge in the top layer but white facing sideways?</b> Turn that face once to drop it into the middle, then lift it with a neighboring face.</li>
          <li><b>Before you lift an edge,</b> turn the top <span class="mv">U</span> so you don't knock off a petal you already placed.</li>
        </ul>
        <p>Stuck? Load an example and ask the coach.</p>`,
      example: (s, stage, st) => stage === 'cross' && st.petals + st.cross <= 1,
    },
    {
      id: 'cross',
      stage: 'cross',
      title: 'Step 2 · White cross',
      body: `
        <p><b>Goal:</b> move each daisy petal down to the white side, so you get a white cross on the bottom whose edges also match the side centers.</p>
        <ol>
          <li>Look at a petal's <b>other</b> color (not white).</li>
          <li>Turn <span class="mv">U</span> until that color sits above the center of the same color.</li>
          <li>Turn that face twice (<span class="mv">F2</span>, <span class="mv">R2</span>, …). The white edge lands on the bottom.</li>
        </ol>
        <p>Repeat for all four petals. Flip the cube over to check: you should see a white cross, and every side should show a little "T" of matching color.</p>`,
      example: (s, stage, st) => stage === 'cross' && st.petals === 4,
    },
    {
      id: 'corners',
      stage: 'corners',
      title: 'Step 3 · White corners',
      body: `
        <p><b>Goal:</b> finish the whole white layer.</p>
        <ol>
          <li>Find a corner in the <b>top</b> layer with white on it.</li>
          <li>Its two other colors tell you where it goes: the bottom spot between those two centers.</li>
          <li>Turn the top (<span class="mv">U</span>) to bring the corner directly above that spot, and hold the cube so the spot is at the <b>front-right</b>.</li>
          <li>Repeat <span class="mv">R U R' U'</span> until the corner drops in with white on the bottom (1, 3 or 5 times).</li>
        </ol>
        <p><b>Corner stuck in the bottom, in the wrong spot or twisted?</b> Hold it at front-right and do <span class="mv">R U R' U'</span> once to pop it up to the top. Then go back to step 1.</p>`,
      algs: [{ name: 'Insert corner (repeat)', moves: "R U R' U'" }],
      example: (s, stage) => stage === 'corners',
    },
    {
      id: 'middle',
      stage: 'middle',
      title: 'Step 4 · Middle layer',
      body: `
        <p><b>Goal:</b> place the 4 edges of the middle layer. Now the first two layers are done.</p>
        <ol>
          <li>Find an edge in the top layer with <b>no yellow</b> on it.</li>
          <li>Turn <span class="mv">U</span> so its front color sits above the matching center — it makes an <b>upside-down T</b>. Turn the whole cube so this T faces you.</li>
          <li>Look at the edge's top color. If it matches the <b>right</b> center, use the right algorithm; if it matches the <b>left</b> center, use the left one.</li>
        </ol>
        <p><b>No yellow-free edge on top?</b> One is stuck in the middle layer. Hold it at front-right and do the right algorithm once to kick it out.</p>`,
      algs: [
        { name: 'Edge goes right', moves: "U R U' R' U' F' U F" },
        { name: 'Edge goes left', moves: "U' L' U L U F U' F'" },
      ],
      example: (s, stage) => stage === 'middle',
    },
    {
      id: 'ycross',
      stage: 'ycross',
      title: 'Step 5 · Yellow cross',
      body: `
        <p><b>Goal:</b> a yellow cross on top. Only look at the 4 top edges — ignore the corners. You'll see one of these:</p>
        <p class="tip">Tip: <button class="btn small" data-focus="y">Show only yellow</button> and pick the <b>Top</b> view to see the shape clearly. <button class="btn small ghost" data-focus="">Show all colors</button></p>
        <div class="shapes">
          <figure><svg viewBox="0 0 30 30"><use href="#shape-dot"/></svg><figcaption>Dot</figcaption></figure>
          <figure><svg viewBox="0 0 30 30"><use href="#shape-L"/></svg><figcaption>L (at back-left)</figcaption></figure>
          <figure><svg viewBox="0 0 30 30"><use href="#shape-line"/></svg><figcaption>Line (left-right)</figcaption></figure>
          <figure><svg viewBox="0 0 30 30"><use href="#shape-cross"/></svg><figcaption>Cross ✓</figcaption></figure>
        </div>
        <p>Hold the L pointing <b>back and left</b>, or the line <b>left-to-right</b>, then do the algorithm. Dot → L → line → cross: each go moves you one shape forward.</p>`,
      algs: [{ name: 'Yellow cross', moves: "F R U R' U' F'" }],
      example: (s, stage, st) => stage === 'ycross',
    },
    {
      id: 'yedges',
      stage: 'yedges',
      title: 'Step 6 · Yellow edges',
      body: `
        <p><b>Goal:</b> each yellow edge's side color matches the center below it.</p>
        <ol>
          <li>Turn <span class="mv">U</span> until <b>two</b> edges match their centers.</li>
          <li>Hold the cube so those two are at the <b>back</b> and on the <b>right</b>, then do the algorithm. It swaps the front and left edges.</li>
          <li>If the two matching edges are <b>opposite</b> each other, do the algorithm once from anywhere, then start over.</li>
        </ol>`,
      algs: [{ name: 'Swap front & left edges', moves: "R U R' U R U2 R' U" }],
      example: (s, stage) => stage === 'yedges',
    },
    {
      id: 'ycorners',
      stage: 'ycorners',
      title: 'Step 7 · Position yellow corners',
      body: `
        <p><b>Goal:</b> every top corner in its correct spot — it doesn't need to be twisted correctly yet.</p>
        <p>A corner is "in its spot" when its three colors are the same three as the centers around it, in any order.</p>
        <ol>
          <li>Find a corner already in its spot. Hold it at the <b>front-right-top</b>.</li>
          <li>Do the algorithm. The other three corners rotate around. Repeat until all four are home.</li>
          <li>No corner in its spot? Do the algorithm once from anywhere first.</li>
        </ol>`,
      algs: [{ name: 'Cycle three corners', moves: "U R U' L' U R' U' L" }],
      example: (s, stage) => stage === 'ycorners',
    },
    {
      id: 'yorient',
      stage: 'yorient',
      title: 'Step 8 · Twist yellow corners',
      body: `
        <p><b>Goal:</b> the finish! Twist each corner so yellow is on top.</p>
        <ol>
          <li>Hold the cube with an unsolved corner at the <b>front-right-top</b>. <b>Don't rotate the whole cube again</b> until you're done.</li>
          <li>Repeat <span class="mv">R' D' R D</span> until that corner has yellow on top (2 or 4 times).</li>
          <li>Turn <b>only</b> <span class="mv">U</span> to bring the next unsolved corner to the front-right-top. Repeat.</li>
          <li>When all yellow is up, turn <span class="mv">U</span> to line up the top. Solved!</li>
        </ol>
        <p class="tip">The bottom layers will look destroyed halfway through. Trust the process — they come back by themselves.</p>`,
      algs: [{ name: 'Twist corner (repeat)', moves: "R' D' R D" }],
      example: (s, stage, st) => stage === 'yorient' && st.yellowCornersUp < 4,
    },
    {
      id: 'practice',
      title: 'Practice: full solve',
      body: `
        <p>Time to put it all together. Press <b>Scramble</b>, then solve step by step. Whenever you're unsure, ask the coach for the next step — it explains which piece to look at and why.</p>
        <p>Following along with a real cube? Hold it <b>yellow up, green facing you</b>, then type the same scramble into your cube and let the coach guide you one move at a time.</p>
        <p>The checklist on the left lights up as you finish each step.</p>`,
      practice: true,
    },
  ];
})(typeof globalThis !== 'undefined' ? globalThis : window);
