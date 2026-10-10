// Printed map of Pune (PMC + PCMC wards) with every written promise as an ink dot (SPEC 3, 5.2, 5.3, 7.2).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Summary } from "../api";
import { commonLocality, kg, localities, method, placeName, tonnes } from "../format";
import { easeInOut, onFrame, reducedMotion } from "../motion";
import { rng, smoothPath } from "../rough";
import { InkPath } from "../ui/Ink";
import map from "./pune.json";

const { minLon, maxLat, kx, scale } = map.projection;
export const project = (lat: number, lon: number): [number, number] => [(lon - minLon) * kx * scale, (maxLat - lat) * scale];
const KM = scale / 111; // map units per km
const FULL = [0, 0, map.width, map.height];

/** A hand-drawn circle of `km` around a point (jittered, slightly open). */
export function inkCircle(cx: number, cy: number, r: number, seed = 5) {
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
  // the label: a dot or a ward, at a point inside the map box; `pinned` when opened by a tap (phones have no hover)
  const [tip, setTip] = useState<{ dot?: Summary; ward?: string; x: number; y: number; pinned?: boolean } | null>(null);
  const touch = useMemo(() => matchMedia("(hover: none)").matches, []);
  const at = (e: React.MouseEvent) => { const r = box.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const wards = useMemo(() => focus ? null : wardStats(points), [points, focus]); // ward totals only on the whole-city map
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

  // Zoom and drag: dots overlap where building is dense, and a phone cannot pinch an SVG.
  const clampVb = ([x, y, w, h]: number[]) => {
    const nw = Math.min(FULL[2], Math.max(FULL[2] / 10, w)), nh = nw * (FULL[3] / FULL[2]);
    return [Math.min(FULL[2] - nw, Math.max(0, x)), Math.min(FULL[3] - nh, Math.max(0, y)), nw, nh];
  };
  const zoom = (k: number) => setVb(([x, y, w, h]) => {
    const nw = w * k, nh = h * k;
    return clampVb([x + (w - nw) / 2, y + (h - nh) / 2, nw, nh]);
  });
  const zoomed = vb[2] < FULL[2] - 1;
  const pan = useRef<{ x: number; y: number; vb: number[]; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!zoomed) return;
    pan.current = { x: e.clientX, y: e.clientY, vb, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p) return;
    const scale = p.vb[2] / (box.current?.clientWidth || 1);
    const dx = (e.clientX - p.x) * scale, dy = (e.clientY - p.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 2 * scale) p.moved = true;
    setVb(clampVb([p.vb[0] - dx, p.vb[1] - dy, p.vb[2], p.vb[3]]));
  };
  const onUp = () => { if (pan.current?.moved) setTip(null); pan.current = null; };

  return (
    <div className="map" ref={box}>
      <svg viewBox={vb.join(" ")} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet"
        className={zoomed ? "zoomed" : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClick={(e) => { if (e.target === e.currentTarget) setTip(null); }}>
        <defs>
          <filter id="riso"><feTurbulence baseFrequency="0.8" numOctaves="2" seed="2" /><feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0.09 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
        </defs>
        {/* city outline = thick stroke under, wards drawn on top with thin lines */}
        <g className="outline">{[...map.pcmc, ...map.pmc].map((w, i) => <path key={i} d={w.d} />)}</g>
        <g className="wards">{[...map.pcmc, ...map.pmc].map((w, i) => <path key={i} d={w.d} />)}</g>
        <g filter="url(#riso)">{map.pmc.map((w, i) => <path key={i} d={w.d} fill="#1F5A3D" opacity="0.06" />)}</g>
        {wards && <g className="ward-hit">
          {(["PCMC", "PMC"] as const).flatMap((city) => map[city === "PCMC" ? "pcmc" : "pmc"].map((w) => {
            const key = `${city}|${w.ward}`;
            return <path key={key} d={w.d} className={`${city === "PCMC" ? "pcmc" : ""}${tip?.ward === key ? " on" : ""}`}
              onMouseEnter={(e) => !touch && setTip({ ward: key, ...at(e) })} onMouseMove={(e) => !touch && tip?.ward === key && setTip({ ward: key, ...at(e) })}
              onMouseLeave={() => !touch && setTip((t) => (t?.ward === key ? null : t))}
              onClick={(e) => { if (touch) setTip({ ward: key, ...at(e), pinned: true }); else if (city === "PCMC") nav(`/officer?ward=${w.ward}`); }} />;
          }))}
        </g>}
        {points.map((p) => {
          const [x, y] = project(p.lat, p.lon);
          const hollow = p.status === "review";
          const r = (2.5 + 8 * Math.sqrt(Math.min(1, (p.wet_kg_day || 0) / max))) * unit * 0.8;
          const delay = Math.min(700, Math.hypot(x - centre[0], y - centre[1]) / unit * 1.2);
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={highlight === p.id || tip?.dot === p ? r * 1.6 : r}
                className={`dot${hollow ? " hollow" : ""}${seen ? " in" : ""}${highlight === p.id || tip?.dot === p ? " hi" : ""}`}
                style={{ animationDelay: `${delay}ms`, strokeWidth: unit * 1.2 }} />
              {/* a 22 px invisible hit area: the dots themselves are 2-6 px */}
              <circle cx={x} cy={y} r={Math.max(r, 11 * unit)} className="dot-hit"
                onMouseEnter={(e) => !touch && setTip({ dot: p, ...at(e) })} onMouseLeave={() => !touch && setTip((t) => (t?.dot === p ? null : t))}
                onClick={(e) => (touch ? setTip({ dot: p, ...at(e), pinned: true }) : nav(`/p/${p.id}`))} />
            </g>
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
      {!focus && <div className="zoomer no-print">
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1 / 1.6)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(1.6)} disabled={!zoomed}>−</button>
        {zoomed && <button type="button" className="reset" onClick={() => setVb(FULL)}>Whole city</button>}
      </div>}
      {!focus && <p className="legend hand"><span className="lg-dot" /> bigger dot = more wet waste promised<br /><span className="lg-dot hollow" /> hollow = a person must check</p>}
      {tip && <Tip tip={tip} wards={wards} boxWidth={box.current?.clientWidth || 0} />}
    </div>
  );
}

type WardStat = { name: string; kg: number; city: "PMC" | "PCMC"; ward: string };

/** Per ward: a readable name and the wet waste counted the same way as the city total (recommended, every check passed). */
function wardStats(points: Summary[]) {
  const out = new Map<string, WardStat>();
  const byWard = new Map<string, Summary[]>();
  for (const p of points) byWard.set(`${p.city}|${p.ward}`, [...(byWard.get(`${p.city}|${p.ward}`) || []), p]);
  for (const w of map.pmc) { // "01 Dhanori - Vishrantwadi" -> "Ward 1, Dhanori – Vishrantwadi"
    const m = w.ward.match(/^0*(\d+)\s+(.*)$/);
    out.set(`PMC|${w.ward}`, { name: m ? `Ward ${m[1]}, ${m[2].replace(/ - /g, " – ")}` : w.ward, kg: 0, city: "PMC", ward: w.ward });
  }
  for (const w of map.pcmc) { // the older PCMC layout has numbers only: name it by its most common locality
    const around = commonLocality((byWard.get(`PCMC|${w.ward}`) || []).map((p) => p.village));
    out.set(`PCMC|${w.ward}`, { name: `PCMC ward ${w.ward}${around ? `, around ${around}` : ""}`, kg: 0, city: "PCMC", ward: w.ward });
  }
  for (const [key, ps] of byWard) {
    const st = out.get(key);
    if (st) st.kg = ps.filter((p) => p.decision === "recommended" && p.status === "auto").reduce((a, p) => a + (p.wet_kg_day || 0), 0);
  }
  return out;
}

function Tip({ tip, wards, boxWidth }: { tip: { dot?: Summary; ward?: string; x: number; y: number; pinned?: boolean }; wards: Map<string, WardStat> | null; boxWidth: number }) {
  const left = Math.max(0, Math.min(tip.x + 12, boxWidth - 250));
  const style = { left, top: Math.max(0, tip.y - 64) };
  if (tip.dot) {
    const p = tip.dot;
    const where = localities(p.village).at(-1) || placeName(p);
    return (
      <span className={`label tip${tip.pinned ? " pinned" : ""}`} style={style}>
        {p.wet_kg_day == null ? <b className="pencil">A person must check this</b>
          : <b className={p.status === "review" ? "pencil" : ""}>{kg(p.wet_kg_day)} kg a day</b>}
        <span>{[where, method(p.quote)?.match(/\((\w+)\)$/)?.[1] || method(p.quote)].filter(Boolean).join(", ")}</span>
        {tip.pinned && <Link className="ink hand" to={`/p/${p.id}`}>Open the promise</Link>}
      </span>
    );
  }
  const w = tip.ward && wards?.get(tip.ward);
  if (!w) return null;
  return (
    <span className={`label tip${tip.pinned ? " pinned" : ""}`} style={style}>
      <b>{w.name}</b>
      <span>{w.kg ? (w.kg >= 1000 ? `${tonnes(w.kg)} t` : `${kg(w.kg)} kg`) + " of wet waste a day promised" : "No counted promises in this ward"}</span>
      {tip.pinned && w.city === "PCMC" && <Link className="ink hand" to={`/officer?ward=${w.ward}`}>Check-first list for this ward</Link>}
    </span>
  );
}
