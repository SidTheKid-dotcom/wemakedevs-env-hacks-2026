// Hand-drawn geometry: seeded jitter, so a line looks inked but never changes between renders.
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

type P = [number, number];

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
export function smoothPath(pts: P[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] || pts[i], pts[i], pts[i + 1], pts[i + 2] || pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A slightly wobbly line from a to b. */
export function roughLine(a: P, b: P, seed = 1, wobble = 1.6) {
  const r = rng(seed);
  const pts: P[] = [0, 0.33, 0.66, 1].map((t) => [
    a[0] + (b[0] - a[0]) * t + (t > 0 && t < 1 ? (r() - 0.5) * wobble * 2 : 0),
    a[1] + (b[1] - a[1]) * t + (t > 0 && t < 1 ? (r() - 0.5) * wobble * 2 : 0),
  ]);
  return smoothPath(pts);
}

/** A curved ink arrow from a to b, bowed by `bow` px, with a two-stroke head at b. */
export function arrow(a: P, b: P, bow = 60, seed = 3) {
  const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: P = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  const r = rng(seed);
  const c: P = [mid[0] + n[0] * bow + (r() - 0.5) * 4, mid[1] + n[1] * bow + (r() - 0.5) * 4];
  const body = smoothPath([a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - bow * 0.15], c, [(c[0] + b[0]) / 2, (c[1] + b[1]) / 2], b]);
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const head = [ang + Math.PI - 0.5, ang + Math.PI + 0.5]
    .map((t) => `M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${(b[0] + 14 * Math.cos(t)).toFixed(1)} ${(b[1] + 14 * Math.sin(t)).toFixed(1)}`)
    .join("");
  return { body, head };
}

/** clip-path polygon for a torn paper edge (percent along each side, a few px of tear). */
export function tornClip(seed = 7, tear = 3, step = 2.2, sides = "trbl") {
  const r = rng(seed), out: string[] = [];
  const j = () => ((r() - 0.5) * 2 * tear).toFixed(1);
  const edge = (on: boolean, f: (t: number, off: string) => string) => {
    for (let t = 0; t < 100; t += step) out.push(f(t, on ? j() : "0"));
  };
  edge(sides.includes("t"), (t, o) => `${t}% calc(0% + ${Math.abs(+o)}px)`);
  edge(sides.includes("r"), (t, o) => `calc(100% - ${Math.abs(+o)}px) ${t}%`);
  edge(sides.includes("b"), (t, o) => `${100 - t}% calc(100% - ${Math.abs(+o)}px)`);
  edge(sides.includes("l"), (t, o) => `calc(0% + ${Math.abs(+o)}px) ${100 - t}%`);
  return `polygon(${out.join(",")})`;
}
