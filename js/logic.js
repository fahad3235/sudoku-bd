// sudoku-bd -- pure logic (no DOM). All functions are pure and unit-tested.
// Bengali strings live in i18n.js as \uXXXX escapes; this file stays pure ASCII.
// Board representation: flat array of 81 numbers, 0 = empty. Index = row*9 + col.

var DIFFICULTY = {
  easy: { givens: 45, key: "easy" },
  medium: { givens: 38, key: "medium" },
  hard: { givens: 32, key: "hard" },
  expert: { givens: 27, key: "expert" }
};

function emptyGrid() {
  var g = [];
  for (var i = 0; i < 81; i++) g.push(0);
  return g;
}

function cloneGrid(g) { return g.slice(); }

function rowOf(i) { return Math.floor(i / 9); }
function colOf(i) { return i % 9; }
function boxOf(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

function givensCount(g) {
  var n = 0;
  for (var i = 0; i < 81; i++) if (g[i] !== 0) n++;
  return n;
}

// Is placing value v at (r,c) legal against the rest of the board?
// The cell itself is ignored, so this works for both empty and filled cells.
function isValidPlacement(g, r, c, v) {
  if (v < 1 || v > 9) return false;
  for (var k = 0; k < 9; k++) {
    if (k !== c && g[r * 9 + k] === v) return false;
    if (k !== r && g[k * 9 + c] === v) return false;
  }
  var br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (var dr = 0; dr < 3; dr++) {
    for (var dc = 0; dc < 3; dc++) {
      var rr = br + dr, cc = bc + dc;
      if ((rr !== r || cc !== c) && g[rr * 9 + cc] === v) return false;
    }
  }
  return true;
}

// Whole-board validity: no duplicate non-zero in any row, column or box.
function gridValid(g) {
  for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
      var v = g[r * 9 + c];
      if (v !== 0 && !isValidPlacement(g, r, c, v)) return false;
    }
  }
  return true;
}

function candidates(g, r, c) {
  var out = [];
  if (g[r * 9 + c] !== 0) return out;
  for (var v = 1; v <= 9; v++) if (isValidPlacement(g, r, c, v)) out.push(v);
  return out;
}

// Pick the empty cell with the fewest candidates (MRV heuristic).
// Returns {index, cands} or null when the board is full.
function pickCellMRV(g) {
  var best = null;
  for (var i = 0; i < 81; i++) {
    if (g[i] !== 0) continue;
    var cands = candidates(g, rowOf(i), colOf(i));
    if (cands.length === 0) return { index: i, cands: cands };
    if (best === null || cands.length < best.cands.length) {
      best = { index: i, cands: cands };
      if (cands.length === 1) break;
    }
  }
  return best;
}

// Solve by backtracking with MRV. Returns a solved copy, or null if unsolvable.
function solve(g) {
  var work = cloneGrid(g);
  if (solveInto(work)) return work;
  return null;
}

function solveInto(g) {
  var pick = pickCellMRV(g);
  if (pick === null) return true; // full
  if (pick.cands.length === 0) return false;
  for (var i = 0; i < pick.cands.length; i++) {
    g[pick.index] = pick.cands[i];
    if (solveInto(g)) return true;
    g[pick.index] = 0;
  }
  return false;
}

// Count solutions up to `limit` (default 2). Stops early at the limit.
function countSolutions(g, limit) {
  if (limit == null) limit = 2;
  var count = 0;
  var work = cloneGrid(g);
  function rec() {
    if (count >= limit) return;
    var pick = pickCellMRV(work);
    if (pick === null) { count++; return; }
    if (pick.cands.length === 0) return;
    for (var i = 0; i < pick.cands.length; i++) {
      work[pick.index] = pick.cands[i];
      rec();
      work[pick.index] = 0;
      if (count >= limit) return;
    }
  }
  rec();
  return count;
}

function hasUniqueSolution(g) {
  return gridValid(g) && countSolutions(g, 2) === 1;
}

function isComplete(g) {
  return givensCount(g) === 81 && gridValid(g);
}

// Indices of cells that conflict with another cell (both sides flagged).
function cellErrors(g) {
  var bad = {};
  for (var i = 0; i < 81; i++) {
    var v = g[i];
    if (v === 0) continue;
    if (!isValidPlacement(g, rowOf(i), colOf(i), v)) bad[i] = true;
  }
  var out = [];
  for (var k in bad) out.push(parseInt(k, 10));
  out.sort(function (a, b) { return a - b; });
  return out;
}

// Deterministic seeded RNG (mulberry32) for tests / reproducible puzzles.
function seededRand(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Fill an empty board into a complete valid solution, randomised.
function generateFullSolution(rand) {
  var g = emptyGrid();
  function rec() {
    var pick = pickCellMRV(g);
    if (pick === null) return true;
    var order = shuffle(pick.cands, rand);
    for (var i = 0; i < order.length; i++) {
      g[pick.index] = order[i];
      if (rec()) return true;
      g[pick.index] = 0;
    }
    return false;
  }
  if (!rec()) return null;
  return g;
}

// Generate a puzzle with a unique solution for the given difficulty.
// Returns { puzzle, solution }. Givens land at or a little above the target
// when uniqueness blocks further removal.
function generatePuzzle(difficulty, rand) {
  if (!rand) rand = Math.random;
  var target = (DIFFICULTY[difficulty] || DIFFICULTY.medium).givens;
  var solution = generateFullSolution(rand);
  var puzzle = cloneGrid(solution);
  var order = shuffle([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80], rand);
  for (var i = 0; i < order.length; i++) {
    if (givensCount(puzzle) <= target) break;
    var idx = order[i];
    var saved = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[idx] = saved;
  }
  return { puzzle: puzzle, solution: solution };
}

function formatTime(totalSeconds) {
  var s = Math.max(0, Math.floor(totalSeconds));
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return (m < 10 ? "0" + m : "" + m) + ":" + (sec < 10 ? "0" + sec : "" + sec);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DIFFICULTY: DIFFICULTY, emptyGrid: emptyGrid, cloneGrid: cloneGrid,
    rowOf: rowOf, colOf: colOf, boxOf: boxOf, givensCount: givensCount,
    isValidPlacement: isValidPlacement, gridValid: gridValid,
    candidates: candidates, solve: solve, countSolutions: countSolutions,
    hasUniqueSolution: hasUniqueSolution, isComplete: isComplete,
    cellErrors: cellErrors, seededRand: seededRand, shuffle: shuffle,
    generateFullSolution: generateFullSolution, generatePuzzle: generatePuzzle,
    formatTime: formatTime
  };
}
