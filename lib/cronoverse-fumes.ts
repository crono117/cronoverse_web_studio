// @ts-nocheck
/* Cronoverse fractal-fume engine (framework-free canvas code).
   - palms():    animated voxel fumes shed from the three palm crowns
   - weather():  stars / rain overlay per scene
   - causeway(): scene F causeway build → alive → retrace
   - dust():     same effect as components/dust-surface.tsx (kept for parity; the site still uses DustSurface)
   All effects: 30fps, pause offscreen / hidden tab, honour prefers-reduced-motion.
   Coordinates are in the artwork's 1254×1254 pixel space; every scene image shares that framing. */
const rnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Shared clock: 30fps, pauses offscreen / hidden tab, honors reduced motion, speeds up on hover.
function run(host, hoverTarget, paint, resize, speed = 1) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0, lastPaint = 0, lastTime = 0, clock = 1.2, visible = false, hover = 0, targetHover = 0, stopped = false;
  function animate(now) {
    frame = 0;
    if (stopped || !visible || document.hidden || motion.matches) return;
    if (now - lastPaint >= 1000 / 30) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, .06) : 0;
      clock += dt * (1 + hover) * speed; lastTime = now; lastPaint = now;
      hover += (targetHover - hover) * .09;
      paint(clock);
    }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (motion.matches) paint(2.4, true);
    else if (visible && !document.hidden && !stopped) frame = requestAnimationFrame(animate);
  }
  const enter = () => { targetHover = .28; }, leave = () => { targetHover = 0; };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "40px" });
  const ro = new ResizeObserver(() => { resize(); paint(clock, motion.matches); });
  resize(); paint(clock, motion.matches);
  ro.observe(host); io.observe(host);
  hoverTarget.addEventListener("pointerenter", enter); hoverTarget.addEventListener("pointerleave", leave);
  hoverTarget.addEventListener("focusin", enter); hoverTarget.addEventListener("focusout", leave);
  motion.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
  return () => {
    stopped = true; cancelAnimationFrame(frame); ro.disconnect(); io.disconnect();
    hoverTarget.removeEventListener("pointerenter", enter); hoverTarget.removeEventListener("pointerleave", leave);
    hoverTarget.removeEventListener("focusin", enter); hoverTarget.removeEventListener("focusout", leave);
    motion.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync);
  };
}

