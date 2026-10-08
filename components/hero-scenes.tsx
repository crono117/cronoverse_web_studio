"use client";

import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { palms, weather, causeway, SCENES } from "@/lib/cronoverse-fumes";

/* Hero artwork with the day / weather cycle.
   Render as the ONLY child content of .hero-visual (it returns a fragment so the existing
   .hero-visual > img CSS — object-fit, object-position per breakpoint — still applies).

   Cycle: evening (A) holds for eveningSeconds → randomCount random scenes → evening again.
   Random scenes last randomSeconds; rain (E) is rarer (rainChance) and shorter (rainSeconds);
   "Somewhere else" (F) gets + causewaySeconds + retraceSeconds for its causeway sequence.
   Hovering the hero section pauses the cycle. The page opens on startScene. */

type Props = {
  lang: "en" | "es";             // drives scene labels + region text
  alt: string;
  photo: string;                 // caption, e.g. t.photo
  startScene?: number;           // index into SCENES; default 5 = "Somewhere else"
  eveningSeconds?: number; randomSeconds?: number; randomCount?: number;
  rainSeconds?: number; rainChance?: number; causewaySeconds?: number; retraceSeconds?: number;
  dayTint?: number; surrealTint?: number;
};

const imgStyle = { transition: "opacity 1.2s ease" } as const;
const layer = { position: "absolute", inset: 0, borderRadius: 2, pointerEvents: "none", overflow: "hidden" } as const;
const tint = (op: number) => ({ ...layer, background: "var(--ink)", transition: "opacity 1.2s ease", opacity: op });

export function HeroScenes({
  lang, alt, photo, startScene = 5, eveningSeconds = 8, randomSeconds = 10, randomCount = 2,
  rainSeconds = 4, rainChance = .12, causewaySeconds = 3, retraceSeconds = 5, dayTint = .35, surrealTint = .35,
}: Props) {
  const [scene, setScene] = useState(0);
  const palmRef = useRef<HTMLSpanElement>(null), weatherRef = useRef<HTMLSpanElement>(null);
  const causewayRef = useRef<HTMLSpanElement>(null), surrealImg = useRef<HTMLImageElement>(null);
  const fx = useRef<{ palms?: any; weather?: any; causeway?: any }>({});

  // Effects mount once.
  useEffect(() => {
    const f = fx.current;
    if (palmRef.current) f.palms = palms(palmRef.current, { phase: 1.3, palette: SCENES[0].palette as any });
    if (weatherRef.current) { f.weather = weather(weatherRef.current); f.weather.setScene(SCENES[0]); }
    if (causewayRef.current && surrealImg.current) f.causeway = causeway(causewayRef.current, surrealImg.current);
    return () => { f.palms?.(); f.weather?.(); f.causeway?.stop(); };
  }, []);

  // Scheduler.
  useEffect(() => {
    let timer = 0, hovering = false, randomsShown = 0, lastRandom = -1, cur = 0;
    const hero = palmRef.current?.closest(".hero") as HTMLElement | null;

    const show = (i: number) => {
      cur = i; setScene(i);
      const sc = SCENES[i], f = fx.current;
      f.weather?.setScene(sc);
      f.palms?.setPalette?.(sc.palette);
      if (sc.id === "F" && f.causeway) {
        const total = randomSeconds + causewaySeconds + retraceSeconds, delay = 1, tail = 1.6;
        f.causeway.cover();
        f.causeway.play({ delay, build: causewaySeconds, retract: retraceSeconds, hold: Math.max(1, total - delay - causewaySeconds - retraceSeconds - tail) });
      }
      schedule();
    };
    const holdFor = (i: number) => {
      const sc = SCENES[i];
      if (i === 0) return eveningSeconds;
      if (sc.rare) return rainSeconds;
      return randomSeconds + (sc.id === "F" ? causewaySeconds + retraceSeconds : 0);
    };
    const pickRandom = () => {
      const pool = SCENES.map((_, k) => k).filter(k => k > 0 && k !== cur && k !== lastRandom);
      const rainy = pool.filter(k => SCENES[k].rare), dry = pool.filter(k => !SCENES[k].rare);
      const from = rainy.length && (!dry.length || Math.random() < rainChance) ? rainy : dry;
      return from[Math.floor(Math.random() * from.length)];
    };
    function schedule() {
      clearTimeout(timer);
      if (hovering) return;
      timer = window.setTimeout(() => {
        let next = 0;
        if (cur === 0 || randomsShown < randomCount) {
          next = pickRandom(); randomsShown = cur === 0 ? 1 : randomsShown + 1; lastRandom = next;
        } else randomsShown = 0;
        show(next);
      }, holdFor(cur) * 1000);
    }
    const enter = () => { hovering = true; clearTimeout(timer); };
    const leave = () => { hovering = false; schedule(); };
    hero?.addEventListener("pointerenter", enter); hero?.addEventListener("pointerleave", leave);

    if (startScene > 0) { randomsShown = 1; lastRandom = startScene; show(startScene); } else schedule();
    return () => { clearTimeout(timer); hero?.removeEventListener("pointerenter", enter); hero?.removeEventListener("pointerleave", leave); };
  }, [startScene, eveningSeconds, randomSeconds, randomCount, rainSeconds, rainChance, causewaySeconds, retraceSeconds]);

  const op = (i: number) => (scene === i ? 1 : 0);
  return <>
    <img src="/hero-digital-palms.png" width="1254" height="1254" alt={alt} fetchPriority="high"/>
    <img src="/hero-sunny.png" width="1254" height="1254" alt="" aria-hidden="true" loading="lazy" style={{ ...imgStyle, opacity: op(1) }}/>
    <div aria-hidden="true" style={tint(scene === 1 ? dayTint : 0)}/>
    <img src="/hero-night.png" width="1254" height="1254" alt="" aria-hidden="true" loading="lazy" style={{ ...imgStyle, opacity: op(2) }}/>
    <img src="/hero-predawn.png" width="1254" height="1254" alt="" aria-hidden="true" loading="lazy" style={{ ...imgStyle, opacity: op(3) }}/>
    <img ref={surrealImg} src="/hero-surreal.png" width="1254" height="1254" alt="" aria-hidden="true" style={{ ...imgStyle, opacity: op(5) }}/>
    <span ref={causewayRef} aria-hidden="true" style={{ ...layer, transition: "opacity 1.2s ease", opacity: op(5) }}><canvas style={{ position: "absolute", display: "block" }}/></span>
    <div aria-hidden="true" style={tint(scene === 5 ? surrealTint : 0)}/>
    <img src="/hero-rain.png" width="1254" height="1254" alt="" aria-hidden="true" loading="lazy" style={{ ...imgStyle, opacity: op(4) }}/>
    <span ref={palmRef} aria-hidden="true" style={layer}><canvas style={{ position: "absolute", display: "block" }}/></span>
    <span ref={weatherRef} aria-hidden="true" style={layer}><canvas style={{ position: "absolute", display: "block" }}/></span>
    <div className="photo-shade"/>
    <div className="photo-top">
      <span className="photo-top-stack">{lang === "es" ? <span>SUR DE<br/>CALIFORNIA</span> : <span>SOUTHERN<br/>CALIFORNIA</span>}<span className="photo-code">SC / 01</span></span>
      <Compass size={28} strokeWidth={1}/>
    </div>
    <div className="photo-bottom">
      <span>{photo}</span>
      <span className="scene-label" aria-live="polite"><span className="scene-dot"/>{lang === "es" ? SCENES[scene].labelEs : SCENES[scene].label}</span>
    </div>
  </>;
}
