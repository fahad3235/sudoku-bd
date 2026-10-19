# Sudoku BD

Play, solve, and create Sudoku puzzles — fully offline, bilingual (English / Bangla).

## Features

- **Play** — freshly generated puzzles at 4 difficulties (Easy / Medium / Hard / Expert),
  each guaranteed to have exactly one solution.
- **Solver / creator** — "Enter your own puzzle": type any givens, then solve it or check
  whether it has exactly one solution.
- **Notes mode** — pencil marks (1–9) per cell, with sorting.
- **Undo** — up to 200 steps of history.
- **Hint** — fills one correct cell from the puzzle solution.
- **Check** — highlights every cell that breaks Sudoku rules.
- **Mistakes** — 3 wrong entries end the game (you can still reveal the solution).
- **Timer + stats** — per-game timer; games played / won / best time per difficulty,
  saved in `localStorage`.
- **Keyboard** — 1–9 enter, Backspace erase, arrows move, N notes, U undo, H hint.
- **Bilingual** — EN / Bangla toggle, persisted; Bangla digits in Bangla mode.

## How it works

- Board: flat array of 81 numbers, `0` = empty.
- Solver: backtracking with the MRV heuristic (pick the empty cell with the fewest
  candidates). `solve()` returns a solved copy or `null`.
- Generator: fill a complete board with randomised MRV backtracking, then remove cells
  in random order while the puzzle keeps exactly one solution (`countSolutions`
  capped at 2). Givens targets: Easy 45, Medium 38, Hard 32, Expert 27; the final
  count can sit a little above the target when uniqueness blocks further removal.
- Everything runs in the browser. Zero network requests.

## Stack

Vanilla HTML / CSS / JavaScript. No build step, no dependencies.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Testing

```sh
node tests/test-logic.mjs        # 15 unit checks (solver, generator, validation)
node tests/smoke.mjs             # 25 headless-Chrome checks (desktop)
node tests/smoke.mjs mobile      # 26 headless-Chrome checks (390px mobile)
```

Smoke tests use raw CDP against `/opt/meta-chromium/chrome` (no npm dependencies).

## Project structure

```
index.html          UI shell
css/style.css       Layout, board grid, responsive rules
js/logic.js         Pure Sudoku logic (solver, generator, validation)
js/i18n.js          EN / Bangla strings
js/app.js           DOM controller, game state, timer, stats
tests/test-logic.mjs  Node unit tests
tests/smoke.mjs       Headless-Chrome smoke tests
```

## Limitations

- Generated puzzles are random; difficulty is by givens count, not by human-rated
  solving techniques (no "hidden single / X-Wing" grading).
- Stats live in the browser's `localStorage` — clearing site data resets them.
- No multiplayer, no daily puzzle, no sharing links (single-player offline tool).

## Status

Complete MVP. Tests: 15/15 unit + 25/25 desktop smoke + 26/26 mobile smoke,
0 console / page errors.