function sizeCanvas(el, ctx, cw, ch, left, top) {
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  el.width = Math.round(cw * dpr); el.height = Math.round(ch * dpr);
  el.style.width = cw + "px"; el.style.height = ch + "px"; el.style.left = left + "px"; el.style.top = top + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Draws one block that splits 1 → 4 → 16 as it ages (the site's quadtree dissipation).
function quadBlock(ctx, x, y, size, age, opacity, seed, gapScale, top) {
  const split = Math.min(1, Math.max(0, (age - .2) / .22));
  const fine = Math.min(1, Math.max(0, (age - .57) / .2));
  if (split === 0) {
    ctx.globalAlpha = opacity; ctx.fillRect(x, y, size, size);
    if (top) { ctx.fillStyle = top.hi; ctx.fillRect(x, y, size, Math.max(1, size * .32)); ctx.fillStyle = top.base; }
    return;
  }
  const half = size / 2, gap = split * (2 + age * 5) * gapScale;
  for (let q = 0; q < 4; q++) {
    const qx = x + (q % 2) * half + (q % 2 ? 1 : -1) * gap;
    const qy = y + Math.floor(q / 2) * half + (q < 2 ? -1 : 1) * gap * .6;
    const a = opacity * (.6 + rnd(seed + q + 20) * .4);
    if (fine === 0) { ctx.globalAlpha = a; ctx.fillRect(qx, qy, half, half); continue; }
    const quarter = half / 2, fg = fine * 3 * gapScale;
    for (let j = 0; j < 4; j++) {
      ctx.globalAlpha = a * (.5 + rnd(seed + q * 4 + j + 40) * .5);
      ctx.fillRect(qx + (j % 2) * quarter + (j % 2 ? fg : -fg), qy + Math.floor(j / 2) * quarter + (j < 2 ? -fg : fg), quarter, quarter);
    }
  }
}

/* ---------- Dust surface (buttons, badges, lines) ---------- */
function dust(host, { variant = "badge", color = "#62c5ff", phase = 0 } = {}) {
  const el = host.querySelector("canvas"), ctx = el.getContext("2d", { alpha: true });
  const padX = 40, padY = 90; let width = 0, height = 0, fumes = [];
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    const compact = variant === "button" || variant === "line";
    const plume = variant === "line" ? 10 : variant === "button" ? 18 : variant === "panel" ? 66 : 60;
    const count = Math.round(width / (compact ? 7 : 3.1));
    fumes = [];
    for (let i = 0; i < count; i++) {
      const seed = i * 71 + phase * 117, side = !compact && i % 7 === 0, r = rnd(seed);
      const size = compact ? 2 + Math.floor(r * 2) * 2 : 5 + Math.floor(r * 3) * 4;
      fumes.push({
        x: side ? width - size * .55 : rnd(seed + 2) * (width - size),
        y: side ? rnd(seed + 3) * Math.min(height * .72, 90) : -size * .15,
        size, seed, side, offset: rnd(seed + 4), life: 3.8 + rnd(seed + 5) * 3,
        drift: side ? 10 + r * 15 : (rnd(seed + 6) - .45) * (compact ? 7 : 30),
        lift: plume * (.4 + rnd(seed + 7) * .6),
      });
    }
    sizeCanvas(el, ctx, width + padX * 2, height + padY * 2, -padX, -padY);
    host.dataset.ready = "true";
  }
  function paint(clock, still) {
    const time = still ? phase + 2.4 : clock + phase;
    ctx.clearRect(0, 0, width + padX * 2, height + padY * 2);
    ctx.save(); ctx.translate(padX, padY); ctx.fillStyle = color; ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, width, height);
    for (const f of fumes) {
      const age = (time / f.life + f.offset) % 1, rise = Math.pow(age, 1.12);
      const curl = (Math.sin(time * .72 + f.x * .027) + Math.sin(time * .39 + f.seed)) * age;
      const x = f.x + rise * f.drift + curl * (f.side ? 2 : 5), y = f.y - rise * f.lift;
      const opacity = Math.min(1, age / .09) * Math.pow(1 - age, 1.35) * .74;
      quadBlock(ctx, x, y, f.size * (1 - age * .2), age, opacity, f.seed, 1);
    }
    ctx.restore();
  }
  return run(host, host.parentElement, paint, resize);
}

/* ---------- Palm crowns ----------
   Coordinates are in the source artwork's pixel space (hero-digital-palms.png, 1254×1254).
   Each crown sheds voxel blocks from the same edges where the static cubes sit in the art. */
const ART = 1254;
const CROWNS = [
  { cx: 300, cy: 300, rx: 250, ry: 215, dir: Math.PI + .42, spread: 1.05, w: 1 },   // left palm → sheds left / up-left
  { cx: 750, cy: 380, rx: 200, ry: 210, dir: -.32, spread: .95, w: .85 },            // centre palm → sheds right
  { cx: 1085, cy: 590, rx: 92, ry: 98, dir: -.18, spread: .9, w: .34 },               // distant palm → sheds right
];
// Sampled from the artwork: electric-blue rim light, lavender-blue cube faces, coral sunset faces, peach sun.
const BLUE = [["#62c5ff", "#b9e6ff"], ["#3f86ff", "#8ec0ff"], ["#6f8dff", "#b3c3ff"], ["#2f5fe0", "#6f9cff"]];
const CORAL = [["#ff5e73", "#ffa3ad"], ["#ff7a66", "#ffb9a6"], ["#ff9a7a", "#ffd2bd"], ["#e8526f", "#ff9aa9"]];

function artMap(host, W, H, fallback) {
  const s = Math.max(W / ART, H / ART);
  const img = host.parentElement && host.parentElement.querySelector("img");
  const pos = img ? getComputedStyle(img).objectPosition.split(" ").map(v => v.endsWith("%") ? parseFloat(v) / 100 : NaN) : [];
  const px = isNaN(pos[0]) ? fallback[0] : pos[0], py = isNaN(pos[1]) ? fallback[1] : pos[1];
  return { s, ox: (W - ART * s) * px, oy: (H - ART * s) * py };
}

