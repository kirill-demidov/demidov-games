(() => {
  "use strict";

  const W = 480;
  const H = 560;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const COLORS = ["#e33a3a", "#f07818", "#e8c430", "#2db84a", "#2a8cff", "#7a4cff"];
  const CAP = { E: "#e33a3a", S: "#f07818", L: "#3ad0e8", C: "#2db84a" };

  const LEVELS = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [9, 1, 1, 1, 9, 9, 1, 1, 1, 9, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 9, 2, 1, 1, 2, 9, 2, 1, 1, 3, 3, 3, 1, 1, 3, 3, 3, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  ];

  const COLS = 10;
  const BW = 44;
  const BH = 16;

  let bricks = [];
  let balls = [];
  let drops = [];
  let lasers = [];
  let paddle = { x: W / 2, w: 72, y: H - 36 };
  let score = 0;
  let lives = 3;
  let round = 0;
  let stuck = true;
  let laser = false;
  let keys = { l: false, r: false };
  let over = false;

  function loadRound() {
    const src = LEVELS[round % LEVELS.length];
    bricks = [];
    for (let i = 0; i < src.length; i++) {
      const hp = src[i];
      if (!hp) continue;
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      bricks.push({ x: 20 + c * (BW + 2), y: 48 + r * (BH + 4), hp: hp === 9 ? 99 : hp, gold: hp === 9 });
    }
    balls = [{ x: paddle.x, y: paddle.y - 10, vx: 160, vy: -220 }];
    drops = [];
    lasers = [];
    stuck = true;
    laser = false;
    paddle.w = 72;
    hud();
  }

  function hud() {
    document.getElementById("score").textContent = String(score);
    document.getElementById("lives").textContent = String(lives);
    document.getElementById("round").textContent = String(round + 1);
  }

  function spawnDrop(x, y) {
    if (Math.random() > 0.28) return;
    const kinds = ["E", "S", "L", "C"];
    drops.push({ x, y, k: kinds[Math.floor(Math.random() * kinds.length)], vy: 90 });
  }

  function apply(k) {
    if (k === "E") paddle.w = Math.min(120, paddle.w + 24);
    if (k === "S") balls.forEach((b) => { b.vx *= 0.8; b.vy *= 0.8; });
    if (k === "L") laser = true;
    if (k === "C") stuck = true;
  }

  function bounce(b, box) {
    const cx = Math.max(box.x, Math.min(b.x, box.x + (box.w || BW)));
    const cy = Math.max(box.y, Math.min(b.y, box.y + (box.h || BH)));
    const dx = b.x - cx;
    const dy = b.y - cy;
    if (Math.abs(dx) > Math.abs(dy)) b.vx *= -1;
    else b.vy *= -1;
  }

  function update(dt) {
    if (over) return;
    if (keys.l) paddle.x -= 380 * dt;
    if (keys.r) paddle.x += 380 * dt;
    paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));

    if (stuck) {
      balls[0].x = paddle.x;
      balls[0].y = paddle.y - 10;
    } else {
      for (const b of balls) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 8 || b.x > W - 8) b.vx *= -1;
        if (b.y < 8) b.vy *= -1;
        if (b.y > paddle.y - 8 && b.y < paddle.y + 8 && Math.abs(b.x - paddle.x) < paddle.w / 2 + 6 && b.vy > 0) {
          const t = (b.x - paddle.x) / (paddle.w / 2);
          b.vx = 220 * t;
          b.vy = -Math.abs(b.vy);
        }
        for (const br of bricks) {
          if (br.hp <= 0) continue;
          if (b.x > br.x && b.x < br.x + BW && b.y > br.y && b.y < br.y + BH) {
            bounce(b, br);
            if (!br.gold) {
              br.hp -= 1;
              if (br.hp <= 0) {
                score += 50;
                spawnDrop(br.x + BW / 2, br.y);
              }
            }
            break;
          }
        }
      }
      balls = balls.filter((b) => b.y < H + 20);
      if (!balls.length) {
        lives -= 1;
        laser = false;
        paddle.w = 72;
        if (lives <= 0) over = true;
        else {
          balls = [{ x: paddle.x, y: paddle.y - 10, vx: 160, vy: -220 }];
          stuck = true;
        }
      }
    }

    for (const d of drops) d.y += d.vy * dt;
    for (const d of drops) {
      if (d.y > paddle.y - 6 && d.y < paddle.y + 12 && Math.abs(d.x - paddle.x) < paddle.w / 2) {
        apply(d.k);
        d.y = H + 40;
        score += 20;
      }
    }
    drops = drops.filter((d) => d.y < H);

    for (const l of lasers) l.y -= 420 * dt;
    for (const l of lasers) {
      for (const br of bricks) {
        if (br.hp <= 0 || br.gold) continue;
        if (l.x > br.x && l.x < br.x + BW && l.y > br.y && l.y < br.y + BH) {
          br.hp = 0;
          l.y = -20;
          score += 50;
        }
      }
    }
    lasers = lasers.filter((l) => l.y > 0);

    if (bricks.every((b) => b.hp <= 0 || b.gold)) {
      round += 1;
      loadRound();
    }
    hud();
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    }
  }

  function capsule(x, y, w, h, fill) {
    ctx.fillStyle = fill;
    rrect(x, y, w, h, h / 2);
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = "#020018";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#8ec8ff";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % W;
      const sy = (i * 53) % H;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.fillStyle = "#9aa4b0";
    ctx.fillRect(0, 0, 10, H);
    ctx.fillRect(W - 10, 0, 10, H);
    ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = "#d8dee6";
    ctx.fillRect(2, 0, 3, H);
    ctx.fillRect(W - 5, 0, 3, H);

    for (const br of bricks) {
      if (br.hp <= 0) continue;
      const col = br.gold ? "#c8ccd0" : COLORS[(br.hp - 1) % COLORS.length];
      ctx.fillStyle = col;
      rrect(br.x, br.y, BW, BH, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillRect(br.x + 2, br.y + 1, BW - 8, 3);
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(br.x + 2, br.y + BH - 3, BW - 4, 2);
    }

    const px = paddle.x - paddle.w / 2;
    capsule(px, paddle.y, paddle.w, 12, laser ? "#ff4a4a" : "#d8dce4");
    ctx.fillStyle = "#c42828";
    ctx.fillRect(px + 10, paddle.y + 3, paddle.w - 20, 6);
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(px + 8, paddle.y + 2, paddle.w - 16, 2);

    for (const b of balls) {
      const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, 6);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, "#9ab0c8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "700 10px Tahoma, sans-serif";
    ctx.textAlign = "center";
    for (const d of drops) {
      capsule(d.x - 12, d.y, 24, 12, CAP[d.k] || "#6f6");
      ctx.fillStyle = "#fff";
      ctx.fillText(d.k, d.x, d.y + 10);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff5a5a";
    for (const l of lasers) ctx.fillRect(l.x - 1, l.y, 2, 14);
    if (over) {
      ctx.fillStyle = "rgba(2,0,24,.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe14a";
      ctx.font = "700 22px Tahoma, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.font = "12px Tahoma, sans-serif";
      ctx.fillStyle = "#d8dee6";
      ctx.fillText("пробел — заново", W / 2, H / 2 + 24);
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

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    paddle.x = ((e.clientX - r.left) / r.width) * W;
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") keys.l = true;
    if (e.key === "ArrowRight" || e.key === "d") keys.r = true;
    if (e.key === " ") {
      e.preventDefault();
      if (over) {
        score = 0;
        lives = 3;
        round = 0;
        over = false;
        loadRound();
      } else if (stuck) stuck = false;
      else if (laser) lasers.push({ x: paddle.x - 16, y: paddle.y }, { x: paddle.x + 16, y: paddle.y });
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") keys.l = false;
    if (e.key === "ArrowRight" || e.key === "d") keys.r = false;
  });
  canvas.addEventListener("pointerdown", () => {
    if (stuck) stuck = false;
  });

  loadRound();
  requestAnimationFrame(loop);
})();
