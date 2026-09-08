(() => {
  "use strict";

  const PRESETS = {
    beginner: { rows: 9, cols: 9, mines: 10, label: "9×9 — 10 мин" },
    intermediate: { rows: 16, cols: 16, mines: 40, label: "16×16 — 40 мин" },
    expert: { rows: 16, cols: 30, mines: 99, label: "30×16 — 99 мин" },
  };

  const SCORES_KEY = "sapper.scores.v1";
  const NAME_KEY = "sapper.name.v1";
  const MARKS_KEY = "sapper.marks.v1";
  const DIFF_KEY = "sapper.diff.v1";

  const FLAG_SVG = `<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12" stroke="#111" stroke-width="1.6" fill="none"/><path d="M5 3h8l-2.4 3L13 9H5z" fill="#e11"/></svg>`;
  const MINE_SVG = `<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="#111"/><g stroke="#111" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="1.5" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="14.5" y2="8"/><line x1="3.2" y1="3.2" x2="5" y2="5"/><line x1="11" y1="11" x2="12.8" y2="12.8"/><line x1="12.8" y1="3.2" x2="11" y2="5"/><line x1="5" y1="11" x2="3.2" y2="12.8"/></g><circle cx="6.7" cy="6.5" r="1" fill="#fff"/></svg>`;
  const CROSS_SVG = `<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><line x1="3" y1="3" x2="13" y2="13" stroke="#c00" stroke-width="2"/><line x1="13" y1="3" x2="3" y2="13" stroke="#c00" stroke-width="2"/></svg>`;
  const Q_SVG = `<span style="color:#000;font-weight:700">?</span>`;

  const els = {
    board: document.getElementById("board"),
    mineCounter: document.getElementById("mineCounter"),
    timer: document.getElementById("timer"),
    smiley: document.getElementById("smiley"),
    flagBtn: document.getElementById("flagBtn"),
    diffLabel: document.getElementById("diffLabel"),
    leaderboard: document.getElementById("leaderboard"),
    lbStatus: document.getElementById("lbStatus"),
    lbTabs: document.getElementById("lbTabs"),
    nameModal: document.getElementById("nameModal"),
    nameForm: document.getElementById("nameForm"),
    nameInput: document.getElementById("nameInput"),
    helpModal: document.getElementById("helpModal"),
    aboutModal: document.getElementById("aboutModal"),
    resultModal: document.getElementById("resultModal"),
    resultTitle: document.getElementById("resultTitle"),
    resultHeading: document.getElementById("resultHeading"),
    statScore: document.getElementById("statScore"),
    statTime: document.getElementById("statTime"),
    statCleared: document.getElementById("statCleared"),
    statPlayer: document.getElementById("statPlayer"),
    playAgain: document.getElementById("playAgain"),
    saveImage: document.getElementById("saveImage"),
    gameMenu: document.getElementById("gameMenu"),
    helpMenu: document.getElementById("helpMenu"),
    gameMenuBtn: document.getElementById("gameMenuBtn"),
    helpMenuBtn: document.getElementById("helpMenuBtn"),
    marksState: document.getElementById("marksState"),
  };

  const game = {
    diff: "intermediate",
    rows: 16,
    cols: 16,
    mines: 40,
    cells: [],
    started: false,
    over: false,
    won: false,
    flags: 0,
    opened: 0,
    time: 0,
    timerId: null,
    flagMode: false,
    marks: false,
    player: "",
    lastResult: null,
    pressTimer: null,
    suppressClick: false,
    apiBase: null,
    apiOnline: false,
  };

  function pad3(n) {
    const v = Math.max(-99, Math.min(999, n | 0));
    if (v < 0) return "-" + String(Math.abs(v)).padStart(2, "0");
    return String(v).padStart(3, "0");
  }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < game.rows && cc >= 0 && cc < game.cols) out.push([rr, cc]);
      }
    }
    return out;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setDiff(key) {
    const preset = PRESETS[key] || PRESETS.intermediate;
    game.diff = PRESETS[key] ? key : "intermediate";
    game.rows = preset.rows;
    game.cols = preset.cols;
    game.mines = preset.mines;
    els.diffLabel.textContent = preset.label;
    localStorage.setItem(DIFF_KEY, game.diff);
    const max = Math.max(preset.rows, preset.cols);
    const px = max >= 30 ? 18 : max >= 16 ? 26 : 32;
    document.documentElement.style.setProperty("--cell", `${px}px`);
    if (window.matchMedia("(max-width: 480px)").matches) {
      document.documentElement.style.setProperty("--cell", max >= 30 ? 12 : max >= 16 ? 18 : 28 + "px");
    } else if (window.matchMedia("(max-width: 820px)").matches) {
      document.documentElement.style.setProperty("--cell", max >= 30 ? 14 : max >= 16 ? 22 : 28 + "px");
    }
  }

  function newBoard() {
    stopTimer();
    game.started = false;
    game.over = false;
    game.won = false;
    game.flags = 0;
    game.opened = 0;
    game.time = 0;
    game.cells = [];
    for (let r = 0; r < game.rows; r++) {
      const row = [];
      for (let c = 0; c < game.cols; c++) {
        row.push({ mine: false, adj: 0, open: false, flag: 0, exploded: false });
      }
      game.cells.push(row);
    }
    els.smiley.textContent = "🙂";
    els.timer.textContent = "000";
    updateMineCounter();
    renderBoard();
  }

  function placeMines(safeR, safeC) {
    const pool = [];
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        pool.push([r, c]);
      }
    }
    shuffle(pool);
    const n = Math.min(game.mines, pool.length);
    for (let i = 0; i < n; i++) {
      const [r, c] = pool[i];
      game.cells[r][c].mine = true;
    }
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        const cell = game.cells[r][c];
        if (cell.mine) continue;
        cell.adj = neighbors(r, c).reduce((sum, [rr, cc]) => sum + (game.cells[rr][cc].mine ? 1 : 0), 0);
      }
    }
  }

  function startTimer() {
    stopTimer();
    game.timerId = setInterval(() => {
      if (game.time < 999) game.time += 1;
      els.timer.textContent = pad3(game.time);
    }, 1000);
  }

  function stopTimer() {
    if (game.timerId) {
      clearInterval(game.timerId);
      game.timerId = null;
    }
  }

  function updateMineCounter() {
    els.mineCounter.textContent = pad3(game.mines - game.flags);
  }

  function cellEl(r, c) {
    return els.board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  function paintCell(el, cell, revealMines) {
    el.className = "cell";
    el.innerHTML = "";
    if (cell.open) {
      el.classList.add("open");
      if (cell.exploded) {
        el.classList.add("exploded");
        el.innerHTML = MINE_SVG;
      } else if (cell.mine) {
        el.innerHTML = MINE_SVG;
      } else if (cell.adj) {
        el.textContent = String(cell.adj);
        el.classList.add("n" + cell.adj);
      }
      return;
    }
    if (revealMines && cell.mine && cell.flag !== 1) {
      el.classList.add("open");
      el.innerHTML = MINE_SVG;
      return;
    }
    if (revealMines && !cell.mine && cell.flag === 1) {
      el.classList.add("open", "mine-wrong");
      el.innerHTML = MINE_SVG + CROSS_SVG;
      return;
    }
    if (cell.flag === 1) {
      el.classList.add("flag");
      el.innerHTML = FLAG_SVG;
    } else if (cell.flag === 2) {
      el.innerHTML = Q_SVG;
    }
  }

  function renderBoard() {
    els.board.style.gridTemplateColumns = `repeat(${game.cols}, var(--cell))`;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        btn.setAttribute("role", "gridcell");
        btn.setAttribute("aria-label", `Клетка ${r + 1}, ${c + 1}`);
        frag.appendChild(btn);
      }
    }
    els.board.replaceChildren(frag);
  }

  function refreshAll(revealMines) {
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        paintCell(cellEl(r, c), game.cells[r][c], revealMines);
      }
    }
  }

  function openCell(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cell = game.cells[cr][cc];
      if (cell.open || cell.flag === 1) continue;
      cell.open = true;
      game.opened += 1;
      paintCell(cellEl(cr, cc), cell, false);
      if (!cell.mine && cell.adj === 0) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          const n = game.cells[nr][nc];
          if (!n.open && n.flag !== 1) stack.push([nr, nc]);
        }
      }
    }
  }

  function cycleFlag(r, c) {
    const cell = game.cells[r][c];
    if (cell.open || game.over) return;
    if (cell.flag === 0) {
      cell.flag = 1;
      game.flags += 1;
    } else if (cell.flag === 1) {
      cell.flag = game.marks ? 2 : 0;
      game.flags -= 1;
    } else {
      cell.flag = 0;
    }
    updateMineCounter();
    paintCell(cellEl(r, c), cell, false);
  }

  function chord(r, c) {
    const cell = game.cells[r][c];
    if (!cell.open || !cell.adj || game.over) return;
    const around = neighbors(r, c);
    const flagged = around.filter(([rr, cc]) => game.cells[rr][cc].flag === 1).length;
    if (flagged !== cell.adj) return;
    for (const [rr, cc] of around) {
      const n = game.cells[rr][cc];
      if (!n.open && n.flag !== 1) {
        if (n.mine) {
          explode(rr, cc);
          return;
        }
        openCell(rr, cc);
      }
    }
    checkWin();
  }

  function explode(r, c) {
    game.over = true;
    game.won = false;
    stopTimer();
    game.cells[r][c].open = true;
    game.cells[r][c].exploded = true;
    els.smiley.textContent = "💀";
    refreshAll(true);
    showResult(false);
  }

  function scoreFor(time, opened, totalSafe) {
    const speed = Math.max(0, 999 - time);
    const clear = Math.round((opened / Math.max(1, totalSafe)) * 100);
    return speed * 10 + clear;
  }

  function checkWin() {
    const safe = game.rows * game.cols - game.mines;
    if (game.opened < safe || game.over) return;
    game.over = true;
    game.won = true;
    stopTimer();
    els.smiley.textContent = "😎";
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        const cell = game.cells[r][c];
        if (cell.mine && cell.flag !== 1) {
          cell.flag = 1;
          game.flags += 1;
        }
      }
    }
    updateMineCounter();
    refreshAll(false);
    const totalSafe = game.rows * game.cols - game.mines;
    const score = scoreFor(game.time, game.opened, totalSafe);
    const entry = {
      name: game.player || "Игрок",
      time: game.time,
      score,
      opened: game.opened,
      diff: game.diff,
      at: Date.now(),
    };
    saveScoreLocal(entry);
    showResult(true, score);
    persistScore(entry).then(() => renderLeaderboard(game.diff));
  }

  function revealAt(r, c) {
    if (game.over) return;
    const cell = game.cells[r][c];
    if (cell.open) {
      chord(r, c);
      return;
    }
    if (cell.flag === 1) return;
    if (!game.started) {
      placeMines(r, c);
      game.started = true;
      startTimer();
    }
    if (cell.mine) {
      explode(r, c);
      return;
    }
    openCell(r, c);
    checkWin();
  }

  function showResult(won, score) {
    const totalSafe = game.rows * game.cols - game.mines;
    game.lastResult = {
      won,
      score: won ? score : 0,
      time: game.time,
      opened: game.opened,
      totalSafe,
      player: game.player || "Игрок",
      diff: game.diff,
    };
    els.resultTitle.textContent = won ? "Победа" : "Игра окончена";
    els.resultHeading.textContent = won ? "Поле чисто" : "Мина";
    els.statScore.textContent = won ? String(score) : "—";
    els.statTime.textContent = pad3(game.time);
    els.statCleared.textContent = `${game.opened}/${totalSafe}`;
    els.statPlayer.textContent = game.lastResult.player;
    openModal("resultModal");
    renderLeaderboard(game.diff);
  }

  function apiCandidates() {
    const list = [];
    const configured = String(window.SAPPER_API || "").replace(/\/$/, "");
    if (configured) list.push(configured);
    if (location.protocol !== "file:" && location.origin) list.push(location.origin);
    list.push("http://127.0.0.1:8090");
    list.push("http://localhost:8090");
    return [...new Set(list)];
  }

  function setLbStatus(mode, text) {
    if (!els.lbStatus) return;
    els.lbStatus.className = "lb-status " + mode;
    els.lbStatus.textContent = text;
  }

  async function resolveApi() {
    for (const base of apiCandidates()) {
      try {
        const res = await fetch(base + "/api/health", {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          game.apiBase = base;
          game.apiOnline = true;
          setLbStatus("online", "PostgreSQL");
          return base;
        }
      } catch {
        /* try next */
      }
    }
    game.apiBase = null;
    game.apiOnline = false;
    setLbStatus("offline", "локальный кэш");
    return null;
  }

  async function fetchRemoteScores(diff) {
    if (!game.apiBase) return null;
    const res = await fetch(
      `${game.apiBase}/api/scores?difficulty=${encodeURIComponent(diff)}&limit=15`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) throw new Error("scores " + res.status);
    const data = await res.json();
    return Array.isArray(data.scores) ? data.scores : [];
  }

  async function persistScore(entry) {
    if (!game.apiOnline) await resolveApi();
    if (!game.apiBase) return false;
    const res = await fetch(game.apiBase + "/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        name: entry.name,
        difficulty: entry.diff,
        time: entry.time,
        score: entry.score,
        opened: entry.opened,
      }),
    });
    if (!res.ok) {
      game.apiOnline = false;
      setLbStatus("offline", "сервер отклонил");
      return false;
    }
    game.apiOnline = true;
    setLbStatus("online", "PostgreSQL");
    return true;
  }

  function getScores() {
    const data = loadJSON(SCORES_KEY, { beginner: [], intermediate: [], expert: [] });
    for (const key of Object.keys(PRESETS)) {
      if (!Array.isArray(data[key])) data[key] = [];
    }
    return data;
  }

  function saveScoreLocal(entry) {
    const data = getScores();
    data[entry.diff].push(entry);
    data[entry.diff].sort((a, b) => a.time - b.time || b.score - a.score);
    data[entry.diff] = data[entry.diff].slice(0, 15);
    saveJSON(SCORES_KEY, data);
  }

  function paintLeaderboard(rows) {
    if (!rows.length) {
      els.leaderboard.innerHTML = `<div class="lb-empty">Пока пусто — выиграй партию.</div>`;
      return;
    }
    els.leaderboard.innerHTML = rows
      .map((row, i) => {
        const me = row.name === game.player ? " me" : "";
        return `<div class="lbrow${me}"><span class="rk">${i + 1}</span><span class="nm">${escapeHtml(row.name)}</span><span class="tm">${pad3(row.time)}</span></div>`;
      })
      .join("");
  }

  async function renderLeaderboard(diff) {
    const tab = diff || document.querySelector("#lbTabs .active")?.dataset.lb || game.diff;
    [...els.lbTabs.querySelectorAll("button")].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lb === tab);
    });
    const localRows = getScores()[tab] || [];
    paintLeaderboard(localRows);
    try {
      const remote = await fetchRemoteScores(tab);
      if (remote) paintLeaderboard(remote);
    } catch {
      game.apiOnline = false;
      setLbStatus("offline", "локальный кэш");
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openModal(id) {
    document.getElementById(id).hidden = false;
  }

  function closeModal(id) {
    document.getElementById(id).hidden = true;
  }

  function closeMenus() {
    els.gameMenu.hidden = true;
    els.helpMenu.hidden = true;
    els.gameMenuBtn.parentElement.classList.remove("open");
    els.helpMenuBtn.parentElement.classList.remove("open");
  }

  function toggleMenu(btn, menu) {
    const willOpen = menu.hidden;
    closeMenus();
    if (willOpen) {
      menu.hidden = false;
      btn.parentElement.classList.add("open");
    }
  }

  function ensurePlayerThen(start) {
    game.player = localStorage.getItem(NAME_KEY) || "";
    if (game.player) {
      if (start) newBoard();
      return;
    }
    els.nameInput.value = "";
    openModal("nameModal");
    setTimeout(() => els.nameInput.focus(), 50);
  }

  function bindBoard() {
    els.board.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const cell = e.target.closest(".cell");
      if (!cell) return;
      cycleFlag(+cell.dataset.r, +cell.dataset.c);
    });

    els.board.addEventListener("pointerdown", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || game.over) return;
      if (e.button === 2) return;
      cell.classList.add("pressed");
      if (!game.over) els.smiley.textContent = "😮";
      clearTimeout(game.pressTimer);
      game.suppressClick = false;
      game.pressTimer = setTimeout(() => {
        game.suppressClick = true;
        cell.classList.remove("pressed");
        cycleFlag(+cell.dataset.r, +cell.dataset.c);
        if (!game.over) els.smiley.textContent = "🙂";
      }, 420);
    });

    const endPress = (e) => {
      clearTimeout(game.pressTimer);
      const cell = e.target.closest?.(".cell") || document.querySelector(".cell.pressed");
      cell?.classList.remove("pressed");
      if (!game.over) els.smiley.textContent = game.won ? "😎" : "🙂";
    };

    els.board.addEventListener("pointerup", endPress);
    els.board.addEventListener("pointerleave", endPress);
    els.board.addEventListener("pointercancel", endPress);

    els.board.addEventListener("click", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || game.over) return;
      if (game.suppressClick) {
        game.suppressClick = false;
        return;
      }
      const r = +cell.dataset.r;
      const c = +cell.dataset.c;
      if (game.flagMode) cycleFlag(r, c);
      else revealAt(r, c);
    });

    els.board.addEventListener("dblclick", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || game.over) return;
      chord(+cell.dataset.r, +cell.dataset.c);
    });
  }

  function downloadScoreImage() {
    const res = game.lastResult;
    if (!res) return;
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#6d67e8";
    ctx.fillRect(0, 0, 720, 420);
    ctx.fillStyle = "#c0c0c0";
    roundRect(ctx, 70, 50, 580, 320, 0);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(74, 54, 572, 312);
    ctx.fillStyle = "#00007b";
    ctx.fillRect(78, 58, 564, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Tahoma, sans-serif";
    ctx.fillText("Minesweeper.exe — результат", 90, 78);
    ctx.fillStyle = "#111";
    ctx.font = "bold 28px Tahoma, sans-serif";
    ctx.fillText(res.won ? "Поле чисто" : "Мина", 110, 150);
    ctx.font = "16px Tahoma, sans-serif";
    const lines = [
      `Игрок: ${res.player}`,
      `Счёт: ${res.won ? res.score : "—"}`,
      `Время: ${pad3(res.time)}`,
      `Открыто: ${res.opened}/${res.totalSafe}`,
      `Сложность: ${PRESETS[res.diff].label}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 110, 190 + i * 28));
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "sapper-score.png";
    a.click();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }

  function init() {
    game.marks = localStorage.getItem(MARKS_KEY) === "1";
    els.marksState.textContent = game.marks ? "вкл" : "выкл";
    const savedDiff = localStorage.getItem(DIFF_KEY) || "intermediate";
    setDiff(savedDiff);
    game.player = localStorage.getItem(NAME_KEY) || "";
    newBoard();
    bindBoard();
    resolveApi().then(() => renderLeaderboard(game.diff));

    els.smiley.addEventListener("click", () => newBoard());
    els.flagBtn.addEventListener("click", () => {
      game.flagMode = !game.flagMode;
      els.flagBtn.classList.toggle("on", game.flagMode);
      els.flagBtn.setAttribute("aria-pressed", String(game.flagMode));
      els.flagBtn.innerHTML = game.flagMode
        ? "🚩 Режим флага: <b>ВКЛ</b>"
        : "🚩 Режим флага: <b>ВЫКЛ</b>";
    });

    els.gameMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(els.gameMenuBtn, els.gameMenu);
    });
    els.helpMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(els.helpMenuBtn, els.helpMenu);
    });
    document.addEventListener("click", () => closeMenus());

    els.gameMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      e.stopPropagation();
      closeMenus();
      if (btn.dataset.diff) {
        setDiff(btn.dataset.diff);
        newBoard();
        renderLeaderboard(btn.dataset.diff);
      } else if (btn.dataset.action === "new") {
        newBoard();
      } else if (btn.dataset.action === "marks") {
        game.marks = !game.marks;
        localStorage.setItem(MARKS_KEY, game.marks ? "1" : "0");
        els.marksState.textContent = game.marks ? "вкл" : "выкл";
      } else if (btn.dataset.action === "clear-scores") {
        if (confirm("Удалить все локальные рекорды?")) {
          localStorage.removeItem(SCORES_KEY);
          renderLeaderboard(game.diff);
        }
      }
    });

    els.helpMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      e.stopPropagation();
      closeMenus();
      if (btn.dataset.action === "help") openModal("helpModal");
      if (btn.dataset.action === "about") openModal("aboutModal");
    });

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.hidden = true;
      });
    });

    els.nameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = els.nameInput.value.trim().slice(0, 24) || "Игрок";
      game.player = name;
      localStorage.setItem(NAME_KEY, name);
      closeModal("nameModal");
      newBoard();
    });

    els.playAgain.addEventListener("click", () => {
      closeModal("resultModal");
      newBoard();
    });
    els.saveImage.addEventListener("click", downloadScoreImage);

    els.lbTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      renderLeaderboard(btn.dataset.lb);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        newBoard();
      }
    });

    window.addEventListener("resize", () => setDiff(game.diff));
    ensurePlayerThen(false);
    if (!game.player) openModal("nameModal");
  }

  init();
})();
