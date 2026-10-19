// Headless-Chrome smoke test via raw CDP (no deps). Run: node tests/smoke.mjs [mobile]
// Uses /opt/meta-chromium/chrome + built-in WebSocket. Pure ASCII source.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = "file://" + path.join(DIR, "..", "index.html");
const PORT = 9224 + Math.floor(Math.random() * 500);
const MOBILE = process.argv[2] === "mobile";
const chrome = spawn("/opt/meta-chromium/chrome", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=" + PORT, "--remote-debugging-address=127.0.0.1",
  "about:blank",
], { stdio: "ignore" });

let checks = 0, failures = [];
function check(name, cond, extra) {
  checks++;
  if (cond) console.log("ok - " + name);
  else { failures.push(name); console.log("FAIL - " + name + (extra ? " :: " + extra : "")); }
}

async function waitForWs() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/list");
      if (r.ok) {
        const targets = await r.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("chrome did not start");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const pending = new Map();
let ws;
const consoleErrors = [];
const pageErrors = [];
let loadResolve; const loaded = new Promise((r) => (loadResolve = r));

function send(method, params) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evaluate(expr) {
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (res.result && res.result.exceptionDetails) {
    pageErrors.push(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
    return undefined;
  }
  return res.result && res.result.result ? res.result.result.value : undefined;
}

// Click cell idx then numpad digit d, via DOM clicks (exercises real handlers).
async function enterDigit(idx, d) {
  await evaluate("document.querySelector('.cell[data-idx=\"" + idx + "\"]').click();");
  await evaluate("document.querySelector('.numpad button[data-num=\"" + d + "\"]').click();");
  await sleep(30);
}
async function boardValues() {
  return await evaluate("[...document.querySelectorAll('.cell')].map(function (c) { var v = c.querySelector('.val'); return v ? v.textContent.trim() : ''; }).join('')");
}

try {
  const url = await waitForWs();
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Page.loadEventFired") loadResolve();
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      consoleErrors.push(JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === "Runtime.exceptionThrown")
      pageErrors.push((m.params.exceptionDetails.exception?.description || "exception").slice(0, 300));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      consoleErrors.push(m.params.entry.text.slice(0, 300));
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  if (MOBILE) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: PAGE });
  await loaded;
  await sleep(800);

  check("title", (await evaluate("document.title"))?.includes("Sudoku BD"));
  check("81 cells", (await evaluate("document.querySelectorAll('.cell').length")) === 81);
  check("generated givens present", (await evaluate("document.querySelectorAll('.cell.given').length")) >= 24, "givens=" + (await evaluate("document.querySelectorAll('.cell.given').length")));
  check("numpad 9 buttons", (await evaluate("document.querySelectorAll('.numpad button').length")) === 9);
  check("timer renders", (await evaluate("document.getElementById('timerVal').textContent"))?.includes(":"));

  // Notes mode: enter a note, then undo removes it
  await evaluate("document.querySelector('.cell[data-idx=\"0\"]').click();");
  const emptyIdx = await evaluate("[...document.querySelectorAll('.cell')].findIndex(function (c) { return !c.querySelector('.val'); })");
  check("found empty cell", emptyIdx >= 0);
  await evaluate("document.getElementById('notesBtn').click();");
  await sleep(100);
  check("notes mode active", (await evaluate("document.getElementById('notesBtn').className"))?.includes("active"));
  await enterDigit(emptyIdx, 3);
  check("note recorded", (await evaluate("document.querySelector('.cell[data-idx=\"" + emptyIdx + "\"] .notes').textContent"))?.includes("3"));
  await evaluate("document.getElementById('undoBtn').click();");
  await sleep(100);
  check("undo clears note", (await evaluate("document.querySelector('.cell[data-idx=\"" + emptyIdx + "\"] .notes')")) === null);
  await evaluate("document.getElementById('notesBtn').click();");

  // Wrong entry increments mistakes (enter 1 into empty cell, then fix by entering
  // the digit again is a no-op; instead check mistakes rose by at most 1 and board
  // shows the digit). We cannot know the solution, so just verify a digit lands.
  await enterDigit(emptyIdx, 5);
  check("digit lands in cell", (await evaluate("document.querySelector('.cell[data-idx=\"" + emptyIdx + "\"] .val').textContent")) === "5");
  const mistakes = await evaluate("document.getElementById('mistakesVal').textContent");
  check("mistakes counter sane", mistakes === "0 / 3" || mistakes === "1 / 3", "mistakes=" + mistakes);
  await evaluate("document.getElementById('eraseBtn').click();");
  await sleep(100);
  check("erase clears cell", (await evaluate("document.querySelector('.cell[data-idx=\"" + emptyIdx + "\"] .val')")) === null);

  // Hint fills one empty cell
  const beforeHint = await boardValues();
  await evaluate("document.getElementById('hintBtn').click();");
  await sleep(150);
  const afterHint = await boardValues();
  check("hint fills a cell", afterHint.length > beforeHint.length, beforeHint.length + " -> " + afterHint.length);

  // Check button runs without error
  await evaluate("document.getElementById('checkBtn').click();");
  await sleep(100);
  check("check shows message", (await evaluate("document.getElementById('message').textContent")).length > 0);

  // Custom mode: enter the known puzzle and solve it end-to-end
  await evaluate("document.getElementById('enterOwnBtn').click();");
  await sleep(150);
  check("custom mode shows solve-own", (await evaluate("document.getElementById('solveOwnBtn').offsetParent")) !== null);
  const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  for (let i = 0; i < 81; i++) {
    const d = PUZZLE[i];
    if (d !== "0") await enterDigit(i, parseInt(d, 10));
  }
  await evaluate("document.getElementById('checkUniqueBtn').click();");
  await sleep(200);
  check("custom puzzle unique", (await evaluate("document.getElementById('message').textContent"))?.includes("exactly one solution"));
  await evaluate("document.getElementById('solveOwnBtn').click();");
  await sleep(300);
  check("custom solve fills board", (await boardValues()) === "534678912672195348198342567859761423426853791713924856961537284287419635345286179", await boardValues());
  check("custom solve message", (await evaluate("document.getElementById('message').textContent"))?.includes("Solved"));

  // Back to game + new game regenerates
  await evaluate("document.getElementById('backBtn').click();");
  await sleep(400);
  check("back to game shows play bar", (await evaluate("document.getElementById('playBar').offsetParent")) !== null);
  check("new game board has givens", (await evaluate("document.querySelectorAll('.cell.given').length")) >= 24);

  // BN toggle
  await evaluate("document.getElementById('langBtn').click();");
  await sleep(200);
  check("BN toggle title", (await evaluate("document.querySelector('h1').textContent")) === "\u09b8\u09c1\u09a1\u09cb\u0995\u09c1 \u09ac\u09bf\u09a1\u09bf");
  check("BN toggle persists", (await evaluate("localStorage.getItem('sudoku-bd-lang')")) === "bn");
  await evaluate("document.getElementById('langBtn').click();");
  await sleep(150);
  check("EN toggle back", (await evaluate("document.querySelector('h1').textContent")) === "Sudoku BD");

  if (MOBILE) {
    check("390px no horizontal overflow", (await evaluate("document.documentElement.scrollWidth")) <= 390, "scrollWidth=" + (await evaluate("document.documentElement.scrollWidth")));
  }

  check("zero console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("zero page exceptions", pageErrors.length === 0, pageErrors.join(" | "));
} catch (e) {
  failures.push("harness: " + e.message);
  console.log("FAIL - harness: " + e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill();
}

console.log("\n" + (checks - failures.length) + "/" + checks + " smoke checks passed" + (MOBILE ? " (mobile)" : " (desktop)"));
if (failures.length) { console.log("FAILURES: " + failures.join(", ")); process.exit(1); }