function palms(host, { phase = 0, density = 1, speed = 1, glow = true, objectPosition = [.5, .42], palette = null } = {}) {
  let pal = palette || { cool: BLUE, warm: CORAL, warmBias: 1 };
  const el = host.querySelector("canvas"), ctx = el.getContext("2d", { alpha: true });
  let W = 0, H = 0, s = 1, ox = 0, oy = 0;
  const fumes = [];
  let seedBase = 0;
  for (const c of CROWNS) {
    const n = Math.round(c.w * 82 * density);
    for (let i = 0; i < n; i++) {
      const seed = ++seedBase * 53.7 + phase * 91;
      const stray = rnd(seed + 1) < .14;
      const th = stray ? rnd(seed + 2) * Math.PI * 2 : c.dir + (rnd(seed + 2) - .5) * 2 * c.spread;
      const r = .7 + rnd(seed + 3) * .34;
      const ix = c.cx + Math.cos(th) * c.rx * r, iy = c.cy + Math.sin(th) * c.ry * r;
      const lower = Math.min(1, Math.max(0, (iy - c.cy) / c.ry * .5 + .5));
      const spark = rnd(seed + 6) < .3;
      fumes.push({
        ix, iy, seed, th,
        size: spark ? 5 + Math.floor(rnd(seed + 7) * 2) * 3 : 10 + Math.floor(rnd(seed + 7) * 4) * 4,
        dist: (40 + rnd(seed + 8) * 110) * (stray ? .5 : 1),
        lift: 18 + rnd(seed + 9) * 60,
        life: 4 + rnd(seed + 10) * 3.2, offset: rnd(seed + 11),
        lower, cyc: -1, base: "#62c5ff", hi: "#b9e6ff", spark,
      });
    }
  }
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    s = Math.max(W / ART, H / ART);
    ({ s, ox, oy } = artMap(host, W, H, objectPosition));
    sizeCanvas(el, ctx, W, H, 0, 0);
    host.dataset.ready = "true";
  }
  function paint(clock, still) {
    const time = still ? phase + 2.4 : clock + phase;
    ctx.clearRect(0, 0, W, H);
    const gs = Math.max(.6, s * 2.1);
    for (const f of fumes) {
      const t = time / f.life + f.offset, age = t % 1, rise = Math.pow(age, 1.1);
      const cyc = Math.floor(t);
      if (cyc !== f.cyc) { // re-colour only when a block respawns, so scene changes bleed in gradually
        f.cyc = cyc;
        const warm = rnd(f.seed + 4 + cyc * 13) < (.18 + f.lower * .5) * pal.warmBias;
        const set = warm ? pal.warm : pal.cool, pick = set[Math.floor(rnd(f.seed + 5 + cyc * 7) * set.length)];
        f.base = pick[0]; f.hi = pick[1];
      }
      const curl = (Math.sin(time * .6 + f.ix * .011) + Math.sin(time * .33 + f.seed)) * age;
      const px = f.ix + Math.cos(f.th) * f.dist * rise + curl * 9;
      const py = f.iy + Math.sin(f.th) * f.dist * rise * .7 - f.lift * rise;
      const x = Math.round(ox + px * s), y = Math.round(oy + py * s);
      const size = Math.max(2, Math.round(f.size * s * (1 - age * .2)));
      const opacity = Math.min(1, age / .12) * Math.pow(1 - age, 1.3) * (f.spark ? .8 : .92);
      if (opacity < .01) continue;
      if (glow && !f.spark && age < .45) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = f.base; ctx.globalAlpha = opacity * .16;
        ctx.fillRect(x - size * .5, y - size * .5, size * 2, size * 2);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = f.base;
      if (f.spark) { ctx.globalAlpha = opacity; ctx.fillRect(x, y, size, size); }
      else quadBlock(ctx, x, y, size, age, opacity, f.seed, gs, { base: f.base, hi: f.hi });
    }
    ctx.globalAlpha = 1;
  }
  const stop = run(host, host.parentElement, paint, resize, speed);
  stop.setPalette = p => { pal = p; };
  return stop;
}

