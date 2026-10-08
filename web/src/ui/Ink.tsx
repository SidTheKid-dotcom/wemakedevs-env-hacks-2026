// Hand-drawn marks: ink paths that draw on, underlines, ticks, crosses, bursts, tape, stamps, highlighter.
import type { CSSProperties, ReactNode } from "react";
import { roughLine, rng, smoothPath, tornClip } from "../rough";

type Draw = { delay?: number; dur?: number; play?: boolean };
const drawStyle = ({ delay = 0, dur = 400 }: Draw) => ({ "--delay": `${delay}ms`, "--dur": `${dur}ms` }) as CSSProperties;

export function InkPath({ d, width = 2.2, color = "var(--ink)", play = true, ...t }: { d: string; width?: number; color?: string } & Draw) {
  return <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
    className={play ? "draw" : undefined} style={drawStyle(t)} />;
}

/** A wobbly underline that fits its parent (absolute SVG, 100 × 10 viewBox). */
export function Underline({ seed = 1, color = "var(--leaf)", width = 2.4, ...t }: { seed?: number; color?: string; width?: number } & Draw) {
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <InkPath d={roughLine([1, 6], [99, 4.5], seed, 1.2)} color={color} width={width} {...t} />
    </svg>
  );
}

export function Tick({ ok, seed = 1, ...t }: { ok: boolean; seed?: number } & Draw) {
  const r = rng(seed), j = () => (r() - 0.5) * 2;
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true">
      {ok ? <InkPath d={smoothPath([[3 + j(), 13 + j()], [10, 21 + j()], [23 + j(), 4 + j()]])} color="var(--leaf)" width={3} {...t} />
        : <>
          <InkPath d={roughLine([4, 4], [22, 22], seed)} color="var(--rust)" width={3} {...t} />
          <InkPath d={roughLine([22, 5], [5, 22], seed + 1)} color="var(--rust)" width={3} {...t} delay={(t.delay || 0) + 120} />
        </>}
    </svg>
  );
}

/** Six short strokes around a big number. */
export function Burst({ delay = 0 }: { delay?: number }) {
  const strokes: [number, number, number, number][] = [[2, 30, -6, 22], [6, 62, -8, 64], [10, 92, -4, 100], [92, 18, 100, 8], [96, 48, 104, 46], [94, 80, 100, 90]];
  return (
    <svg className="burst" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {strokes.map(([a, b, c, e], i) => <InkPath key={i} d={roughLine([a, b], [c, e], i + 4, 0.4)} color="var(--leaf)" width={2.6} delay={delay + i * 40} dur={160} />)}
    </svg>
  );
}

export function Washi({ style, seed = 3 }: { style?: CSSProperties; seed?: number }) {
  return <span className="washi" aria-hidden="true" style={{ clipPath: tornClip(seed, 4, 12, "lr"), ...style }} />;
}

/** Highlighter stroke behind a span of text: wavy band, multiply blend, sweeps left to right. */
export function Highlight({ children, delay = 150, dur = 600, play = true, id }: { children: ReactNode; id?: string } & Draw) {
  return (
    <span className="hl" id={id}>
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"
        className={play ? "sweep" : undefined} style={drawStyle({ delay, dur })}>
        <path d="M1 4 Q25 1 50 3 T99 2 L99 18 Q75 20 50 18 T1 19 Z" fill="var(--leaf-hi)" />
      </svg>
      <span className="hl-text">{children}</span>
    </span>
  );
}

/** Rubber stamp: ring, lines of text, faded ink. Lands with a small bounce. */
export function Stamp({ lines, color = "var(--stamp)", rotate = -8, delay = 0, shape = "round", play = true }:
  { lines: string[]; color?: string; rotate?: number; delay?: number; shape?: "round" | "box"; play?: boolean }) {
  const round = shape === "round";
  return (
    <span className={`stamp ${shape}${play ? " land" : ""}`} aria-hidden="true"
      style={{ color, "--rot": `${rotate}deg`, "--delay": `${delay}ms` } as CSSProperties}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="ink-wear"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.6" /><feComposite in="SourceGraphic" operator="in" /></filter>
        </defs>
        {round ? <><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3.5" filter="url(#ink-wear)" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" filter="url(#ink-wear)" /></>
          : <><rect x="3" y="3" width="94" height="94" rx="4" fill="none" stroke="currentColor" strokeWidth="3.5" filter="url(#ink-wear)" />
            <rect x="9" y="9" width="82" height="82" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" filter="url(#ink-wear)" /></>}
      </svg>
      <span className="stamp-text">{lines.map((l) => <span key={l}>{l}</span>)}</span>
    </span>
  );
}
