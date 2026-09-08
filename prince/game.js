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

  function drawKid(x, y, face, sword) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    ctx.fillStyle = p.inv > 0 && Math.floor(performance.now() / 80) % 2 ? "#fff" : "#f2e6d4";
    ctx.fillRect(-6, -38, 12, 14);
    ctx.fillStyle = "#c43c3c";
    ctx.fillRect(-8, -42, 16, 6);
    ctx.fillStyle = "#ece6dc";
    ctx.fillRect(-8, -24, 16, 18);
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(-7, -6, 6, 16);
    ctx.fillRect(1, -6, 6, 16);
    if (sword) {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(10, -28, 22, 3);
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(8, -30, 4, 7);
    }
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#24160f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(0, 0, W, 28);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = tiles[r][c];
        const x = c * TW;
        const y = r * TH;
        if (t === T.AIR) continue;
        if (t === T.SPIKE) {
          ctx.fillStyle = "#889";
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 8 + i * 14, y + TH - 16);
            ctx.lineTo(x + 14 + i * 14, y + TH - 40);
            ctx.lineTo(x + 20 + i * 14, y + TH - 16);
            ctx.fill();
          }
        }
        if (t === T.CHOMP) {
          const open = Math.floor(performance.now() / 700) % 2 === 0;
          ctx.fillStyle = "#6a3";
          ctx.fillRect(x + 8, y + TH - 28, 48, 12);
          ctx.fillStyle = "#3a2";
          ctx.fillRect(x + 8, y + TH - (open ? 70 : 40), 48, 8);
        }
        if (t === T.GATE && !gateOpen) {
          ctx.fillStyle = "#6a4a28";
          ctx.fillRect(x + 18, y + 20, 28, TH - 36);
        }
        if (t === T.BTN) {
          ctx.fillStyle = "#c9a227";
          ctx.fillRect(x + 16, y + TH - 24, 32, 8);
        }
        if (t === T.POTION) {
          ctx.fillStyle = "#3c8";
          ctx.beginPath();
          ctx.arc(x + 32, y + TH - 40, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (t === T.EXIT) {
          ctx.fillStyle = "#d4a24c";
          ctx.fillRect(x + 10, y + 30, 44, TH - 48);
          ctx.fillStyle = "#1a0f08";
          ctx.fillRect(x + 18, y + 40, 28, TH - 68);
        }
        if (t !== T.AIR && t !== T.GATE) {
          ctx.fillStyle = t === T.LOOSE ? "#8a6238" : "#6a4228";
          ctx.fillRect(x, y + TH - 16, TW, 16);
          ctx.fillStyle = "#4a2e1c";
          ctx.fillRect(x, y + TH - 16, TW, 3);
        }
      }
    }
    if (guard) {
      ctx.fillStyle = "#4a2a2a";
      ctx.fillRect(guard.x, floorY(guard.r) - 40, 14, 40);
      ctx.fillStyle = "#ccc";
      ctx.fillRect(guard.x + (guard.face > 0 ? 12 : -18), floorY(guard.r) - 30, 20, 3);
    }
    drawKid(p.x, p.y, p.face, p.sword);
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