/* ---------- Weather / time-of-day layer ---------- */
function weather(host, { objectPosition = [.5, .42] } = {}) {
  const el = host.querySelector("canvas"), ctx = el.getContext("2d", { alpha: true });
  const keys = ["stars", "rain", "fog", "storm", "bloom", "haze"];
  const amt = { stars: 0, rain: 0, fog: 0, storm: 0, bloom: 0, haze: 0 }, target = { ...amt };
  let bloomColor = "#ffb07a", hazeColor = "#ffffff";
  let W = 0, H = 0, m = { s: 1, ox: 0, oy: 0 };
  const stars = Array.from({ length: 120 }, (_, i) => ({ x: rnd(i + 1), y: rnd(i + 300) * .52, r: rnd(i + 600) < .15 ? 1.6 : .9, tw: 1 + rnd(i + 900) * 3, o: rnd(i + 1200) * 6 }));
  const drops = Array.from({ length: 220 }, (_, i) => ({ x: rnd(i + 50), y: rnd(i + 80), len: 10 + rnd(i + 110) * 18, v: .9 + rnd(i + 140) * .7, a: .25 + rnd(i + 170) * .45 }));
  const bands = Array.from({ length: 6 }, (_, i) => ({ y: .38 + i * .1 + rnd(i + 7) * .05, v: (.012 + rnd(i + 9) * .02) * (i % 2 ? 1 : -1), w: .7 + rnd(i + 11) * .6, o: rnd(i + 13) }));
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    m = artMap(host, W, H, objectPosition);
    sizeCanvas(el, ctx, W, H, 0, 0);
  }
  function paint(time, still) {
    for (const k of keys) amt[k] = still ? target[k] : amt[k] + (target[k] - amt[k]) * .06;
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    const sunX = m.ox + 648 * m.s, sunY = m.oy + 705 * m.s;
    if (amt.haze > .01) { ctx.globalAlpha = amt.haze; ctx.fillStyle = hazeColor; ctx.fillRect(0, 0, W, H); }
    if (amt.bloom > .01) {
      const r = 320 * m.s * 2.2, g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r);
      g.addColorStop(0, bloomColor); g.addColorStop(1, "transparent");
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = amt.bloom * (.85 + Math.sin(time * .8) * .15);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
    }
    if (amt.stars > .01) {
      ctx.fillStyle = "#e8f1ff";
      for (const st of stars) {
        ctx.globalAlpha = amt.stars * (.35 + .65 * (.5 + .5 * Math.sin(time * st.tw + st.o)));
        const sz = Math.max(1, Math.round(st.r * Math.max(1, m.s * 2)));
        ctx.fillRect(Math.round(st.x * W), Math.round(st.y * H), sz, sz);
      }
    }
    if (amt.fog > .01) {
      for (const b of bands) {
        const cx = ((b.o + time * b.v) % 1 + 1) % 1 * W * 1.6 - W * .3, cy = b.y * H, rx = W * b.w, ry = H * .09;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, "rgba(214,226,240,.55)"); g.addColorStop(1, "rgba(214,226,240,0)");
        ctx.globalAlpha = amt.fog; ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
      }
    }
    if (amt.rain > .01) {
      ctx.strokeStyle = "#c9dcff"; ctx.lineWidth = 1;
      for (const d of drops) {
        const y = ((d.y + time * d.v * .9) % 1) * (H + 40) - 20, x = ((d.x - time * d.v * .08) % 1 + 1) % 1 * (W + 40) - 20;
        ctx.globalAlpha = amt.rain * d.a;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * .22, y + d.len); ctx.stroke();
      }
    }
    if (amt.storm > .01) {
      const period = 2.9, idx = Math.floor(time / period), ph = (time % period) / period;
      if (rnd(idx + 5) < .55) {
        const f = ph < .025 ? .5 : ph < .045 ? .08 : ph < .07 ? .32 : 0;
        if (f) { ctx.globalAlpha = amt.storm * f; ctx.fillStyle = "#dfe8ff"; ctx.fillRect(0, 0, W, H); }
      }
    }
    ctx.globalAlpha = 1;
  }
  const stop = run(host, host.parentElement, paint, resize);
  stop.setScene = sc => {
    for (const k of keys) target[k] = (sc.weather && sc.weather[k]) || 0;
    if (sc.bloomColor) bloomColor = sc.bloomColor;
    if (sc.hazeColor) hazeColor = sc.hazeColor;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) paint(2.4, true);
  };
  return stop;
}

/* ---------- Causeway (scene F) ----------
   Build: the checkered causeway assembles door → shore (water breaks away, tiles form 16 → 4 → 1).
   Retrace: later it slowly un-builds shore → door, pulling itself back into the doorway. */
