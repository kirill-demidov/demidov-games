(() => {
  "use strict";

  const W = 480;
  const H = 560;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const COLORS = ["#e33", "#f80", "#fd5", "#3c3", "#3ae", "#a4f"];

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

  function draw() {
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#445";
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);
    ctx.fillRect(0, 0, W, 8);
    for (const br of bricks) {
      if (br.hp <= 0) continue;
      ctx.fillStyle = br.gold ? "#ccc" : COLORS[(br.hp - 1) % COLORS.length];
      ctx.fillRect(br.x, br.y, BW, BH);
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(br.x, br.y, BW, 3);
    }
    ctx.fillStyle = "#fd5";
    ctx.fillRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 10);
    ctx.fillStyle = "#fff";
    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of drops) {
      ctx.fillStyle = "#6f6";
      ctx.fillRect(d.x - 10, d.y, 20, 12);
      ctx.fillStyle = "#000";
      ctx.font = "10px monospace";
      ctx.fillText(d.k, d.x - 4, d.y + 10);
    }
    ctx.fillStyle = "#f66";
    for (const l of lasers) ctx.fillRect(l.x - 1, l.y, 2, 12);
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "22px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.font = "12px monospace";
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
