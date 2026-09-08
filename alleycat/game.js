(() => {
  "use strict";

  const W = 640;
  const H = 400;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const FLOORS = 4;
  const WIN = 5;
  const keys = {};
  const pad = {};

  let mode = "street";
  let score = 0;
  let lives = 3;
  let need = 3;
  let got = 0;
  let indoor = null;
  let over = false;

  const cat = { x: 80, y: 0, vy: 0, on: true, face: 1 };

  function windows() {
    const out = [];
    for (let f = 0; f < FLOORS; f++) {
      for (let i = 0; i < WIN; i++) {
        out.push({
          f,
          i,
          x: 70 + i * 110,
          y: 36 + f * 70,
          kind: Math.random() < 0.22 ? "dog" : "ok",
        });
      }
    }
    return out;
  }

  let wins = windows();

  function enter(w) {
    if (w.kind === "dog") {
      loseLife();
      return;
    }
    mode = "room";
    got = 0;
    indoor = {
      mice: [
        { x: 120, y: 300, vx: 70 },
        { x: 400, y: 300, vx: -90 },
        { x: 280, y: 210, vx: 60 },
      ],
      dog: { x: 500, y: 300, vx: -80 },
      plat: [
        [80, 250, 160],
        [320, 250, 160],
        [200, 180, 180],
      ],
    };
    cat.x = 40;
    cat.y = 300;
    cat.vy = 0;
  }

  function loseLife() {
    lives -= 1;
    mode = "street";
    cat.x = 80;
    cat.y = 0;
    cat.vy = 0;
    if (lives <= 0) over = true;
    hud();
  }

  function hud() {
    document.getElementById("score").textContent = String(score);
    document.getElementById("mice").textContent = got + "/" + need;
    document.getElementById("lives").textContent = String(lives);
  }

  function groundY() {
    return mode === "street" ? 348 : 328;
  }

  function update(dt) {
    if (over) return;
    const left = keys.left || pad.left;
    const right = keys.right || pad.right;
    const up = keys.up || pad.up;
    let vx = 0;
    if (left) {
      vx = -180;
      cat.face = -1;
    }
    if (right) {
      vx = 180;
      cat.face = 1;
    }
    cat.x += vx * dt;
    cat.x = Math.max(20, Math.min(W - 20, cat.x));
    if (up && cat.on) {
      cat.vy = -320;
      cat.on = false;
    }
    cat.vy += 900 * dt;
    cat.y += cat.vy * dt;
    let gy = groundY();
    if (mode === "room") {
      for (const [px, py, pw] of indoor.plat) {
        if (cat.vy >= 0 && cat.x > px && cat.x < px + pw && cat.y > py - 18 && cat.y < py + 8) gy = py;
      }
    }
    if (cat.y >= gy) {
      cat.y = gy;
      cat.vy = 0;
      cat.on = true;
    }

    if (mode === "street" && cat.vy < 0) {
      for (const w of wins) {
        if (Math.abs(cat.x - (w.x + 28)) < 28 && Math.abs(cat.y - (w.y + 50)) < 36) enter(w);
      }
    }

    if (mode === "room") {
      for (const m of indoor.mice) {
        m.x += m.vx * dt;
        if (m.x < 40 || m.x > W - 40) m.vx *= -1;
        if (Math.hypot(cat.x - m.x, cat.y - m.y) < 22) {
          m.x = -999;
          got += 1;
          score += 100;
        }
      }
      indoor.mice = indoor.mice.filter((m) => m.x > -100);
      const d = indoor.dog;
      d.x += d.vx * dt;
      if (d.x < 40 || d.x > W - 40) d.vx *= -1;
      if (Math.hypot(cat.x - d.x, cat.y - d.y) < 26) loseLife();
      if (got >= need) {
        score += 250;
        wins = windows();
        mode = "street";
        cat.x = 80;
        cat.y = groundY();
        got = 0;
      }
    }
    hud();
  }

  const CGA = { k: "#000000", c: "#55ffff", m: "#ff55ff", w: "#ffffff" };

  function drawCat(x, y, face) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    ctx.fillStyle = CGA.w;
    ctx.fillRect(-12, -16, 22, 12);
    ctx.fillRect(6, -24, 10, 10);
    ctx.fillRect(-14, -26, 8, 10);
    ctx.fillRect(12, -20, 8, 4);
    ctx.fillRect(-18, -10, 8, 4);
    ctx.fillRect(-10, -4, 5, 10);
    ctx.fillRect(2, -4, 5, 10);
    ctx.fillStyle = CGA.m;
    ctx.fillRect(12, -22, 3, 3);
    ctx.fillRect(-12, -14, 6, 3);
    ctx.fillRect(8, -8, 10, 3);
    ctx.restore();
  }

  function brickWall(x, y, w, h) {
    ctx.fillStyle = CGA.m;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = CGA.k;
    for (let yy = y; yy < y + h; yy += 10) {
      ctx.fillRect(x, yy, w, 1);
      const off = ((yy / 10) | 0) % 2 ? 12 : 0;
      for (let xx = x + off; xx < x + w; xx += 24) ctx.fillRect(xx, yy, 1, 10);
    }
  }

  function draw() {
    ctx.fillStyle = CGA.k;
    ctx.fillRect(0, 0, W, H);
    if (mode === "street") {
      ctx.fillStyle = CGA.w;
      ctx.beginPath();
      ctx.arc(72, 36, 16, 0, Math.PI * 2);
      ctx.fill();
      brickWall(36, 16, 568, 312);
      ctx.fillStyle = CGA.k;
      ctx.fillRect(44, 24, 552, 296);
      brickWall(44, 24, 552, 296);
      for (const w of wins) {
        ctx.fillStyle = CGA.c;
        ctx.fillRect(w.x, w.y, 58, 50);
        ctx.fillStyle = CGA.k;
        ctx.fillRect(w.x + 4, w.y + 4, 24, 20);
        ctx.fillRect(w.x + 30, w.y + 4, 24, 20);
        ctx.fillRect(w.x + 4, w.y + 26, 24, 20);
        ctx.fillRect(w.x + 30, w.y + 26, 24, 20);
        ctx.fillStyle = w.kind === "dog" ? CGA.m : CGA.w;
        ctx.fillRect(w.x + 18, w.y + 28, 22, 16);
        if (w.kind === "dog") {
          ctx.fillRect(w.x + 34, w.y + 22, 10, 10);
        } else {
          ctx.fillStyle = CGA.w;
          ctx.fillRect(w.x + 22, w.y + 18, 14, 10);
        }
      }
      ctx.fillStyle = CGA.c;
      ctx.fillRect(0, 328, W, 72);
      ctx.fillStyle = CGA.k;
      for (let x = 0; x < W; x += 28) {
        ctx.fillRect(x + 8, 300, 8, 36);
        ctx.fillRect(x, 328, 24, 4);
      }
      ctx.fillStyle = CGA.w;
      ctx.fillRect(18, 348, 22, 28);
      ctx.fillRect(600, 348, 22, 28);
      ctx.fillStyle = CGA.m;
      ctx.fillRect(22, 352, 14, 10);
      ctx.fillRect(604, 352, 14, 10);
    } else {
      ctx.fillStyle = CGA.k;
      ctx.fillRect(0, 0, W, H);
      brickWall(0, 0, W, 220);
      ctx.fillStyle = CGA.c;
      ctx.fillRect(0, 328, W, 72);
      ctx.fillStyle = CGA.m;
      for (const [px, py, pw] of indoor.plat) {
        ctx.fillRect(px, py, pw, 10);
        ctx.fillStyle = CGA.w;
        ctx.fillRect(px, py, pw, 2);
        ctx.fillStyle = CGA.m;
      }
      ctx.fillStyle = CGA.c;
      ctx.fillRect(8, 220, 28, 108);
      ctx.fillRect(604, 220, 28, 108);
      ctx.fillStyle = CGA.w;
      for (const m of indoor.mice) {
        ctx.fillRect(m.x - 8, m.y - 6, 16, 8);
        ctx.fillRect(m.x + 8, m.y - 4, 10, 3);
        ctx.fillRect(m.x - 10, m.y - 10, 4, 4);
      }
      ctx.fillStyle = CGA.m;
      ctx.fillRect(indoor.dog.x - 16, indoor.dog.y - 18, 32, 18);
      ctx.fillRect(indoor.dog.x + 10, indoor.dog.y - 26, 12, 12);
      ctx.fillStyle = CGA.w;
      ctx.fillRect(indoor.dog.x + 16, indoor.dog.y - 22, 4, 3);
    }
    drawCat(cat.x, cat.y, cat.face);
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,.75)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CGA.w;
      ctx.font = "28px monospace";
      ctx.textAlign = "center";
      ctx.fillText("CAT OVER", W / 2, H / 2);
      ctx.font = "14px monospace";
      ctx.fillStyle = CGA.c;
      ctx.fillText("R — заново", W / 2, H / 2 + 28);
      ctx.textAlign = "left";
    }
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
    const m = { arrowleft: "left", arrowright: "right", arrowup: "up", a: "left", d: "right", w: "up" };
    const k = m[e.key.toLowerCase()];
    if (k) {
      keys[k] = true;
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "r") {
      lives = 3;
      score = 0;
      over = false;
      mode = "street";
      wins = windows();
      cat.x = 80;
      cat.y = 348;
      hud();
    }
  });
  window.addEventListener("keyup", (e) => {
    const m = { arrowleft: "left", arrowright: "right", arrowup: "up", a: "left", d: "right", w: "up" };
    const k = m[e.key.toLowerCase()];
    if (k) keys[k] = false;
  });
  document.querySelector(".pad").addEventListener("pointerdown", (e) => {
    const k = e.target.closest("button")?.dataset.k;
    if (k) pad[k] = true;
  });
  window.addEventListener("pointerup", () => {
    pad.left = pad.right = pad.up = false;
  });

  hud();
  requestAnimationFrame(loop);
})();
