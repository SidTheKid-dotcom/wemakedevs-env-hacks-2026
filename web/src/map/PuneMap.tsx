// Printed map of Pune (PMC + PCMC wards) with every written promise as an ink dot (SPEC 3, 5.2, 5.3, 7.2).
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Summary } from "../api";
import { kg, placeName } from "../format";
import { easeInOut, onFrame, reducedMotion } from "../motion";
import { rng, smoothPath } from "../rough";
import { InkPath } from "../ui/Ink";
import map from "./pune.json";

const { minLon, maxLat, kx, scale } = map.projection;
export const project = (lat: number, lon: number): [number, number] => [(lon - minLon) * kx * scale, (maxLat - lat) * scale];
const KM = scale / 111; // map units per km
const FULL = [0, 0, map.width, map.height];

/** A hand-drawn circle of `km` around a point (jittered, slightly open). */
function inkCircle(cx: number, cy: number, r: number, seed = 5) {
  const rand = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2.04 - 0.4, w = r * (1 + (rand() - 0.5) * 0.03);
    pts.push([cx + Math.cos(a) * w, cy + Math.sin(a) * w]);
  }
  return smoothPath(pts);
}

export function PuneMap({ points, focus, radiusKm = 2, highlight, label = "Map of written wet-waste promises in Pune" }: {
  points: Summary[]; focus?: { lat: number; lon: number } | null; radiusKm?: number; highlight?: string | null; label?: string;
}) {
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState(FULL);
  const [seen, setSeen] = useState(reducedMotion());
  const [tip, setTip] = useState<{ p: Summary; x: number; y: number } | null>(null);
  const max = useMemo(() => Math.max(1, ...points.filter((p) => p.status !== "review").map((p) => p.wet_kg_day || 0)), [points]);

  useEffect(() => { // dots grow in the first time the map is on screen
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.2 });
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => { // fly to the address (900 ms), or back out to the whole city
    const to = focus ? (() => { const [x, y] = project(focus.lat, focus.lon), w = radiusKm * 3.2 * KM; return [x - w / 2, y - w / 2, w, w]; })() : FULL;
    if (reducedMotion()) { setVb(to); return; }
    const from = vb;
    let t0 = 0;
    const stop = onFrame((t) => {
      t0 ||= t;
      const k = easeInOut(Math.min(1, (t - t0) / 900));
      setVb(from.map((v, i) => v + (to[i] - v) * k));
      if (k === 1) stop();
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lon, radiusKm]);

  const unit = vb[2] / 620; // one screen pixel in map units (approx.), so dots keep their size when zoomed
  const centre = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
  const f = focus ? project(focus.lat, focus.lon) : null;

  return (
    <div className="map" ref={box}>
      <svg viewBox={vb.join(" ")} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="riso"><feTurbulence baseFrequency="0.8" numOctaves="2" seed="2" /><feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0.09 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
        </defs>
        {/* city outline = thick stroke under, wards drawn on top with thin lines */}
        <g className="outline">{[...map.pcmc, ...map.pmc].map((w, i) => <path key={i} d={w.d} />)}</g>
        <g className="wards">{[...map.pcmc, ...map.pmc].map((w, i) => <path key={i} d={w.d} />)}</g>
        <g filter="url(#riso)">{map.pmc.map((w, i) => <path key={i} d={w.d} fill="#1F5A3D" opacity="0.06" />)}</g>
        {points.map((p) => {
          const [x, y] = project(p.lat, p.lon);
          const hollow = p.status === "review";
          const r = (2.5 + 8 * Math.sqrt(Math.min(1, (p.wet_kg_day || 0) / max))) * unit * 0.8;
          const delay = Math.min(700, Math.hypot(x - centre[0], y - centre[1]) / unit * 1.2);
          return (
            <circle key={p.id} cx={x} cy={y} r={highlight === p.id ? r * 1.6 : r} tabIndex={-1}
              className={`dot${hollow ? " hollow" : ""}${seen ? " in" : ""}${highlight === p.id ? " hi" : ""}`}
              style={{ animationDelay: `${delay}ms`, strokeWidth: unit * 1.2 }}
              onMouseEnter={(e) => setTip({ p, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}
              onClick={() => nav(`/p/${p.id}`)} />
          );
        })}
        {Object.entries(map.labels).map(([city, [x, y]]) => (
          <text key={city} x={x} y={y} className="city" style={{ fontSize: 28 * unit, strokeWidth: 6 * unit }}>{city}</text>
        ))}
        {f && <>
          <g key={`${f[0]}-${radiusKm}`}><InkPath d={inkCircle(f[0], f[1], radiusKm * KM)} color="var(--leaf)" width={unit * 2.6} delay={900} dur={700} /></g>
          <path d={`M${f[0]} ${f[1]}c${-6 * unit} ${-9 * unit} ${-9 * unit} ${-13 * unit} ${-9 * unit} ${-18 * unit}a${9 * unit} ${9 * unit} 0 1 1 ${18 * unit} 0c0 ${5 * unit} ${-3 * unit} ${9 * unit} ${-9 * unit} ${18 * unit}z`}
            fill="var(--leaf)" className="pin" />
          <text x={f[0] + radiusKm * KM * 0.62} y={f[1] - radiusKm * KM * 0.86} className="km" style={{ fontSize: 22 * unit }}>{radiusKm} km</text>
        </>}
      </svg>
      {!focus && <p className="legend hand"><span className="lg-dot" /> bigger dot = more wet waste promised<br /><span className="lg-dot hollow" /> hollow = a person must check</p>}
      {tip && <span className="label tip" style={{ left: tip.x + 12, top: tip.y - 40, position: "fixed" }}>
        {kg(tip.p.wet_kg_day)} kg a day, {placeName(tip.p)}
      </span>}
    </div>
  );
}
