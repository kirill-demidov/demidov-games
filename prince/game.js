(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 3;
  const TW = 64;
  const TH = 128;
  const W = 640;
  const H = 384;
  const START_HP = 3;
  const START_TIME = 15 * 60;

  const T = { AIR: 0, FLOOR: 1, SPIKE: 2, GATE: 3, BTN: 4, POTION: 5, EXIT: 6, CHOMP: 7, LOOSE: 8 };

  const canvas = document.getElementById("view");
  const ctx = canvas.getContext("2d");
  const keys = {};
  const pad = {};

  const ROOMS = [
    { map: ["1111111111", "1111001111", "1111111111"], right: 1 },
    { map: ["1111111111", "1100220011", "1111111111"], left: 0, right: 2 },
    { map: ["1111311111", "1111011111", "1111411111"], left: 1, right: 3, gate: { r: 0, c: 4, btn: { r: 2, c: 4 } } },
    { map: ["1111111111", "1111111111", "1111111111"], left: 2, right: 4, guard: { r: 2, c: 7, hp: 2 } },
    { map: ["1188111116", "1111071111", "1111111111"], left: 3 },
  ];

  let roomI = 0;
  let tiles = [];
  let looseT = {};
  let gateOpen = false;
  let guard = null;
  let timeLeft = START_TIME;
  let running = false;
  let won = false;
  let over = false;

  const p = {
    x: 80, y: 0, vx: 0, vy: 0, face: 1, hp: START_HP,
    on: false, hang: false, crouch: false, sword: false, hurt: 0, inv: 0,
  };

  function parseRoom() {
    const spec = ROOMS[roomI];
    tiles = spec.map.map((row) => [...row].map((ch) => Number(ch)));
    looseT = {};
    gateOpen = false;
    guard = spec.guard ? { ...spec.guard, x: spec.guard.c * TW + 20, face: -1, cd: 0 } : null;
    const g = spec.gate;
    if (g) tiles[g.r][g.c] = T.GATE;
  }

  function floorY(r) {
    return (r + 1) * TH - 18;
  }

  function tileAt(x, y) {
    const c = Math.floor(x / TW);
    const r = Math.floor((y + 10) / TH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return T.AIR;
    return tiles[r][c];
  }

  function standRow(y) {
    return Math.min(ROWS - 1, Math.max(0, Math.floor((y + 8) / TH)));
  }

  function hasFloor(x, y) {
    const c = Math.floor(x / TW);
    const r = standRow(y);
    if (c < 0 || c >= COLS) return false;
    const t = tiles[r][c];
    if (t === T.AIR) return false;
    if (t === T.GATE && !gateOpen) return true;
    if (t === T.GATE && gateOpen) return false;
    return t !== T.AIR;
  }

  function resetPlayer(col, row) {
    p.x = col * TW + 24;
    p.y = floorY(row);
    p.vx = 0;
    p.vy = 0;
    p.hang = false;
    p.sword = false;
    p.hurt = 0;
  }

  function hit(n) {
    if (p.inv > 0) return;
    p.hp -= n;
    p.inv = 1.1;
    p.hurt = 0.25;
    p.vy = -180;
    if (p.hp <= 0) fail("Павший принц");
  }

  function fail(text) {
    over = true;
    running = false;
    showMsg(text, "Ещё раз");
  }

  function showMsg(title, btn) {
    const el = document.getElementById("msg");
    el.hidden = false;
    el.querySelector("h1").textContent = title;
    el.querySelector("p").textContent = btn === "Ещё раз" ? "Шипы, стража и время. Осторожнее." : "Сбежи из дворца. Не торопись на шипах. Меч — только вплотную.";
    el.querySelector("button").textContent = btn;
  }

  function start() {
    roomI = 0;
    p.hp = START_HP;
    timeLeft = START_TIME;
    won = false;
    over = false;
    running = true;
    parseRoom();
    resetPlayer(1, 2);
    document.getElementById("msg").hidden = true;
  }

  function changeRoom(dir) {
    const spec = ROOMS[roomI];
    const next = dir < 0 ? spec.left : spec.right;
    if (next == null) return;
    roomI = next;
    parseRoom();
    resetPlayer(dir < 0 ? 8 : 1, standRow(p.y));
  }

  function update(dt) {
    if (!running) return;
    timeLeft -= dt;
    if (timeLeft <= 0) {
      fail("Время вышло");
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.sword = !!(keys.space || pad.space);
    p.crouch = !!(keys.down || pad.down) && p.on;

    const left = keys.left || pad.left;
    const right = keys.right || pad.right;
    const up = keys.up || pad.up;

    if (p.hang) {
      p.vy = 0;
      p.vx = 0;
      if (up) {
        p.hang = false;
        p.vy = -220;
        p.y -= 20;
      }
      if (keys.down || pad.down) p.hang = false;
    } else {
      p.vx = 0;
      if (!p.crouch) {
        if (left) {
          p.vx = -140;
          p.face = -1;
        }
        if (right) {
          p.vx = 140;
          p.face = 1;
        }
      }
      if (up && p.on) {
        p.vy = -340;
        p.on = false;
      }
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (p.x < 8) {
      if (ROOMS[roomI].left != null) changeRoom(-1);
      else p.x = 8;
    }
    if (p.x > W - 20) {
      if (ROOMS[roomI].right != null) changeRoom(1);
      else p.x = W - 20;
    }

    const r = standRow(p.y);
    const feet = floorY(r);
    p.on = false;
    if (p.vy >= 0 && p.y >= feet - 6 && hasFloor(p.x + 10, p.y)) {
      p.y = feet;
      p.vy = 0;
      p.on = true;
    }

    if (p.y > H + 40) hit(3);

    const c = Math.min(COLS - 1, Math.max(0, Math.floor((p.x + 10) / TW)));
    const t = tiles[r][c];
    const spec = ROOMS[roomI];

    if (t === T.SPIKE && p.on && p.inv <= 0) hit(1);
    if (t === T.CHOMP && p.on) {
      const chomp = Math.floor(performance.now() / 700) % 2 === 0;
      if (chomp) hit(1);
    }
    if (t === T.BTN && spec.gate) {
      gateOpen = true;
      tiles[spec.gate.r][spec.gate.c] = T.AIR;
    }
    if (t === T.POTION) {
      tiles[r][c] = T.FLOOR;
      p.hp = Math.min(5, p.hp + 1);
    }
    if (t === T.EXIT && p.on) {
      running = false;
      won = true;
      showMsg("Свобода", "Ещё раз");
    }
    if (t === T.LOOSE && p.on) {
      const k = r + "," + c;
      looseT[k] = (looseT[k] || 0) + dt;
      if (looseT[k] > 0.45) tiles[r][c] = T.AIR;
    }

    if (!p.on && p.vy > 80) {
      const ahead = p.x + p.face * 22;
      if (hasFloor(ahead, p.y + 30) && (up || keys.up)) p.hang = true;
    }

    if (guard) {
      guard.cd -= dt;
      const gRow = standRow(p.y);
      if (gRow === guard.r) {
        const dx = p.x - guard.x;
        guard.face = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) > 36) guard.x += guard.face * 50 * dt;
        if (Math.abs(dx) < 50 && guard.cd <= 0) {
          guard.cd = 1.1;
          if (!p.sword) hit(1);
        }
        if (p.sword && Math.abs(dx) < 46) {
          guard.hp -= dt * 2.2;
          if (guard.hp <= 0) guard = null;
        }
      }
    }

    hud();
  }

  function hud() {
    const m = Math.max(0, Math.floor(timeLeft / 60));
    const s = Math.max(0, Math.floor(timeLeft % 60));
    document.getElementById("time").textContent = m + ":" + String(s).padStart(2, "0");
    document.getElementById("hp").textContent = "♥".repeat(Math.max(0, p.hp)) + "♡".repeat(Math.max(0, START_HP - p.hp));
    document.getElementById("room").textContent = "зал " + (roomI + 1);
  }

  function roundRect(x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  function drawKid(x, y, face, sword, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    const skin = flash ? "#fff6e8" : "#e8c9a0";
    roundRect(-7, -40, 13, 11, skin);
    roundRect(-9, -44, 18, 6, "#1a120c");
    roundRect(-11, -42, 6, 8, "#1a120c");
    roundRect(4, -42, 6, 8, "#1a120c");
    roundRect(-4, -36, 3, 2, "#3a2010");
    roundRect(-9, -29, 18, 8, "#c42c2c");
    roundRect(-10, -22, 20, 16, "#f4efe4");
    roundRect(-8, -6, 5, 18, "#f4efe4");
    roundRect(2, -6, 5, 18, "#f4efe4");
    roundRect(-9, 10, 7, 3, "#c9a06a");
    roundRect(1, 10, 7, 3, "#c9a06a");
    if (sword) {
      roundRect(10, -26, 24, 3, "#d8dce0");
      roundRect(8, -29, 5, 8, "#b8862a");
      roundRect(32, -27, 4, 5, "#8a9aa8");
    }
    ctx.restore();
  }

  function drawGuard(g) {
    const gy = floorY(g.r);
    ctx.save();
    ctx.translate(g.x, gy);
    ctx.scale(g.face, 1);
    roundRect(-8, -42, 16, 12, "#c9a07a");
    roundRect(-10, -46, 20, 8, "#2a2038");
    roundRect(-11, -30, 22, 20, "#3a2a68");
    roundRect(-8, -10, 6, 16, "#2a2038");
    roundRect(2, -10, 6, 16, "#2a2038");
    roundRect(10, -28, 22, 3, "#c0c4c8");
    ctx.restore();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1a1028");
    sky.addColorStop(1, "#3a2818");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = tiles[r][c];
        const x = c * TW;
        const y = r * TH;
        ctx.fillStyle = (c + r) % 2 ? "#c4a06a" : "#b89058";
        ctx.fillRect(x, y, TW, TH);
        ctx.fillStyle = "#8a6a38";
        ctx.fillRect(x + TW - 8, y, 8, TH);
        ctx.fillStyle = "#d8b888";
        ctx.fillRect(x + 6, y + 10, 18, 10);
        ctx.fillRect(x + 28, y + 42, 18, 10);
        if (t === T.AIR) {
          ctx.fillStyle = "#140c18";
          ctx.fillRect(x + 4, y + 28, TW - 12, TH - 28);
          continue;
        }
        if (t === T.SPIKE) {
          ctx.fillStyle = "#9aa0a8";
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 8 + i * 14, y + TH - 18);
            ctx.lineTo(x + 14 + i * 14, y + TH - 48);
            ctx.lineTo(x + 20 + i * 14, y + TH - 18);
            ctx.fill();
          }
        }
        if (t === T.CHOMP) {
          const open = Math.floor(performance.now() / 700) % 2 === 0;
          roundRect(x + 10, y + TH - 30, 44, 14, "#4a7a28");
          roundRect(x + 10, y + TH - (open ? 78 : 44), 44, 10, "#2e5418");
          ctx.fillStyle = "#c8d0c0";
          for (let i = 0; i < 5; i++) ctx.fillRect(x + 14 + i * 8, y + TH - 30, 3, 8);
        }
        if (t === T.GATE && !gateOpen) {
          roundRect(x + 16, y + 16, 32, TH - 32, "#6a3a18");
          ctx.fillStyle = "#2a180c";
          for (let i = 0; i < 5; i++) ctx.fillRect(x + 20, y + 22 + i * 18, 24, 4);
        }
        if (t === T.BTN) {
          roundRect(x + 18, y + TH - 26, 28, 8, "#d4a024");
          roundRect(x + 20, y + TH - 28, 24, 4, "#f0d060");
        }
        if (t === T.POTION) {
          ctx.fillStyle = "#2ecf7a";
          ctx.beginPath();
          ctx.arc(x + 32, y + TH - 44, 9, 0, Math.PI * 2);
          ctx.fill();
          roundRect(x + 28, y + TH - 58, 8, 10, "#d8e8e0");
          roundRect(x + 26, y + TH - 62, 12, 5, "#c9a227");
        }
        if (t === T.EXIT) {
          roundRect(x + 8, y + 24, 48, TH - 40, "#e0b45a");
          roundRect(x + 16, y + 36, 32, TH - 62, "#1a0c08");
          roundRect(x + 20, y + 8, 24, 18, "#c4923e");
        }
        const floor = t === T.LOOSE ? "#c9a06a" : "#8a5a28";
        roundRect(x, y + TH - 18, TW, 18, floor);
        ctx.fillStyle = "#5a3818";
        ctx.fillRect(x, y + TH - 18, TW, 3);
        ctx.fillStyle = "#d4b07a";
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 14, y + TH - 12, 8, 6);
      }
    }
    if (guard) drawGuard(guard);
    const flash = p.inv > 0 && Math.floor(performance.now() / 80) % 2;
    drawKid(p.x, p.y, p.face, p.sword, flash);
  }

  let last = 0;
  function loop(t) {
    const dt = Math.min(0.032, (t - last) / 1000 || 0.016);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    const map = { arrowleft: "left", arrowright: "right", arrowup: "up", arrowdown: "down", a: "left", d: "right", w: "up", s: "down", " ": "space" };
    const k = map[e.key.toLowerCase()];
    if (k) {
      keys[k] = true;
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "r") start();
  });
  window.addEventListener("keyup", (e) => {
    const map = { arrowleft: "left", arrowright: "right", arrowup: "up", arrowdown: "down", a: "left", d: "right", w: "up", s: "down", " ": "space" };
    const k = map[e.key.toLowerCase()];
    if (k) keys[k] = false;
  });
  document.querySelector(".pad").addEventListener("pointerdown", (e) => {
    const k = e.target.closest("button")?.dataset.k;
    if (k) pad[k] = true;
  });
  document.querySelector(".pad").addEventListener("pointerup", () => {
    for (const k of Object.keys(pad)) pad[k] = false;
  });
  document.getElementById("go").addEventListener("click", start);
  parseRoom();
  resetPlayer(1, 2);
  hud();
  requestAnimationFrame(loop);
})();
