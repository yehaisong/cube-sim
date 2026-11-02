# Cube Coach

A browser app that teaches you to solve a Rubik's Cube. Pick a method from the header:

- **Beginner** (layer by layer) — the full guided course
- **CFOP** (Fridrich) with 4-look last layer
- **Roux** (blocks + last six edges with M turns)
- **ZZ** (edge orientation first, then L/U/R only)
- **Petrus** (2×2×2 → 2×2×3 → edges → F2L)
- **Corners first** (corners, then edges with slice commutators)
- **Blindfolded** (Old Pochmann)

- 3D cube you can turn with buttons or the keyboard, and drag to look around
- 11 lessons: the pieces, move notation, then the 8 steps of the method
- A coach that looks at *your* cube, works out which step you're on, and shows the next moves with an explanation (play them all, or one move at a time)
- "Load an example" builds a practice position for whichever step you're learning

The **Cube** menu switches between standard colors and two picture cubes, **LJC Global cube** and **LJC A.S.K. cube** (same faces, A.S.K. picture on the white side). Each shows one picture per face (from `assets/ljc/`) cut into 9 tiles. Tiles turn with the pieces, just like a real picture cube.

## Run it

No build step or dependencies. Serve the folder and open it:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Files

- `js/cube.js` – cube model (facelets, moves, piece inspection)
- `js/coach.js` – detects the current step and finds the next beginner-method moves
- `js/lessons.js` – beginner lesson text and algorithms
- `js/engine.js` – shared step solver for the other methods (pattern-database IDA*, last-layer algorithm search, commutators, Old Pochmann)
- `js/methods.js` – CFOP, Roux, ZZ, Petrus, Corners-first and Blindfolded: steps and lessons
- `js/skins.js` – cube styles; works out which picture tile sits on each sticker and how it is turned
- `js/app.js` – 3D rendering (CSS transforms), controls, lesson UI
- `test/coach.test.js` – checks the beginner coach solves random scrambles: `node test/coach.test.js 300`
- `test/methods.test.js` – same for every other method: `node test/methods.test.js 25` (or `node test/methods.test.js 25 roux`)
