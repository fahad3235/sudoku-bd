// Unit tests for js/logic.js -- run: node tests/test-logic.mjs
import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../js/logic.js");

let n = 0;
function ok(name, fn) { fn(); n++; console.log("ok - " + name); }

const PUZZLE =
  "530070000" + "600195000" + "098000060" + "800060003" + "400803001" +
  "700020006" + "060000280" + "000419005" + "000080079";
const SOLUTION =
  "534678912" + "672195348" + "198342567" + "859761423" + "426853791" +
  "713924856" + "961537284" + "287419635" + "345286179";
const toGrid = (s) => s.split("").map((c) => parseInt(c, 10));
const toStr = (g) => g.join("");

ok("empty grid has 81 zeros", () => {
  assert.equal(L.emptyGrid().length, 81);
  assert.equal(L.givensCount(L.emptyGrid()), 0);
});

ok("isValidPlacement row/col/box", () => {
  const g = toGrid(PUZZLE);
  assert.equal(L.isValidPlacement(g, 0, 2, 4), true); // solution value
  assert.equal(L.isValidPlacement(g, 0, 2, 5), false); // 5 in row
  assert.equal(L.isValidPlacement(g, 0, 2, 3), false); // 3 in col
  assert.equal(L.isValidPlacement(g, 0, 2, 8), false); // 8 in box
  assert.equal(L.isValidPlacement(g, 0, 2, 0), false);
  assert.equal(L.isValidPlacement(g, 0, 2, 10), false);
});

ok("gridValid accepts puzzle, rejects duplicate", () => {
  const g = toGrid(PUZZLE);
  assert.equal(L.gridValid(g), true);
  const bad = g.slice(); bad[1] = 5; // duplicate 5 in row 0
  assert.equal(L.gridValid(bad), false);
});

ok("solve finds the known solution", () => {
  const solved = L.solve(toGrid(PUZZLE));
  assert.notEqual(solved, null);
  assert.equal(toStr(solved), SOLUTION);
});

ok("solve returns null for unsolvable board", () => {
  // Row 0 holds 1..8 in cols 0..7 and (1,8) = 9, so (0,8) has no candidate.
  const dead2 = L.emptyGrid();
  for (let c = 0; c < 8; c++) dead2[c] = c + 1;
  dead2[17] = 9;
  assert.equal(L.solve(dead2), null);
});

ok("countSolutions: unique puzzle = 1, empty board >= 2", () => {
  assert.equal(L.countSolutions(toGrid(PUZZLE), 2), 1);
  assert.equal(L.countSolutions(L.emptyGrid(), 2), 2);
});

ok("hasUniqueSolution true/false", () => {
  assert.equal(L.hasUniqueSolution(toGrid(PUZZLE)), true);
  const multi = L.emptyGrid(); multi[0] = 5;
  assert.equal(L.hasUniqueSolution(multi), false);
});

ok("isComplete: solution true, puzzle false, wrong full board false", () => {
  assert.equal(L.isComplete(toGrid(SOLUTION)), true);
  assert.equal(L.isComplete(toGrid(PUZZLE)), false);
  const wrong = toGrid(SOLUTION); wrong[0] = 1;
  assert.equal(L.isComplete(wrong), false);
});

ok("cellErrors flags both conflicting cells", () => {
  const g = toGrid(SOLUTION); g[1] = 5; // duplicates (0,0)=5 in row AND (3,1)=5 in column
  const errs = L.cellErrors(g);
  assert.deepEqual(errs, [0, 1, 28]);
  assert.deepEqual(L.cellErrors(toGrid(SOLUTION)), []);
});

ok("candidates for (0,2) in known puzzle", () => {
  const c = L.candidates(toGrid(PUZZLE), 0, 2);
  assert.deepEqual(c, [1, 2, 4]);
});

ok("seededRand is deterministic", () => {
  const a = L.seededRand(42), b = L.seededRand(42);
  assert.equal(a(), b());
  assert.notEqual(a(), L.seededRand(43)());
});

ok("generateFullSolution is a valid complete board", () => {
  const sol = L.generateFullSolution(L.seededRand(7));
  assert.equal(L.isComplete(sol), true);
  assert.equal(L.givensCount(sol), 81);
});

ok("generatePuzzle easy: unique solution, givens near target", () => {
  const { puzzle, solution } = L.generatePuzzle("easy", L.seededRand(11));
  assert.equal(L.hasUniqueSolution(puzzle), true);
  const giv = L.givensCount(puzzle);
  assert.ok(giv >= 45 && giv <= 57, "givens=" + giv);
  assert.equal(toStr(L.solve(puzzle)), toStr(solution));
  assert.equal(L.isComplete(solution), true);
});

ok("generatePuzzle expert: unique solution, givens near target", () => {
  const { puzzle, solution } = L.generatePuzzle("expert", L.seededRand(23));
  assert.equal(L.hasUniqueSolution(puzzle), true);
  const giv = L.givensCount(puzzle);
  assert.ok(giv >= 27 && giv <= 39, "givens=" + giv);
  assert.equal(toStr(L.solve(puzzle)), toStr(solution));
});

ok("formatTime", () => {
  assert.equal(L.formatTime(0), "00:00");
  assert.equal(L.formatTime(65), "01:05");
  assert.equal(L.formatTime(600), "10:00");
  assert.equal(L.formatTime(-5), "00:00");
});

console.log("\n" + n + "/" + n + " unit checks passed");
