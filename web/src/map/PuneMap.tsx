// Printed map of Pune (PMC + PCMC wards) with every written promise as an ink dot (SPEC 3, 5.2, 5.3, 7.2).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Summary } from "../api";
import { commonLocality, kg, localities, method, placeName, tonnes } from "../format";
import { easeInOut, onFrame, reducedMotion } from "../motion";
import { rng, smoothPath } from "../rough";
import { InkPath } from "../ui/Ink";
import map from "./pune.json";
import { t, t2, useLang } from "../i18n";

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
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState(FULL);
  const [seen, setSeen] = useState(reducedMotion());
  // the label: a dot or a ward, at a point inside the map box; `pinned` when opened by a tap (phones have no hover)
  const [tip, setTip] = useState<{ dot?: Summary; ward?: string; x: number; y: number; pinned?: boolean } | null>(null);
  const touch = useMemo(() => matchMedia("(hover: none)").matches, []);
  const at = (e: React.MouseEvent) => { const r = box.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const wards = useMemo(() => focus ? null : wardStats(points), [points, focus, lang]); // names are translated, so recompute per language // ward totals only on the whole-city map
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
  /** Scale the view by k, keeping the map point under screen point (sx, sy) where it is. Centre by default. */
  const zoomAt = (k: number, sx?: number, sy?: number) => setVb(([x, y, w, h]) => {
    const r = box.current?.querySelector("svg")?.getBoundingClientRect();
    const fx = r && sx != null ? (sx - r.left) / r.width : 0.5, fy = r && sy != null ? (sy - r.top) / r.height : 0.5;
    const nw = w * k, nh = h * k;
    return clampVb([x + (w - nw) * fx, y + (h - nh) * fy, nw, nh]);
  });
  const zoom = (k: number) => zoomAt(k);
  const zoomed = vb[2] < FULL[2] - 1;

  // Pointers: a mouse drags the zoomed map, but only once it really moves, so a click on a dot
  // or ward still lands on it. On a touch screen one finger always scrolls the page; two fingers
  // pinch and move the map, as on any phone map.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vb: number[]; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; mx: number; my: number; vb: number[] } | null>(null);
  const dragged = useRef(false);
  const svgRect = () => box.current?.querySelector("svg")?.getBoundingClientRect();
  const pinchStart = () => {
    const [a, b] = [...ptrs.current.values()];
    pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vb };
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch") {
      if (ptrs.current.size === 2) { pinchStart(); setTip(null); }
      return;
    }
    if (zoomed && e.button === 0) drag.current = { x: e.clientX, y: e.clientY, vb, moved: false };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svgRect();
    if (!r) return;
    const pz = pinch.current;
    if (pz && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const k = pz.d / d, nw = pz.vb[2] * k, nh = pz.vb[3] * k;
      // the map point that sat under the fingers' first midpoint stays under their current midpoint
      const ax = pz.vb[0] + ((pz.mx - r.left) / r.width) * pz.vb[2], ay = pz.vb[1] + ((pz.my - r.top) / r.height) * pz.vb[3];
      setVb(clampVb([ax - ((mx - r.left) / r.width) * nw, ay - ((my - r.top) / r.height) * nh, nw, nh]));
      return;
    }
    const dg = drag.current;
    if (!dg) return;
    if (!dg.moved && Math.hypot(e.clientX - dg.x, e.clientY - dg.y) < 4) return; // still a click
    if (!dg.moved) { dg.moved = true; e.currentTarget.setPointerCapture(e.pointerId); setTip(null); }
    const s = dg.vb[2] / r.width;
    setVb(clampVb([dg.vb[0] - (e.clientX - dg.x) * s, dg.vb[1] - (e.clientY - dg.y) * s, dg.vb[2], dg.vb[3]]));
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (drag.current?.moved) dragged.current = true; // swallow the click that ends a drag
    drag.current = null;
  };

  // A trackpad pinch arrives as ctrl + wheel. Zoom the map there instead of the whole page.
  useEffect(() => {
    const el = box.current?.querySelector("svg");
    if (!el || focus) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // a plain wheel scrolls the page
      e.preventDefault();
      zoomAt(Math.exp(e.deltaY * 0.01), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className="map" ref={box}>
      <svg viewBox={vb.join(" ")} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet"
        className={zoomed ? "zoomed" : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (dragged.current) { dragged.current = false; e.stopPropagation(); e.preventDefault(); } }}
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
        <button type="button" aria-label={t("Zoom in")} onClick={() => zoom(1 / 1.6)}>+</button>
        <button type="button" aria-label={t("Zoom out")} onClick={() => zoom(1.6)} disabled={!zoomed}>−</button>
        {zoomed && <button type="button" className="reset" onClick={() => setVb(FULL)}>{t("Whole city")}</button>}
      </div>}
      {!focus && zoomed && <p className="map-hint hand no-print">{t(touch ? "Two fingers move the map." : "Drag to move the map.")}</p>}
      {!focus && <p className="legend hand"><span className="lg-dot" /> {t("bigger dot = more wet waste promised")}<br /><span className="lg-dot hollow" /> {t("hollow = a person must check")}</p>}
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
    out.set(`PMC|${w.ward}`, { name: m ? t2("Ward {n}, {place}", { n: m[1], place: m[2].replace(/ - /g, " – ") }) : w.ward, kg: 0, city: "PMC", ward: w.ward });
  }
  for (const w of map.pcmc) { // the older PCMC layout has numbers only: name it by its most common locality
    const around = commonLocality((byWard.get(`PCMC|${w.ward}`) || []).map((p) => p.village));
    out.set(`PCMC|${w.ward}`, { name: around ? t2("PCMC ward {w}, around {place}", { w: w.ward, place: around }) : t2("PCMC ward {w}", { w: w.ward }), kg: 0, city: "PCMC", ward: w.ward });
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
        {p.wet_kg_day == null ? <b className="pencil">{t("A person must check this")}</b>
          : <b className={p.status === "review" ? "pencil" : ""}>{kg(p.wet_kg_day)} {t("kg a day")}</b>}
        <span data-data>{[where, method(p.quote)?.match(/\((\w+)\)$/)?.[1] || method(p.quote)].filter(Boolean).join(", ")}</span>
        {tip.pinned && <Link className="ink hand" to={`/p/${p.id}`}>{t("Open the promise")}</Link>}
      </span>
    );
  }
  const w = tip.ward && wards?.get(tip.ward);
  if (!w) return null;
  return (
    <span className={`label tip${tip.pinned ? " pinned" : ""}`} style={style}>
      <b>{w.name}</b>
      <span>{w.kg ? t2("{amount} of wet waste a day promised", { amount: w.kg >= 1000 ? `${tonnes(w.kg)} t` : `${kg(w.kg)} kg` }) : t("No counted promises in this ward")}</span>
      {tip.pinned && w.city === "PCMC" && <Link className="ink hand" to={`/officer?ward=${w.ward}`}>{t("Check-first list for this ward")}</Link>}
    </span>
  );
}
