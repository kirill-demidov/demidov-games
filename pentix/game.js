(() => {
  "use strict";

  const COLS = 12;
  const ROWS = 22;
  const SIZE = 16;
  const BEST_KEY = "pentix.best.v1";

  const COLORS = ["#55ffff", "#ff55ff", "#ffff55", "#55ff55", "#ff5555", "#5555ff", "#ffffff"];

  function rot(cells) {
    const r = cells.map(([y, x]) => [x, -y]);
    const minY = Math.min(...r.map((c) => c[0]));
    const minX = Math.min(...r.map((c) => c[1]));
    return r.map(([y, x]) => [y - minY, x - minX]);
  }
  function rots(base) {
    const out = [base];
    for (let i = 0; i < 3; i++) out.push(rot(out[i]));
    const uniq = [];
    const seen = new Set();
    for (const s of out) {
      const k = s.map((c) => c.join(",")).sort().join("|");
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(s);
      }
    }
    return uniq;
  }

  const PENTO = [
    [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
    [[0, 1], [1, 1], [2, 1], [3, 0], [3, 1]],
    [[0, 1], [1, 1], [2, 0], [2, 1], [3, 0]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
    [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
    [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3]],
    [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
    [[0, 1], [0, 2], [1, 1], [2, 0], [2, 1]],
  ].map(rots);

  const TETRO = [
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ].map(rots);

  const SMALL = [
    [[[0, 0]]],
    [[[0, 0], [0, 1]]],
    rots([[0, 0], [0, 1], [0, 2]]),
    rots([[0, 0], [1, 0], [1, 1]]),
  ];

  const well = document.getElementById("well");
  const nextCv = document.getElementById("next");
  const ctx = well.getContext("2d");
  const nctx = nextCv.getContext("2d");

  const state = {
    grid: [],
    piece: null,
    next: null,
    x: 0,
    y: 0,
    rot: 0,
    score: 0,
    lines: 0,
    level: 0,
    over: false,
    paused: false,
    tick: 0,
    acc: 0,
    last: 0,
  };

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function pickBag() {
    const r = Math.random();
    let family;
    if (r < 0.72) family = PENTO;
    else if (r < 0.92) family = TETRO;
    else family = SMALL;
    const shapes = family[Math.floor(Math.random() * family.length)];
    const color = 1 + Math.floor(Math.random() * COLORS.length);
    return { shapes, color };
  }

  function cells(piece, rot, ox, oy) {
    return piece.shapes[rot % piece.shapes.length].map(([r, c]) => [r + oy, c + ox]);
  }

  function fits(piece, rot, ox, oy) {
    return cells(piece, rot, ox, oy).every(([r, c]) => {
      if (c < 0 || c >= COLS || r >= ROWS) return false;
      if (r < 0) return true;
      return !state.grid[r][c];
    });
  }

  function spawn() {
    state.piece = state.next || pickBag();
    state.next = pickBag();
    state.rot = 0;
    const w = Math.max(...state.piece.shapes[0].map((c) => c[1])) + 1;
    state.x = Math.floor((COLS - w) / 2);
    state.y = 0;
    if (!fits(state.piece, 0, state.x, state.y)) {
      state.over = true;
      document.getElementById("overlay").hidden = false;
      document.getElementById("overlay").textContent = "GAME OVER";
      const best = Math.max(state.score, Number(localStorage.getItem(BEST_KEY) || 0));
      localStorage.setItem(BEST_KEY, String(best));
      document.getElementById("best").textContent = String(best);
    }
    drawNext();
  }

  function lock() {
    for (const [r, c] of cells(state.piece, state.rot, state.x, state.y)) {
      if (r >= 0) state.grid[r][c] = state.piece.color;
    }
    state.score += 20 + state.level * 2;
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[r].every(Boolean)) full.push(r);
    }
    if (full.length) {
      state.grid = state.grid.filter((_, i) => !full.includes(i));
      while (state.grid.length < ROWS) state.grid.unshift(Array(COLS).fill(0));
      state.lines += full.length;
      state.score += [0, 100, 250, 450, 800][full.length] * (state.level + 1);
    }
    const start = Number(document.getElementById("startLevel").value);
    state.level = Math.min(9, start + Math.floor(state.lines / 12));
    hud();
    spawn();
  }

  function interval() {
    return Math.max(90, 800 - state.level * 75);
  }

  function move(dx, dy) {
    if (!state.piece || state.over || state.paused) return false;
    if (fits(state.piece, state.rot, state.x + dx, state.y + dy)) {
      state.x += dx;
      state.y += dy;
      return true;
    }
    return false;
  }

  function rotate() {
    if (!state.piece || state.over || state.paused) return;
    const n = (state.rot + 1) % state.piece.shapes.length;
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(state.piece, n, state.x + kick, state.y)) {
        state.rot = n;
        state.x += kick;
        return;
      }
    }
  }

  function hardDrop() {
    if (!state.piece || state.over || state.paused) return;
    while (move(0, 1)) state.score += 1;
    lock();
  }

  function hud() {
    document.getElementById("score").textContent = String(state.score);
    document.getElementById("lines").textContent = String(state.lines);
    document.getElementById("level").textContent = String(state.level);
  }

  function drawCell(g, x, y, color, s) {
    const px = x * s;
    const py = y * s;
    g.fillStyle = color;
    g.fillRect(px, py, s, s);
    g.fillStyle = "rgba(0,0,0,.55)";
    g.fillRect(px + s - 2, py, 2, s);
    g.fillRect(px, py + s - 2, s, 2);
    g.fillStyle = "rgba(255,255,255,.45)";
    g.fillRect(px, py, s - 2, 2);
    g.fillRect(px, py, 2, s - 2);
  }

  function draw() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, well.width, well.height);
    ctx.fillStyle = "#1a1a1a";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillRect(c * SIZE + 1, r * SIZE + 1, SIZE - 2, SIZE - 2);
      }
    }
    if (!state.grid.length || !state.piece) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.grid[r][c]) drawCell(ctx, c, r, COLORS[state.grid[r][c] - 1], SIZE);
      }
    }
    if (state.piece && !state.over) {
      let gy = state.y;
      while (fits(state.piece, state.rot, state.x, gy + 1)) gy += 1;
      ctx.globalAlpha = 0.18;
      for (const [r, c] of cells(state.piece, state.rot, state.x, gy)) {
        if (r >= 0) drawCell(ctx, c, r, COLORS[state.piece.color - 1], SIZE);
      }
      ctx.globalAlpha = 1;
      for (const [r, c] of cells(state.piece, state.rot, state.x, state.y)) {
        if (r >= 0) drawCell(ctx, c, r, COLORS[state.piece.color - 1], SIZE);
      }
    }
  }

  function drawNext() {
    nctx.fillStyle = "#000";
    nctx.fillRect(0, 0, 80, 80);
    if (!state.next) return;
    const sh = state.next.shapes[0];
    const maxR = Math.max(...sh.map((c) => c[0]));
    const maxC = Math.max(...sh.map((c) => c[1]));
    const s = 12;
    const ox = Math.floor((80 / s - (maxC + 1)) / 2);
    const oy = Math.floor((80 / s - (maxR + 1)) / 2);
    for (const [r, c] of sh) drawCell(nctx, c + ox, r + oy, COLORS[state.next.color - 1], s);
  }

  function loop(t) {
    if (!state.last) state.last = t;
    const dt = t - state.last;
    state.last = t;
    if (!state.over && !state.paused && state.piece) {
      state.acc += dt;
      if (state.acc >= interval()) {
        state.acc = 0;
        if (!move(0, 1)) lock();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    state.grid = emptyGrid();
    state.score = 0;
    state.lines = 0;
    state.level = Number(document.getElementById("startLevel").value);
    state.over = false;
    state.paused = false;
    state.acc = 0;
    state.last = 0;
    state.next = pickBag();
    document.getElementById("overlay").hidden = true;
    document.getElementById("boot").hidden = true;
    document.getElementById("play").hidden = false;
    document.getElementById("best").textContent = localStorage.getItem(BEST_KEY) || "0";
    hud();
    spawn();
  }

  document.getElementById("startBtn").addEventListener("click", start);
  document.getElementById("again").addEventListener("click", start);

  document.addEventListener("keydown", (e) => {
    if (document.getElementById("play").hidden) {
      if (e.key === "Enter") start();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "p") {
      state.paused = !state.paused;
      document.getElementById("overlay").hidden = !state.paused || state.over;
      if (state.paused && !state.over) document.getElementById("overlay").textContent = "PAUSE";
      return;
    }
    if (k === "arrowleft" || k === "a") move(-1, 0);
    else if (k === "arrowright" || k === "d") move(1, 0);
    else if (k === "arrowdown" || k === "s") {
      if (move(0, 1)) state.score += 1;
      hud();
    } else if (k === "arrowup" || k === "w" || k === "x") rotate();
    else if (k === " ") {
      e.preventDefault();
      hardDrop();
      hud();
    }
  });

  document.getElementById("pad").addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "left") move(-1, 0);
    if (act === "right") move(1, 0);
    if (act === "rot") rotate();
    if (act === "down") {
      if (move(0, 1)) state.score += 1;
      hud();
    }
    if (act === "drop") {
      hardDrop();
      hud();
    }
  });

  requestAnimationFrame(loop);
})();
