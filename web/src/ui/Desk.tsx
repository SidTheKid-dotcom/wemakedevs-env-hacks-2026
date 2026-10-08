// The desk with one sheet of paper on it, and the props around the sheet (SPEC 4, 7.1).
import { useEffect, useRef, type ReactNode } from "react";
import { finePointer, onFrame, pointer, reducedMotion } from "../motion";
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

  useEffect(() => {
    if (!finePointer() || reducedMotion()) return;
    const items = [...wrap.current!.querySelectorAll<HTMLElement>("[data-depth]")].map((el) => ({
      el, depth: +el.dataset.depth!, rot: +(el.dataset.rot || 0), x: 0, y: 0,
    }));
    return onFrame(() => {
      if (innerWidth < 1024) return;
      for (const it of items) { // lerp toward the pointer target, 10 px max at depth 1 (SPEC 7.1)
        it.x += (pointer.x * 10 * it.depth - it.x) * 0.08;
        it.y += (pointer.y * 10 * it.depth - it.y) * 0.08;
        it.el.style.transform = `translate(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px) rotate(${it.rot}deg)`;
        it.el.style.setProperty("--sx", `${(-it.x * 0.4).toFixed(1)}px`);
      }
    });
  }, [props]);

  return (
    <div className="desk">
      <div className="sheet-wrap" ref={wrap}>
        {PROPS[props].map((p) => (
          <div key={p.src + p.x} aria-hidden="true" data-depth={p.depth} data-rot={p.rot || 0}
            className={`prop${p.under ? " under" : ""}${p.size ? " only-" + p.size : ""}`}
            style={{ left: p.x, top: p.y, width: p.w, transform: `rotate(${p.rot || 0}deg)` }}>
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
