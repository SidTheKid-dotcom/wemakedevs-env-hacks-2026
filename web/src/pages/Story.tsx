// Home scroll story (SPEC 6.4): from a page nobody reads to waste processed at source.
// A sticky stage; every actor is a pure function of scroll progress p, so scrolling back reverses it.
import { useEffect, useRef, type CSSProperties } from "react";
import { kg } from "../format";
import { clamp, mix, onFrame, reducedMotion, span } from "../motion";
import { SearchTape } from "./Search";

const QUOTE = "Wet waste: 922.61 In-situ Composting";
const BEATS = [
  { from: 0.0, to: 0.15, text: "Every large housing project in Pune made a promise." },
  { from: 0.15, to: 0.35, text: "It is written in public minutes. Over a thousand of them. Nobody reads them." },
  { from: 0.35, to: 0.55, text: "VACHAN reads every one and pulls out the waste promise." },
  { from: 0.55, to: 0.8, text: "923 kg of wet waste a day, promised to be composted on site, not trucked to Moshi or Hadapsar." },
  { from: 0.8, to: 1.01, text: "Find the promise for your building." },
];
const PEELS = ["banana", "eggshell", "tea", "onion"];

export function Story({ total }: { total?: number }) {
  const section = useRef<HTMLElement>(null);
  const reduced = reducedMotion();

  useEffect(() => {
    if (reduced) return;
    const root = section.current!;
    const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
    const words = [...root.querySelectorAll<HTMLElement>(".beat")].map((b) => [...b.querySelectorAll<HTMLElement>("span")]);
    const beats = [...root.querySelectorAll<HTMLElement>(".beat")];
    const [stack, top, hl, line, num, numText, pot, seedling, card, search, fill] =
      [".s-stack", ".s-top", ".s-hl", ".s-line", ".s-num", ".s-num b", ".s-pot", ".s-seedling", ".s-card", ".s-search", ".s-fill"].map($);
    const peels = [...root.querySelectorAll<HTMLElement>(".s-peel")];
    let lastStage = 0, lastP = -1;

    return onFrame(() => {
      const r = root.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = clamp(-r.top / (r.height - innerHeight));
      if (Math.abs(p - lastP) < 0.0004) return;
      lastP = p;
      const small = innerWidth < 1024;
      fill.style.transform = `scaleY(${p.toFixed(3)})`; // washi-tape progress

      BEATS.forEach((b, i) => { // words: blur 6px → clear, staggered 0.01 p; the beat fades as the next begins
        const out = i < BEATS.length - 1 ? span(p, b.to - 0.02, b.to + 0.02) : 0;
        beats[i].style.opacity = String(1 - out);
        words[i].forEach((w, j) => {
          const k = span(p, b.from + j * 0.01, b.from + j * 0.01 + 0.04);
          w.style.opacity = String(k);
          w.style.filter = k < 1 ? `blur(${((1 - k) * 6).toFixed(1)}px)` : "";
          w.style.transform = `translateY(${((1 - k) * 12).toFixed(1)}px)`;
        });
      });

      // beat 2: top page slides out and the stage zooms in; the highlighter sweeps the line
      const pull = span(p, 0.15, 0.27), zoom = span(p, 0.2, 0.33), sweep = span(p, 0.24, 0.34);
      const away = span(p, 0.36, 0.5);
      stack.style.transform = `scale(${mix(1, small ? 1.2 : 1.35, zoom) * mix(1, 0.7, away)})`;
      stack.style.opacity = String(1 - span(p, 0.5, 0.58));
      top.style.transform = `translate(${mix(0, -18, pull)}%, ${mix(0, -4, pull)}%) rotate(${mix(-6, 0, pull)}deg)`;
      hl.style.transform = `scaleX(${sweep})`;

      // beat 3: the line lifts off, flies along a curve to the left and becomes the number
      const fly = span(p, 0.36, 0.5);
      line.style.opacity = String(fly > 0 && fly < 1 ? 1 : 0);
      const fx = small ? mix(0, -10, fly) : mix(0, -80, fly), fy = small ? mix(0, -60, fly) - Math.sin(fly * Math.PI) * 20 : mix(0, 10, fly) - Math.sin(fly * Math.PI) * 60;
      line.style.transform = `translate(${fx}%, ${fy}%) scale(${mix(1, 1.08, Math.sin(fly * Math.PI))})`;
      const show = span(p, 0.45, 0.52);
      num.style.opacity = String(show * (1 - span(p, 0.8, 0.86)));
      num.style.transform = `scale(${mix(0.6, 1, show)})`;
      numText.textContent = kg(922.61 * span(p, 0.45, 0.55, (t) => t));

      // beat 4: peels fall into the pot; the seedling grows at p .62 .68 .74 .80
      pot.style.opacity = String(span(p, 0.5, 0.56) * (1 - span(p, 0.86, 0.92) * 0.6));
      peels.forEach((el, i) => {
        const k = clamp((p - (0.57 + i * 0.05)) / 0.06);
        el.style.opacity = String(k > 0 && k < 1 ? 1 : 0);
        el.style.transform = `translate(${(i - 1.5) * 18}%, ${mix(-240, 0, k * k)}%) rotate(${k * (120 + i * 30)}deg)`;
      });
      const stage = p < 0.62 ? 1 : p < 0.68 ? 2 : p < 0.74 ? 3 : 4;
      if (stage !== lastStage) { (seedling as HTMLImageElement).src = `/props/seedling-${stage}.webp`; lastStage = stage; }
      seedling.style.opacity = String(span(p, 0.58, 0.62));

      // beat 5: everything settles into a promise card; the search tape slides in
      const settle = span(p, 0.82, 0.92);
      card.style.opacity = String(settle);
      card.style.transform = `translateY(${mix(30, 0, settle)}px) rotate(${mix(4, -1, settle)}deg)`;
      search.style.opacity = String(span(p, 0.88, 0.96));
      search.style.transform = `translateX(${mix(-40, 0, span(p, 0.88, 0.96))}px)`;
      search.style.pointerEvents = p > 0.9 ? "auto" : "none";
    });
  }, [reduced]);

  if (reduced) return ( // static panels, same words
    <section className="story-static" aria-label="From a page nobody reads to waste processed at source">
      {BEATS.slice(0, 4).map((b) => <p key={b.text} className="label">{b.text}</p>)}
      <SearchTape />
    </section>
  );

  return (
    <section className="story" ref={section} aria-label="From a page nobody reads to waste processed at source">
      <div className="stage">
        <a className="s-progress" href="#story-end" aria-label="Skip the story">
          <span className="s-fill" /><span className="s-skip hand">skip</span>
        </a>
        <div className="s-text">
          {BEATS.map((b, i) => <p key={i} className="beat">{b.text.split(" ").map((w, j) => <span key={j}>{w} </span>)}</p>)}
        </div>
        <div className="s-stack" aria-hidden="true">
          {[3, 2].map((k) => <div key={k} className="s-page" style={{ "--r": `${k * 3 - 4}deg`, "--o": `${k * 6}px` } as CSSProperties}><Lines n={22} /></div>)}
          <div className="s-page s-top">
            <p className="s-head">Minutes of the SEAC meeting</p>
            <Lines n={9} />
            <p className="s-op">Operation Phase</p>
            <p className="s-quote"><span className="s-hl" />{QUOTE}</p>
            <Lines n={9} />
          </div>
        </div>
        <p className="s-line" aria-hidden="true">{QUOTE}</p>
        <p className="s-num" aria-hidden="true"><b>923</b> kg</p>
        <div className="s-pot" aria-hidden="true">
          <img src="/props/pot.webp" alt="" />
          <img className="s-seedling" src="/props/seedling-1.webp" alt="" />
          {PEELS.map((n) => <img key={n} className="s-peel" src={`/props/${n}.webp`} alt="" />)}
        </div>
        <div className="s-card" aria-hidden="true">
          <b className="s-card-num">923 kg</b>
          <span className="s-card-quote">{QUOTE}</span>
          <span className="hand">✓ Composted on site<br />✓ Recommended for clearance</span>
        </div>
        <div className="s-search">
          {total != null && <p className="hand">{kg(total)} kg a day across Pune, promised in writing.</p>}
          <SearchTape />
        </div>
      </div>
      <span id="story-end" />
    </section>
  );
}

function Lines({ n }: { n: number }) {
  return <>{Array.from({ length: n }, (_, i) => <i key={i} className="s-bar" style={{ width: `${62 + ((i * 37) % 34)}%` }} />)}</>;
}
