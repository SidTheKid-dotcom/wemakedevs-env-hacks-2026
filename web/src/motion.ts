// One requestAnimationFrame loop for the whole app (parallax, compost physics, scroll scenes).
// It sleeps when nothing is subscribed or the tab is hidden.
type Frame = (t: number, dt: number) => void;
const subs = new Set<Frame>();
let raf = 0, last = 0;

function tick(t: number) {
  const dt = Math.min(0.05, (t - (last || t)) / 1000);
  last = t;
  subs.forEach((f) => f(t, dt));
  raf = subs.size && !document.hidden ? requestAnimationFrame(tick) : 0;
}
function wake() {
  if (!raf && subs.size && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(tick);
  }
}
document.addEventListener("visibilitychange", wake);

export function onFrame(f: Frame) {
  subs.add(f);
  wake();
  return () => void subs.delete(f);
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = () => matchMedia("(pointer: fine)").matches;

/** Pointer position, -1..1 from the window centre; returns to 0 when the mouse leaves. */
export const pointer = { x: 0, y: 0 };
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  pointer.x = (e.clientX / innerWidth - 0.5) * 2;
  pointer.y = (e.clientY / innerHeight - 0.5) * 2;
});
document.addEventListener("mouseleave", () => Object.assign(pointer, { x: 0, y: 0 }));

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Progress of p inside [a, b], eased. */
export const span = (p: number, a: number, b: number, ease = easeInOut) => ease(clamp((p - a) / (b - a)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
