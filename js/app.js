// sudoku-bd -- app controller (DOM). Logic lives in js/logic.js, strings in js/i18n.js.
(function () {
  "use strict";

  var LS_LANG = "sudoku-bd-lang";
  var LS_STATS = "sudoku-bd-stats";

  var state = {
    lang: "en",
    mode: "play", // "play" | "custom"
    difficulty: "medium",
    puzzle: emptyGrid(),
    solution: null,
    board: emptyGrid(),
    notes: [],
    given: [],
    selected: 0,
    notesMode: false,
    mistakes: 0,
    seconds: 0,
    status: "playing", // "playing" | "won" | "lost" | "revealed"
    history: [],
    timerId: null,
    checkFlash: null
  };
  for (var n = 0; n < 81; n++) { state.notes.push([]); state.given.push(false); }

  function $(id) { return document.getElementById(id); }

  function t(key) {
    var dict = I18N[state.lang] || I18N.en;
    return dict[key] || I18N.en[key] || key;
  }

  function num(v) {
    return state.lang === "bn" ? bnDigits(v) : String(v);
  }

  function loadLang() {
    try {
      var l = localStorage.getItem(LS_LANG);
      if (l === "bn" || l === "en") state.lang = l;
    } catch (e) {}
  }

  function loadStats() {
    try {
      var raw = localStorage.getItem(LS_STATS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, won: 0, best: { easy: null, medium: null, hard: null, expert: null } };
  }

  function saveStats(s) {
    try { localStorage.setItem(LS_STATS, JSON.stringify(s)); } catch (e) {}
  }

  function setLang(l) {
    state.lang = l;
    try { localStorage.setItem(LS_LANG, l); } catch (e) {}
    applyLang();
    renderAll();
  }

  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    var btn = $("langBtn");
    if (btn) btn.textContent = state.lang === "en" ? "\u09ac\u09be\u0982\u09b2\u09be" : "English";
    document.documentElement.lang = state.lang === "bn" ? "bn" : "en";
  }

  function showMessage(msg) {
    var el = $("message");
    if (el) el.textContent = msg || "";
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(function () {
      if (state.status === "playing" && state.mode === "play") {
        state.seconds++;
        renderMeta();
      }
    }, 1000);
  }

  function pushHistory() {
    state.history.push({ board: state.board.slice(), notes: state.notes.map(function (a) { return a.slice(); }) });
    if (state.history.length > 200) state.history.shift();
  }

  function newGame(difficulty) {
    state.difficulty = difficulty || state.difficulty;
    var gen = generatePuzzle(state.difficulty, Math.random);
    state.mode = "play";
    state.puzzle = gen.puzzle.slice();
    state.solution = gen.solution.slice();
    state.board = gen.puzzle.slice();
    state.notes = [];
    state.given = [];
    for (var i = 0; i < 81; i++) { state.notes.push([]); state.given.push(gen.puzzle[i] !== 0); }
    state.selected = 0;
    state.notesMode = false;
    state.mistakes = 0;
    state.seconds = 0;
    state.status = "playing";
    state.history = [];
    var stats = loadStats();
    stats.played++;
    saveStats(stats);
    showMessage("");
    updateModeUI();
    renderAll();
    startTimer();
  }

  function enterCustom() {
    state.mode = "custom";
    state.board = emptyGrid();
    state.notes = [];
    state.given = [];
    for (var i = 0; i < 81; i++) { state.notes.push([]); state.given.push(false); }
    state.solution = null;
    state.selected = 0;
    state.mistakes = 0;
    state.seconds = 0;
    state.status = "playing";
    state.history = [];
    stopTimer();
    showMessage("");
    updateModeUI();
    renderAll();
  }

  function backToGame() {
    newGame(state.difficulty);
  }

  function updateModeUI() {
    var custom = state.mode === "custom";
    $("customBar").style.display = custom ? "flex" : "none";
    $("playBar").style.display = custom ? "none" : "flex";
    $("enterOwnBtn").style.display = custom ? "none" : "";
    $("backBtn").style.display = custom ? "" : "none";
    $("mistakesWrap").style.display = custom ? "none" : "";
    $("solveBtn").style.display = custom ? "none" : "";
    $("hintBtn").style.display = custom ? "none" : "";
    $("checkBtn").style.display = custom ? "none" : "";
  }

  function cellPeers(idx) {
    var r = rowOf(idx), c = colOf(idx), out = [];
    for (var i = 0; i < 81; i++) {
      if (i === idx) continue;
      if (rowOf(i) === r || colOf(i) === c || boxOf(rowOf(i), colOf(i)) === boxOf(r, c)) out.push(i);
    }
    return out;
  }

  function renderBoard() {
    var boardEl = $("board");
    if (!boardEl) return;
    var sel = state.selected;
    var selVal = state.board[sel];
    var peers = {};
    cellPeers(sel).forEach(function (i) { peers[i] = true; });
    var errors = {};
    if (state.checkFlash) cellErrors(state.board).forEach(function (i) { errors[i] = true; });
    var html = "";
    for (var i = 0; i < 81; i++) {
      var classes = ["cell"];
      if (rowOf(i) % 3 === 0) classes.push("top-thick");
      if (colOf(i) % 3 === 0) classes.push("left-thick");
      if (rowOf(i) === 8) classes.push("bottom-thick");
      if (colOf(i) === 8) classes.push("right-thick");
      if (i === sel) classes.push("selected");
      else if (peers[i]) classes.push("peer");
      if (state.given[i]) classes.push("given");
      if (errors[i]) classes.push("error");
      if (selVal !== 0 && state.board[i] === selVal) classes.push("same-num");
      var inner;
      if (state.board[i] !== 0) {
        inner = "<span class=\"val\">" + num(state.board[i]) + "</span>";
      } else if (state.notes[i].length) {
        var cells = "";
        for (var d = 1; d <= 9; d++) {
          cells += "<span>" + (state.notes[i].indexOf(d) >= 0 ? num(d) : "") + "</span>";
        }
        inner = "<span class=\"notes\">" + cells + "</span>";
      } else {
        inner = "";
      }
      html += "<button type=\"button\" class=\"" + classes.join(" ") + "\" data-idx=\"" + i + "\" aria-label=\"cell " + (rowOf(i) + 1) + "," + (colOf(i) + 1) + "\">" + inner + "</button>";
    }
    boardEl.innerHTML = html;
    boardEl.querySelectorAll(".cell").forEach(function (el) {
      el.addEventListener("click", function () {
        state.selected = parseInt(el.getAttribute("data-idx"), 10);
        renderBoard();
      });
    });
  }

  function renderMeta() {
    $("timerVal").textContent = state.lang === "bn" ? bnDigits(formatTime(state.seconds)) : formatTime(state.seconds);
    $("mistakesVal").textContent = num(state.mistakes) + " / " + num(3);
    $("givensVal").textContent = num(givensCount(state.board)) + " " + t("givens");
    var stats = loadStats();
    $("statPlayed").textContent = num(stats.played);
    $("statWon").textContent = num(stats.won);
    var best = stats.best[state.difficulty];
    $("statBest").textContent = best == null ? "-" : (state.lang === "bn" ? bnDigits(formatTime(best)) : formatTime(best));
    $("notesBtn").classList.toggle("active", state.notesMode);
    $("notesBtn").setAttribute("aria-pressed", state.notesMode ? "true" : "false");
  }

  function renderAll() {
    renderBoard();
    renderMeta();
  }

  function winGame() {
    state.status = "won";
    stopTimer();
    var stats = loadStats();
    stats.won++;
    var best = stats.best[state.difficulty];
    if (best == null || state.seconds < best) stats.best[state.difficulty] = state.seconds;
    saveStats(stats);
    showMessage(t("win"));
    renderAll();
  }

  function loseGame() {
    state.status = "lost";
    stopTimer();
    showMessage(t("gameOver"));
    renderAll();
  }

  function inputDigit(d) {
    var idx = state.selected;
    if (state.status === "won" || state.status === "lost" || state.status === "revealed") return;
    if (state.mode === "custom") {
      if (state.board[idx] === d) { pushHistory(); state.board[idx] = 0; }
      else { pushHistory(); state.board[idx] = d; state.notes[idx] = []; }
      showMessage("");
      renderAll();
      return;
    }
    if (state.given[idx]) return;
    if (state.notesMode) {
      pushHistory();
      var pos = state.notes[idx].indexOf(d);
      if (pos >= 0) state.notes[idx].splice(pos, 1);
      else { state.notes[idx].push(d); state.notes[idx].sort(function (a, b) { return a - b; }); }
      renderAll();
      return;
    }
    if (state.board[idx] === d) return;
    pushHistory();
    state.board[idx] = d;
    state.notes[idx] = [];
    if (state.solution && d !== state.solution[idx]) {
      state.mistakes++;
      if (state.mistakes >= 3) { renderAll(); loseGame(); return; }
    }
    if (isComplete(state.board)) { renderAll(); winGame(); return; }
    renderAll();
  }

  function eraseCell() {
    var idx = state.selected;
    if (state.status === "won" || state.status === "lost" || state.status === "revealed") return;
    if (state.mode === "play" && state.given[idx]) return;
    if (state.board[idx] === 0 && state.notes[idx].length === 0) return;
    pushHistory();
    state.board[idx] = 0;
    state.notes[idx] = [];
    renderAll();
  }

  function undo() {
    var prev = state.history.pop();
    if (!prev) return;
    state.board = prev.board;
    state.notes = prev.notes;
    showMessage("");
    renderAll();
  }

  function hint() {
    if (state.mode !== "play" || !state.solution) return;
    if (state.status !== "playing") return;
    for (var i = 0; i < 81; i++) {
      if (state.board[i] === 0) {
        pushHistory();
        state.board[i] = state.solution[i];
        state.notes[i] = [];
        state.selected = i;
        showMessage(t("hintUsed"));
        if (isComplete(state.board)) { renderAll(); winGame(); return; }
        renderAll();
        return;
      }
    }
    showMessage(t("noHint"));
  }

  function checkBoard() {
    if (state.mode !== "play") return;
    var errs = cellErrors(state.board);
    state.checkFlash = true;
    if (errs.length === 0) showMessage(t("checkOk"));
    else showMessage(t("checkBad"));
    renderAll();
    setTimeout(function () { state.checkFlash = false; renderBoard(); }, 2000);
  }

  function solveBoard() {
    if (state.mode !== "play" || !state.solution) return;
    state.board = state.solution.slice();
    state.notes = [];
    for (var i = 0; i < 81; i++) state.notes.push([]);
    state.status = "revealed";
    stopTimer();
    showMessage(t("reveal"));
    renderAll();
  }

  function solveCustom() {
    if (givensCount(state.board) === 0) { showMessage(t("emptyBoard")); return; }
    if (!gridValid(state.board)) { showMessage(t("invalidBoard")); return; }
    var solved = solve(state.board);
    if (!solved) { showMessage(t("unsolvable")); return; }
    if (countSolutions(state.board, 2) !== 1) { showMessage(t("uniqueNo")); return; }
    state.board = solved;
    state.notes = [];
    for (var i = 0; i < 81; i++) state.notes.push([]);
    showMessage(t("solvedIt") + " " + t("uniqueYes"));
    renderAll();
  }

  function checkCustomUnique() {
    if (givensCount(state.board) === 0) { showMessage(t("emptyBoard")); return; }
    if (!gridValid(state.board)) { showMessage(t("invalidBoard")); return; }
    var n = countSolutions(state.board, 2);
    if (n === 0) showMessage(t("unsolvable"));
    else if (n === 1) showMessage(t("uniqueYes"));
    else showMessage(t("uniqueNo"));
  }

  function bind() {
    $("langBtn").addEventListener("click", function () {
      setLang(state.lang === "en" ? "bn" : "en");
    });
    $("newGameBtn").addEventListener("click", function () {
      newGame($("difficultySelect").value);
    });
    $("difficultySelect").addEventListener("change", function () {
      state.difficulty = $("difficultySelect").value;
      renderMeta();
    });
    $("enterOwnBtn").addEventListener("click", enterCustom);
    $("backBtn").addEventListener("click", backToGame);
    $("clearBoardBtn").addEventListener("click", function () {
      pushHistory();
      state.board = emptyGrid();
      state.notes = [];
      for (var i = 0; i < 81; i++) state.notes.push([]);
      showMessage("");
      renderAll();
    });
    $("solveOwnBtn").addEventListener("click", solveCustom);
    $("checkUniqueBtn").addEventListener("click", checkCustomUnique);
    $("notesBtn").addEventListener("click", function () {
      state.notesMode = !state.notesMode;
      renderMeta();
    });
    $("undoBtn").addEventListener("click", undo);
    $("hintBtn").addEventListener("click", hint);
    $("checkBtn").addEventListener("click", checkBoard);
    $("solveBtn").addEventListener("click", solveBoard);
    $("eraseBtn").addEventListener("click", eraseCell);
    document.querySelectorAll(".numpad button[data-num]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        inputDigit(parseInt(btn.getAttribute("data-num"), 10));
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key >= "1" && e.key <= "9") inputDigit(parseInt(e.key, 10));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); eraseCell(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); state.selected = state.selected % 9 === 0 ? state.selected + 8 : state.selected - 1; renderBoard(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); state.selected = state.selected % 9 === 8 ? state.selected - 8 : state.selected + 1; renderBoard(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); state.selected = (state.selected + 72) % 81; renderBoard(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); state.selected = (state.selected + 9) % 81; renderBoard(); }
      else if (e.key === "n" || e.key === "N") { state.notesMode = !state.notesMode; renderMeta(); }
      else if (e.key === "u" || e.key === "U") undo();
      else if (e.key === "h" || e.key === "H") hint();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadLang();
    applyLang();
    bind();
    newGame("medium");
  });
})();