function causeway(host, img, { objectPosition = [.5, .42] } = {}) {
  const el = host.querySelector("canvas"), ctx = el.getContext("2d", { alpha: true });
  const TOP = 826, BOT = 1214, span = BOT - TOP;
  const L = y => 469 + (y - TOP) * (12 / span) - 10, R = y => 506 + (y - TOP) * (244 / span) + 13;
  const trunkR = y => 320 - (y - 540) * (75 / 714) + 30;
  const T = 18, FLASH = ["#8ff0c0", "#c9a0ff", "#b9f5d8", "#e0b8ff"];
  let cover = null, tiles = [], W = 0, H = 0, m = { s: 1, ox: 0, oy: 0 }, raf = 0, t0 = 0;
  let plan = null, state = "shown";
  // Ambient fumes that drift up off the causeway once a stretch of it exists.
  const LIVE = ["#8ff0c0", "#c9a0ff", "#b9f5d8", "#e0b8ff", "#f3eee2"];
  const wisps = Array.from({ length: 110 }, (_, i) => {
    const s = i * 37.3 + 11, v = rnd(s);
    const y = TOP + 8 + Math.pow(v, .8) * (span - 8);
    const edge = rnd(s + 1) < .45, side = rnd(s + 2) < .5;
    const x = edge ? (side ? L(y) + 6 : R(y) - 10) : L(y) + 8 + rnd(s + 3) * (R(y) - L(y) - 16);
    return { x, y, seed: s, life: 2.6 + rnd(s + 4) * 2.4, offset: rnd(s + 5), lift: 18 + rnd(s + 6) * 38,
      drift: (rnd(s + 7) - .5) * 16 + (edge ? (side ? -6 : 6) : 0), size: 4 + Math.floor(rnd(s + 8) * 3) * 3,
      color: LIVE[Math.floor(rnd(s + 9) * LIVE.length)] };
  });
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function build() {
    cover = document.createElement("canvas"); cover.width = ART; cover.height = ART;
    const c = cover.getContext("2d"), k = img.naturalWidth / ART;
    for (let y = TOP; y < BOT; y++) {
      const l = Math.floor(L(y)), r = Math.ceil(R(y)), w = r - l;
      const sl = Math.max(trunkR(y) + 8, l - w), sw = l - 3 - sl;
      if (sw > 4) c.drawImage(img, sl * k, y * k, sw * k, k, l, y, w, 1);
    }
    tiles = [];
    for (let y = TOP; y < BOT; y += T)
      for (let x = Math.floor(L(y)) - T; x < R(y + T) + 1; x += T) {
        if (x + T < L(y) || x > R(Math.min(BOT, y + T))) continue;
        const seed = x * 3.1 + y * 7.7;
        tiles.push({ x, y, seed, jitter: rnd(seed) * .2, flash: FLASH[Math.floor(rnd(seed + 3) * FLASH.length)] });
      }
    render();
  }
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    m = artMap(host, W, H, objectPosition);
    sizeCanvas(el, ctx, W, H, 0, 0);
    render();
  }
  function piece(src, k, sx, sy, sw, sh, dx, dy, a, flash) {
    if (a <= .005) return;
    const X = m.ox + dx * m.s, Y = m.oy + dy * m.s, Wd = sw * m.s, Hd = sh * m.s;
    ctx.globalAlpha = Math.min(1, a); ctx.drawImage(src, sx * k, sy * k, sw * k, sh * k, X, Y, Wd, Hd);
    if (flash && flash.a > .01) { ctx.globalAlpha = Math.min(1, a) * flash.a; ctx.fillStyle = flash.c; ctx.fillRect(X, Y, Wd, Hd); }
  }
  // One tile as a quadtree burst: age 0 = whole & in place, age 1 = 16 scattered fragments.
  function burst(src, k, t, age, alphaFn, flash, dir) {
    const half = T / 2, quarter = T / 4, lift = age * 12 * dir;
    const split = Math.min(1, age / .35), fine = Math.max(0, (age - .45) / .3);
    if (split <= 0) { piece(src, k, t.x, t.y, T, T, t.x, t.y, alphaFn(0), flash); return; }
    for (let q = 0; q < 4; q++) {
      const qx = (q % 2) * half, qy = Math.floor(q / 2) * half, g = split * (1.5 + age * 3.5);
      const ox = qx + (q % 2 ? g : -g), oy = qy + (q < 2 ? -g : g) * .6 - lift;
      const a = alphaFn(q);
      if (fine <= 0) { piece(src, k, t.x + qx, t.y + qy, half, half, t.x + ox, t.y + oy, a, flash); continue; }
      for (let s = 0; s < 4; s++) {
        const fx = (s % 2) * quarter, fy = Math.floor(s / 2) * quarter, fg = fine * 2.5;
        piece(src, k, t.x + qx + fx, t.y + qy + fy, quarter, quarter, t.x + ox + fx + (s % 2 ? fg : -fg), t.y + oy + fy + (s < 2 ? -fg : fg),
          a * (.5 + rnd(t.seed + q * 4 + s + 9) * .5), flash);
      }
    }
  }
  const visBot = () => Math.max(TOP + 60, Math.min(BOT, (H - m.oy) / m.s));
  const rowPos = t => Math.min(1, Math.max(0, (t.y - TOP) / (visBot() - TOP))); // 0 = door, 1 = shore
  function drawBuild(p) {
    const k = img.naturalWidth / ART;
    for (const t of tiles) {
      const local = (p - (rowPos(t) * .7 + t.jitter)) / .3;
      if (local <= 0) { piece(cover, 1, t.x, t.y, T, T, t.x, t.y, 1); continue; }
      if (local >= 1) continue;
      const fl = { c: t.flash, a: .6 * Math.sin(Math.min(1, local * 1.25) * Math.PI) };
      piece(cover, 1, t.x, t.y, T, T, t.x, t.y, local < .82 ? 1 : 1 - (local - .82) / .18);
      const out = Math.min(1, local / .7);
      burst(cover, 1, t, out, q => Math.pow(1 - out, 1.2) * (.65 + rnd(t.seed + q) * .35), fl, 1);
      const inn = Math.max(0, Math.min(1, (local - .18) / .82)), r = 1 - inn;
      burst(img, k, t, r, () => Math.pow(inn, .7), { c: t.flash, a: fl.a * r }, -1);
    }
  }
  function drawRetrace(p) {
    const k = img.naturalWidth / ART;
    for (const t of tiles) {
      const local = (p - ((1 - rowPos(t)) * .72 + t.jitter)) / .28;
      if (local <= 0) continue;                                   // still built (painted image shows)
      if (local >= 1) { piece(cover, 1, t.x, t.y, T, T, t.x, t.y, 1); continue; }
      const fl = { c: t.flash, a: .55 * Math.sin(Math.min(1, local * 1.2) * Math.PI) };
      piece(cover, 1, t.x, t.y, T, T, t.x, t.y, 1);               // water returns underneath…
      const out = Math.min(1, local / .8);                        // …as the tile lifts off toward the door
      burst(img, k, t, out, q => Math.pow(1 - out, 1.1) * (.7 + rnd(t.seed + q + 5) * .3), fl, 1);
    }
  }
  function drawWisps(e) {
    const bEnd = plan.delay + plan.build, rStart = bEnd + plan.hold;
    const vb = visBot();
    for (const w of wisps) {
      if (w.y > vb) continue;
      const pos = Math.min(1, Math.max(0, (w.y - TOP) / (vb - TOP)));
      const builtAt = plan.delay + (pos * .7 + .2 + .3) * plan.build;
      const age = ((e / w.life) + w.offset) % 1, born = e - age * w.life;
      if (born < builtAt || born > rStart) continue;              // only while it forms and exists
      const persp = .45 + .55 * ((w.y - TOP) / span);
      const rise = Math.pow(age, 1.1), curl = Math.sin(e * .8 + w.seed) * 3 * age;
      const ax = w.x + w.drift * rise + curl, ay = w.y - w.lift * rise * persp;
      const x = Math.round(m.ox + ax * m.s), y = Math.round(m.oy + ay * m.s);
      const size = Math.max(2, Math.round(w.size * persp * m.s * 2.2 * (1 - age * .2)));
      let opacity = Math.min(1, age / .12) * Math.pow(1 - age, 1.3) * .9;
      if (e > rStart) opacity *= Math.max(0, 1 - (e - rStart) / .35);   // in-flight ones vanish as the retrace begins
      if (opacity < .01) continue;
      ctx.fillStyle = w.color;
      quadBlock(ctx, x, y, size, age, opacity, w.seed, Math.max(.5, m.s * 1.6));
    }
    ctx.globalAlpha = 1;
  }
  function render() {
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (!cover) return;
    if (state === "covered") { for (const t of tiles) piece(cover, 1, t.x, t.y, T, T, t.x, t.y, 1); ctx.globalAlpha = 1; return; }
    if (state === "shown" || !plan) return;
    const e = (performance.now() - t0) / 1000;
    const bEnd = plan.delay + plan.build, rStart = bEnd + plan.hold, rEnd = rStart + plan.retract;
    if (e < plan.delay) { for (const t of tiles) piece(cover, 1, t.x, t.y, T, T, t.x, t.y, 1); }
    else if (e < bEnd + .4) drawBuild((e - plan.delay) / plan.build);
    else if (e < rStart) { /* built — nothing to draw */ }
    else if (e < rEnd + .3) drawRetrace((e - rStart) / plan.retract);
    else { state = "covered"; render(); return; }
    if (e > plan.delay && e < rStart + .4) drawWisps(e);
    ctx.globalAlpha = 1;
  }
  function loop() {
    render();
    if (state === "playing") raf = requestAnimationFrame(loop);
  }
  const ro = new ResizeObserver(resize);
  resize(); ro.observe(host);
  if (img.complete && img.naturalWidth) build(); else img.addEventListener("load", build, { once: true });
  return {
    cover() { cancelAnimationFrame(raf); state = "covered"; render(); },
    // delay → build (door→shore) → hold → retrace (shore→door), all in seconds.
    play(p) {
      cancelAnimationFrame(raf);
      if (reduced()) { state = "shown"; render(); return; }
      plan = { delay: 1, build: 3, hold: 5, retract: 5, ...p };
      state = "playing"; t0 = performance.now(); raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

/* ---------- Scenes. Each is its own painted artwork (same framing), crossfaded. ---------- */
const SCENES = [
  { id: "A", label: "EVENING · CLEAR", labelEs: "ATARDECER · DESPEJADO", img: "/hero-digital-palms.png", weather: {},
    palette: { cool: BLUE, warm: CORAL, warmBias: 1 } },
  { id: "B", label: "MIDDAY · SUNNY", labelEs: "MEDIODÍA · SOLEADO", img: "/hero-sunny.png", weather: {},
    palette: { cool: [["#62e0ff", "#d9f7ff"], ["#8fd8ff", "#ffffff"], ["#3fb2ff", "#b9e6ff"]], warm: [["#ff8fa3", "#ffd6de"], ["#ffb38a", "#ffe3d1"], ["#ff9ad5", "#ffd9f0"]], warmBias: .8 } },
  { id: "C", label: "NIGHT · CRESCENT MOON", labelEs: "NOCHE · LUNA CRECIENTE", img: "/hero-night.png", weather: { stars: .7 },
    palette: { cool: [["#4f9dff", "#b3d4ff"], ["#62c5ff", "#c9ecff"], ["#6f7dff", "#b8c0ff"]], warm: [["#ff6a5c", "#ffb3a8"], ["#ff8a4c", "#ffc9a3"]], warmBias: .8 } },
  { id: "D", label: "PRE-DAWN · BLUE HOUR", labelEs: "PREAMANECER · HORA AZUL", img: "/hero-predawn.png", weather: { stars: .4 },
    palette: { cool: [["#5aa8ff", "#c2dcff"], ["#62c5ff", "#c9ecff"], ["#8a8dff", "#cfd0ff"]], warm: [["#ff7a6b", "#ffc0b5"], ["#ffa07a", "#ffd4bd"]], warmBias: .9 } },
  { id: "E", label: "NIGHT · RAIN", labelEs: "NOCHE · LLUVIA", img: "/hero-rain.png", rare: true, weather: { rain: .75 },
    palette: { cool: [["#5fb8ff", "#c6e6ff"], ["#6f7dff", "#bcc3ff"], ["#8a6dff", "#cbb8ff"], ["#62c5ff", "#d0f0ff"]], warm: [["#9d8cff", "#d6ceff"]], warmBias: .3 } },
  // The one off-palette scene: mint + lavender voxels, a door on the horizon.
  { id: "F", label: "SOMEWHERE ELSE", labelEs: "EN OTRO LUGAR", img: "/hero-surreal.png", weather: {},
    palette: { cool: [["#8ff0c0", "#dcfff0"], ["#6fe0b0", "#c8f7e2"], ["#b9f5d8", "#f0fff8"]], warm: [["#c9a0ff", "#eddcff"], ["#b58cf5", "#e2d0ff"], ["#e0b8ff", "#f6ebff"]], warmBias: 1.4 } },
];

export { dust, palms, weather, causeway, SCENES };
