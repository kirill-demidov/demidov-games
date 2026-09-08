(() => {
  "use strict";

  const N = 9;
  const COLORS = ["#e23d3d", "#3bb273", "#3aa0ff", "#f0c14a", "#c45ae0", "#f07a2a", "#5ee0d8"];
  const BEST_KEY = "lines98.best.v1";

  const boardEl = document.getElementById("board");
  const nextEl = document.getElementById("next");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const toastEl = document.getElementById("toast");

  const game = {
    cells: [],
    sel: null,
    next: [],
    score: 0,
    busy: false,
  };

  function idx(r, c) {
    return r * N + c;
  }
  function rc(i) {
    return [Math.floor(i / N), i % N];
  }

  function emptyCells() {
    const out = [];
    game.cells.forEach((v, i) => {
      if (v === 0) out.push(i);
    });
    return out;
  }

  function randColor() {
    return 1 + Math.floor(Math.random() * COLORS.length);
  }

  function neighbors(i) {
    const [r, c] = rc(i);
    const n = [];
    if (r > 0) n.push(idx(r - 1, c));
    if (r < N - 1) n.push(idx(r + 1, c));
    if (c > 0) n.push(idx(r, c - 1));
    if (c < N - 1) n.push(idx(r, c + 1));
    return n;
  }

  function path(from, to) {
    if (from === to) return [from];
    const q = [from];
    const prev = new Map([[from, -1]]);
    while (q.length) {
      const cur = q.shift();
      for (const nb of neighbors(cur)) {
        if (prev.has(nb)) continue;
        if (nb !== to && game.cells[nb]) continue;
        prev.set(nb, cur);
        if (nb === to) {
          const p = [to];
          let x = to;
          while (prev.get(x) !== -1) {
            x = prev.get(x);
            p.push(x);
          }
          return p.reverse();
        }
        q.push(nb);
      }
    }
    return null;
  }

  function lineScore(n) {
    return 10 + (n - 5) * (n - 2);
  }

  function findRuns() {
    const kill = new Set();
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const color = game.cells[idx(r, c)];
        if (!color) continue;
        for (const [dr, dc] of dirs) {
          const run = [[r, c]];
          let rr = r + dr;
          let cc = c + dc;
          while (rr >= 0 && rr < N && cc >= 0 && cc < N && game.cells[idx(rr, cc)] === color) {
            run.push([rr, cc]);
            rr += dr;
            cc += dc;
          }
          if (run.length >= 5) run.forEach(([y, x]) => kill.add(idx(y, x)));
        }
      }
    }
    return [...kill];
  }

  function clearLines() {
    const kill = findRuns();
    if (!kill.length) return 0;
    const colors = new Map();
    kill.forEach((i) => {
      const col = game.cells[i];
      colors.set(col, (colors.get(col) || 0) + 1);
      game.cells[i] = 0;
    });
    let add = 0;
    for (const n of colors.values()) add += lineScore(n);
    game.score += add;
    return kill.length;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function placeRandom(count) {
    const empty = shuffle(emptyCells());
    const n = Math.min(count, empty.length);
    for (let i = 0; i < n; i++) game.cells[empty[i]] = randColor();
    return n;
  }

  function planNext() {
    const empty = shuffle(emptyCells());
    game.next = empty.slice(0, 3).map((i) => ({ i, color: randColor() }));
  }

  function spawnTurn() {
    for (const n of game.next) {
      if (game.cells[n.i] === 0) game.cells[n.i] = n.color;
      else {
        const e = emptyCells();
        if (e.length) game.cells[e[0]] = n.color;
      }
    }
    planNext();
    clearLines();
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => {
      toastEl.hidden = true;
    }, 900);
  }

  function paint() {
    const kids = boardEl.children;
    for (let i = 0; i < N * N; i++) {
      const cell = kids[i];
      cell.className = "cell";
      cell.innerHTML = "";
      if (game.sel === i) cell.classList.add("goal");
      if (game.cells[i]) {
        const b = document.createElement("div");
        b.className = "ball c" + game.cells[i] + (game.sel === i ? " sel" : "");
        cell.appendChild(b);
      } else {
        const hint = game.next.find((n) => n.i === i);
        if (hint) {
          const h = document.createElement("div");
          h.className = "hint c" + hint.color;
          cell.appendChild(h);
        }
      }
    }
    nextEl.innerHTML = "";
    for (const n of game.next) {
      const d = document.createElement("div");
      d.className = "ball c" + n.color;
      nextEl.appendChild(d);
    }
    scoreEl.textContent = String(game.score);
    const best = Math.max(game.score, Number(localStorage.getItem(BEST_KEY) || 0));
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = String(best);
  }

  async function animatePath(p) {
    game.busy = true;
    const color = game.cells[p[0]];
    game.cells[p[0]] = 0;
    for (let i = 1; i < p.length; i++) {
      paint();
      boardEl.children[p[i]].classList.add("path");
      const ghost = document.createElement("div");
      ghost.className = "ball c" + color;
      boardEl.children[p[i]].appendChild(ghost);
      await new Promise((res) => setTimeout(res, 42));
    }
    game.cells[p[p.length - 1]] = color;
    game.busy = false;
  }

  async function onCell(i) {
    if (game.busy) return;
    if (game.cells[i]) {
      game.sel = game.sel === i ? null : i;
      paint();
      return;
    }
    if (game.sel == null) return;
    const p = path(game.sel, i);
    if (!p) {
      toast("Нет пути");
      return;
    }
    const from = game.sel;
    game.sel = null;
    await animatePath(p);
    const cleared = clearLines();
    if (!cleared) {
      if (!emptyCells().length) {
        paint();
        toast("Поле полное");
        return;
      }
      spawnTurn();
      if (!emptyCells().length && !findRuns().length) toast("Конец игры");
    }
    paint();
    void from;
  }

  function newGame() {
    game.cells = Array(N * N).fill(0);
    game.sel = null;
    game.score = 0;
    game.busy = false;
    placeRandom(5);
    planNext();
    paint();
  }

  function build() {
    boardEl.innerHTML = "";
    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.addEventListener("click", () => onCell(i));
      boardEl.appendChild(cell);
    }
    bestEl.textContent = localStorage.getItem(BEST_KEY) || "0";
    newGame();
  }

  document.getElementById("newGame").addEventListener("click", newGame);
  build();
})();
