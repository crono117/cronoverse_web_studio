"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type Variant = "badge" | "button" | "panel" | "line";
type Fume = { x: number; y: number; size: number; offset: number; life: number; seed: number; lift: number; drift: number; side: boolean };

/** A canvas-only decoration; real text and controls remain in the DOM. */
export function DustSurface({ variant = "badge", color = "var(--electric)", phase = 0 }: { variant?: Variant; color?: string; phase?: number }) {
  const layer = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = layer.current;
    const el = canvas.current;
    const parent = host?.parentElement;
    const ctx = el?.getContext("2d", { alpha: true });
    if (!host || !el || !parent || !ctx) return;

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const padX = 40, padY = 90;
    let width = 0, height = 0, surfaceColor = "#62c5ff";
    let fumes: Fume[] = [];
    let frame = 0, lastPaint = 0, clock = phase + 1.2, lastTime = 0;
    let visible = false, hover = 0, targetHover = 0, stopped = false;
    const random = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };

    function paint(still = false) {
      if (!ctx || !el) return;
      const time = still ? phase + 2.4 : clock;
      ctx.clearRect(0, 0, width + padX * 2, height + padY * 2);
      ctx.save();
      ctx.translate(padX, padY);
      ctx.fillStyle = surfaceColor;
      ctx.globalAlpha = 1;
      // The surface never erodes. Only independently emitted blocks dissipate.
      ctx.fillRect(0, 0, width, height);
      for (const fume of fumes) {
        const age = (time / fume.life + fume.offset) % 1;
        const rise = Math.pow(age, 1.12);
        const curl = (Math.sin(time * .72 + fume.x * .027) + Math.sin(time * .39 + fume.seed)) * age;
        const x = fume.x + rise * fume.drift + curl * (fume.side ? 2 : 5);
        const y = fume.y - rise * fume.lift;
        const fadeIn = Math.min(1, age / .09);
        const opacity = fadeIn * Math.pow(1 - age, 1.35) * .74;
        const size = fume.size * (1 - age * .2);
        // A quadtree-like split: one block becomes four, then sixteen.
        // Aligned squares and a shared flow keep this smoke-like, not confetti.
        const split = Math.min(1, Math.max(0, (age - .2) / .22));
        const fineSplit = Math.min(1, Math.max(0, (age - .57) / .2));
        if (split === 0) {
          ctx.globalAlpha = opacity;
          ctx.fillRect(x, y, size, size);
        } else {
          const half = size / 2;
          const gap = split * (2 + age * 5);
          for (let q = 0; q < 4; q++) {
            const qx = x + (q % 2) * half + (q % 2 ? 1 : -1) * gap;
            const qy = y + Math.floor(q / 2) * half + (q < 2 ? -1 : 1) * gap * .6;
            const childAlpha = opacity * (.6 + random(fume.seed + q + 20) * .4);
            if (fineSplit === 0) {
              ctx.globalAlpha = childAlpha;
              ctx.fillRect(qx, qy, half, half);
            } else {
              const quarter = half / 2;
              const fineGap = fineSplit * 3;
              for (let j = 0; j < 4; j++) {
                ctx.globalAlpha = childAlpha * (.5 + random(fume.seed + q * 4 + j + 40) * .5);
                ctx.fillRect(qx + (j % 2) * quarter + (j % 2 ? fineGap : -fineGap),
                  qy + Math.floor(j / 2) * quarter + (j < 2 ? -fineGap : fineGap), quarter, quarter);
              }
            }
          }
        }
      }
      ctx.restore();
    }

    function resize() {
      if (!host || !el || !ctx) return;
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      surfaceColor = getComputedStyle(host).getPropertyValue("--dust-color").trim() || "#62c5ff";
      const compact = variant === "button" || variant === "line";
      const plumeHeight = variant === "line" ? 10 : variant === "button" ? 18 : variant === "panel" ? 66 : 60;
      const count = Math.round(width / (compact ? 7 : 3.1));
      fumes = [];
      for (let i = 0; i < count; i++) {
        const seed = i * 71 + phase * 117;
        const side = !compact && i % 7 === 0;
        const r = random(seed);
        const size = compact ? 2 + Math.floor(r * 2) * 2 : 5 + Math.floor(r * 3) * 4;
        fumes.push({
          x: side ? width - size * .55 : random(seed + 2) * (width - size),
          y: side ? random(seed + 3) * Math.min(height * .72, 90) : -size * .15,
          size, seed, side, offset: random(seed + 4), life: 3.8 + random(seed + 5) * 3,
          drift: side ? 10 + r * 15 : (random(seed + 6) - .45) * (compact ? 7 : 30),
          lift: plumeHeight * (.4 + random(seed + 7) * .6),
        });
      }
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      const cw = width + padX * 2, ch = height + padY * 2;
      el.width = Math.round(cw * dpr);
      el.height = Math.round(ch * dpr);
      el.style.width = `${cw}px`;
      el.style.height = `${ch}px`;
      el.style.left = `${-padX}px`;
      el.style.top = `${-padY}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(motion.matches);
      host.dataset.ready = "true";
    }

    function animate(now: number) {
      frame = 0;
      if (stopped || !visible || document.hidden || motion.matches) return;
      if (now - lastPaint >= 1000 / 30) {
        const dt = lastTime ? Math.min((now - lastTime) / 1000, .06) : 0;
        clock += dt * (1 + hover);
        lastTime = now;
        lastPaint = now;
        hover += (targetHover - hover) * .09;
        paint();
      }
      frame = requestAnimationFrame(animate);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (motion.matches) paint(true);
      else if (visible && !document.hidden && !stopped) frame = requestAnimationFrame(animate);
    }
    const enter = () => { targetHover = .28; };
    const leave = () => { targetHover = 0; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { rootMargin: "40px" });
    const resizeObserver = new ResizeObserver(resize);
    resize();
    resizeObserver.observe(host);
    observer.observe(host);
    parent.addEventListener("pointerenter", enter);
    parent.addEventListener("pointerleave", leave);
    parent.addEventListener("focusin", enter);
    parent.addEventListener("focusout", leave);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect(); observer.disconnect();
      parent.removeEventListener("pointerenter", enter); parent.removeEventListener("pointerleave", leave);
      parent.removeEventListener("focusin", enter); parent.removeEventListener("focusout", leave);
      motion.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync);
    };
  }, [color, phase, variant]);

  return <span ref={layer} className={`dust-surface dust-surface-${variant}`} aria-hidden="true" style={{ "--dust-color": color } as CSSProperties}><canvas ref={canvas} /></span>;
}
