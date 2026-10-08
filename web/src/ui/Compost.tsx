// The compost pot: peels drop in on a slow loop, the seedling sways, tapping drops a peel (SPEC 6.3).
import { useEffect, useRef, useState } from "react";
import { finePointer, onFrame, reducedMotion } from "../motion";

const PEELS = ["banana", "eggshell", "tea", "onion"];
type Drop = { el: HTMLImageElement; y: number; v: number; rot: number; spin: number; landed: number };

export function Compost({ className = "", depth = 0.45, stage: fixedStage, loop = true }:
  { className?: string; depth?: number; stage?: number; loop?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(fixedStage ?? 2);
  const taps = useRef(0);
  const dropNow = useRef<() => void>(() => {});

  useEffect(() => {
    if (fixedStage) setStage(fixedStage);
  }, [fixedStage]);

  useEffect(() => {
    if (reducedMotion() || !loop) return;
    const root = box.current!, drops: Drop[] = [];
    let next = 1.4, clock = 0, soil = 0;
    const spawn = () => {
      const el = document.createElement("img");
      el.src = `/props/${PEELS[Math.floor(Math.random() * PEELS.length)]}.webp`;
      el.alt = "";
      el.className = "peel";
      root.appendChild(el);
      el.style.left = `${(38 + Math.random() * 30).toFixed(0)}%`; // over the soil
      drops.push({ el, y: -0.75, v: 0, rot: Math.random() * 90, spin: 90 + Math.random() * 110, landed: 0 });
    };
    dropNow.current = spawn;
    const seedling = root.querySelector<HTMLElement>(".seedling");
    return onFrame((t, dt) => {
      clock += dt;
      if (clock > next) { clock = 0; next = 6 + Math.random() * 3; spawn(); }
      if (seedling) seedling.style.transform = `rotate(${(Math.sin(t / 1000 * 2 * Math.PI / 4.2) * 2).toFixed(2)}deg)`; // sways about its stem base
      const h = root.clientHeight;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d.landed) { // gravity, in pot-heights per second (≈1800 px/s² at desktop size)
          d.v += 7 * dt;
          d.y += d.v * dt;
          d.rot += d.spin * dt;
          if (d.y >= 0.27) { d.y = 0.27; d.landed = 0.0001; soil = (soil + 1) % 5; root.style.setProperty("--soil", `${soil}px`); }
        } else d.landed += dt;
        const squash = d.landed && d.landed < 0.08 ? 0.85 : 1;
        const sink = d.landed > 0.08 ? Math.min(1, (d.landed - 0.08) / 0.4) : 0;
        d.el.style.transform = `translate(-50%, ${(d.y * h).toFixed(1)}px) rotate(${d.rot.toFixed(0)}deg) scale(${(1 - sink * 0.6).toFixed(2)}, ${(squash * (1 - sink * 0.6)).toFixed(2)})`;
        d.el.style.opacity = String(1 - sink);
        if (sink >= 1) { d.el.remove(); drops.splice(i, 1); }
      }
    });
  }, [loop]);

  const tap = () => { // easter egg: every tap drops a peel, every 5th grows the seedling
    dropNow.current();
    taps.current += 1;
    if (taps.current % 5 === 0) setStage((s) => Math.min(4, s + 1));
  };

  return (
    <div ref={box} className={`compost prop ${className}`} data-depth={finePointer() ? depth : undefined}
      aria-hidden="true" onClick={tap}>
      <img className="pot" src="/props/pot.webp" alt="" />
      <img className="seedling" src={`/props/seedling-${stage}.webp`} alt="" />
    </div>
  );
}
