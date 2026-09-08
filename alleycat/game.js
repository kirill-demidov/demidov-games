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

  function drawCat(x, y, face) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);
    ctx.fillStyle = "#ff0";
    ctx.fillRect(-10, -18, 20, 14);
    ctx.fillRect(6, -28, 8, 10);
    ctx.fillRect(-12, -28, 6, 8);
    ctx.fillRect(-8, -4, 5, 10);
    ctx.fillRect(2, -4, 5, 10);
    ctx.fillStyle = "#f0f";
    ctx.fillRect(8, -24, 3, 3);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (mode === "street") {
      ctx.fillStyle = "#0aa";
      ctx.fillRect(40, 20, 560, 300);
      ctx.fillStyle = "#000";
      ctx.fillRect(48, 28, 544, 284);
      for (const w of wins) {
        ctx.fillStyle = w.kind === "dog" ? "#f0f" : "#0ff";
        ctx.fillRect(w.x, w.y, 56, 48);
        ctx.fillStyle = "#000";
        ctx.fillRect(w.x + 6, w.y + 6, 20, 18);
        ctx.fillRect(w.x + 30, w.y + 6, 20, 18);
        if (w.kind === "dog") {
          ctx.fillStyle = "#f0f";
          ctx.fillRect(w.x + 18, w.y + 28, 20, 12);
        }
      }
      ctx.fillStyle = "#0ff";
      ctx.fillRect(0, 352, W, 8);
      ctx.fillStyle = "#ff0";
      for (let x = 20; x < W; x += 40) ctx.fillRect(x, 360, 18, 4);
    } else {
      ctx.fillStyle = "#202";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0aa";
      ctx.fillRect(0, 336, W, 64);
      ctx.fillStyle = "#f0f";
      for (const [px, py, pw] of indoor.plat) ctx.fillRect(px, py, pw, 10);
      ctx.fillStyle = "#fff";
      for (const m of indoor.mice) {
        ctx.fillRect(m.x - 8, m.y - 6, 16, 8);
        ctx.fillRect(m.x + 6, m.y - 10, 8, 4);
      }
      ctx.fillStyle = "#f0f";
      ctx.fillRect(indoor.dog.x - 14, indoor.dog.y - 16, 28, 16);
      ctx.fillRect(indoor.dog.x + 10, indoor.dog.y - 24, 10, 10);
      ctx.fillStyle = "#0ff";
      ctx.fillRect(12, 250, 24, 80);
    }
    drawCat(cat.x, cat.y, cat.face);
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff0";
      ctx.font = "28px monospace";
      ctx.textAlign = "center";
      ctx.fillText("CAT OVER", W / 2, H / 2);
      ctx.font = "14px monospace";
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
