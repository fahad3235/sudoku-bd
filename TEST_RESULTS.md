# TEST_RESULTS.md — sudoku-bd (2026-10-19, 12:00 slot)

## Unit tests — 15/15 passed (`node tests/test-logic.mjs`)

- empty grid 81 zeros; isValidPlacement row/col/box; gridValid accept/reject
- solve finds the known solution for the classic puzzle
  (530070000… → 534678912… verified digit-for-digit)
- solve returns null for a board with a dead cell (row 0 = 1..8, (1,8) = 9)
- countSolutions: known puzzle = 1, empty board capped at 2
- hasUniqueSolution true/false; isComplete true/false/wrong-full-board
- cellErrors flags all three conflicting cells ([0, 1, 28]) — the duplicate 5 at
  (0,1) conflicts with (0,0) in its row AND (3,1) in its column
- candidates for (0,2) = [1, 2, 4]; seededRand deterministic
- generateFullSolution is a valid complete board
- generatePuzzle easy (seed 11): unique solution, givens in [45, 57],
  solver output equals generated solution
- generatePuzzle expert (seed 23): unique solution, givens in [27, 39],
  solver output equals generated solution
- formatTime: 0 → 00:00, 65 → 01:05, 600 → 10:00, negative → 00:00

## Smoke tests — 25/25 desktop + 26/26 mobile passed (`node tests/smoke.mjs [mobile]`)

Raw CDP, /opt/meta-chromium/chrome, file:// page, 0 console/page errors.
Covered: title, 81 cells, generated givens ≥ 24, numpad, timer, notes mode +
note recorded + undo clears note, digit entry, mistakes counter, erase, hint
fills a cell, check message, custom mode (enter known 81-digit puzzle via real
DOM clicks → uniqueness check "exactly one solution" → solve fills the exact
known solution → "Solved" message), back-to-game regeneration, BN toggle
(title + localStorage persistence) + EN toggle back, 390px no-overflow (mobile).

## Repairs

- 1 test-side fix: cellErrors expectation corrected from [0, 1] to [0, 1, 28]
  (the test's duplicate genuinely conflicts in two directions; app was right).
- 0 app-logic bugs.

## Hygiene

- Pure-ASCII sources: Bengali in JS as \uXXXX escapes, in HTML as numeric
  entities (`grep -P '[^\x00-\x7F]'` zero matches across .js/.html/.css/.mjs).
- Zero network requests by design (no fetch/XHR in the app).
