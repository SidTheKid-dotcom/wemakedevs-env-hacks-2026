// The desk with one sheet of paper on it, and the props around the sheet (SPEC 4, 7.1).
import { useEffect, useRef, type ReactNode } from "react";
import { finePointer, onFrame, pointer, reducedMotion } from "../motion";
import type React from "react";
import { tornClip } from "../rough";
import { Compost } from "./Compost";

export type PropSpec = {
  src: string; w: number; x: string; y: string; depth: number; rot?: number;
  under?: boolean; size?: "m" | "l"; hide?: boolean;
};
const P = (src: string) => `/props/${src}.webp`;

// Prop layouts per screen, anchored to sheet corners (negative offsets hang off the edge).
export const PROPS: Record<string, PropSpec[]> = {
  card: [
    { src: P("cup"), w: 220, x: "-90px", y: "-60px", depth: 0.35, under: true, size: "m" },
    { src: P("soil"), w: 260, x: "-20px", y: "40px", depth: 0.2, under: true, size: "l" },
    { src: P("leaf-1"), w: 130, x: "-100px", y: "360px", depth: 0.25, rot: -30, under: true, size: "l" },
    { src: P("leaf-3"), w: 110, x: "-70px", y: "560px", depth: 0.25, rot: 20, under: true, size: "l" },
    { src: P("paperclip"), w: 46, x: "calc(100% - 26px)", y: "300px", depth: 0.5, rot: 8, size: "m" },
  ],
  home: [
    { src: P("cup"), w: 220, x: "-90px", y: "-60px", depth: 0.35, under: true, size: "m" },
    { src: P("leaf-2"), w: 140, x: "-110px", y: "300px", depth: 0.25, rot: -18, under: true, size: "l" },
    { src: P("soil"), w: 240, x: "calc(100% - 180px)", y: "-50px", depth: 0.2, under: true, size: "l" },
    { src: P("paperclip"), w: 46, x: "calc(100% - 24px)", y: "180px", depth: 0.5, rot: -6, size: "m" },
  ],
  plain: [
    { src: P("leaf-1"), w: 120, x: "-90px", y: "120px", depth: 0.25, rot: -24, under: true, size: "l" },
    { src: P("cup"), w: 200, x: "calc(100% - 120px)", y: "-70px", depth: 0.35, under: true, size: "l" },
    { src: P("soil"), w: 220, x: "-40px", y: "calc(100% - 160px)", depth: 0.2, under: true, size: "l" },
  ],
};

const CLIP = tornClip(17, 3.2, 1.6);

export function Desk({ props = "plain", pot = true, children }: { props?: keyof typeof PROPS; pot?: boolean; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { // push: a fast mouse sweep across a prop nudges it; a spring brings it home (oryzo-style)
    if (!finePointer() || reducedMotion()) return;
    const items = [...wrap.current!.querySelectorAll<HTMLElement>("[data-depth]")].map((el) => ({
      el, rot: +(el.dataset.rot || 0), x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, moving: false,
    }));
    let lx = pointer.px, ly = pointer.py; // pointer position at the last frame
    return onFrame((_, dt) => {
      const decay = Math.exp(-6 * dt);
      pointer.vx *= decay;
      pointer.vy *= decay;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      for (const it of items) {
        const box = it.el.getBoundingClientRect();
        // did the cursor's path since the last frame cross the prop? (a fast flick can jump over it in one frame)
        let hit: [number, number] | null = null;
        for (let k = 0; k <= 8 && !hit; k++) {
          const x = lx + (pointer.px - lx) * (k / 8), y = ly + (pointer.py - ly) * (k / 8);
          if (x > box.left - 8 && x < box.right + 8 && y > box.top - 8 && y < box.bottom + 8) hit = [x, y];
        }
        if (hit && speed > 150) { // impulse from the cursor's velocity; torque from where it hits
          const cx = (hit[0] - (box.left + box.width / 2)) / box.width, cy = (hit[1] - (box.top + box.height / 2)) / box.height;
          it.vx += pointer.vx * 0.06;
          it.vy += pointer.vy * 0.06;
          it.vr += (cx * pointer.vy - cy * pointer.vx) * 0.08;
        }
        for (const [p, v] of [["x", "vx"], ["y", "vy"], ["r", "vr"]] as const) { // damped spring home
          it[v] += (-90 * it[p] - 11 * it[v]) * dt;
          it[p] += it[v] * dt;
        }
        it.x = Math.max(-24, Math.min(24, it.x));
        it.y = Math.max(-24, Math.min(24, it.y));
        it.r = Math.max(-10, Math.min(10, it.r));
        const lift = Math.min(1, Math.hypot(it.x, it.y) / 24 + Math.abs(it.r) / 20);
        if (lift > 0.002 || it.moving) {
          it.el.style.transform = `translate(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px) rotate(${(it.rot + it.r).toFixed(2)}deg)`;
          it.el.style.setProperty("--lift", lift.toFixed(3));
          it.moving = lift > 0.002;
        }
      }
      lx = pointer.px;
      ly = pointer.py;
    });
  }, [props]);

  return (
    <div className="desk">
      <div className="sheet-wrap" ref={wrap}>
        {PROPS[props].map((p, i) => (
          <div key={p.src + p.x} aria-hidden="true" data-depth={p.depth} data-rot={p.rot || 0}
            className={`prop${p.under ? " under" : ""}${p.size ? " only-" + p.size : ""}`}
            style={{ left: p.x, top: p.y, width: p.w, transform: `rotate(${p.rot || 0}deg)`, "--i": i } as React.CSSProperties}>
            <img src={p.src} alt="" loading="lazy" decoding="async" />
          </div>
        ))}
        {pot && <Compost className={`desk-pot on-${props}`} depth={0.45} />}
        <div className="sheet" style={{ clipPath: CLIP }}>
          <div className="page">{children}</div>

        </div>
      </div>
    </div>
  );
}
