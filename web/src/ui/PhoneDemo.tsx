// Home hero: a phone that plays the product on live data (search, results, promise, letter, officer list).
// Every number comes from projects.json; the scenes only animate what the real screens show.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Summary } from "../api";
import { builderName, kg, km, localities, method, placeName } from "../format";
import { inkCircle } from "../map/PuneMap";
import { arrow } from "../rough";
import { InkPath, Stamp } from "./Ink";
import { reducedMotion } from "../motion";
import { t, useLang } from "../i18n";

const PLACE = { title: "Seasons Mall, Hadapsar", lat: 18.5199, lon: 73.9313 }; // Amazon Location's point for this address
const DEMO_ID = "sia-mh-mis-213829-2021"; // hand-checked: 1,056 kg a day, OWC, page 3, 540 m from Seasons Mall
const WARD = "52";
const SCENES = [
  { en: "Type your area", ms: 4400 },
  { en: "See promises near you", ms: 3200 },
  { en: "Open the promise and its page", ms: 4600 },
  { en: "Ask for the plant to run", ms: 6800 },
  { en: "Officers print a check-first list", ms: 5200 },
]; // labels are translated at render time, so switching language relabels the running demo

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;
function Tap({ at }: { at: number }) {
  return <i className="d-tap" style={d(at)} />;
}

export function PhoneDemo({ projects }: { projects?: Summary[] }) {
  useLang();
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useRef(reducedMotion()).current;

  const data = useMemo(() => {
    if (!projects?.length) return null;
    const near = projects.filter((p) => p.decision === "recommended")
      .map((p) => ({ p, d: km(PLACE, p) })).filter((r) => r.d <= 2).sort((a, b) => a.d - b.d);
    const pick = near.find((r) => r.p.id === DEMO_ID) || near.find((r) => r.p.status === "auto" && r.p.quote);
    const ward = projects.filter((p) => p.city === "PCMC" && p.ward === WARD && p.status === "auto" && p.decision === "recommended")
      .sort((a, b) => (b.wet_kg_day || 0) - (a.wet_kg_day || 0) || a.meeting_date.localeCompare(b.meeting_date));
    if (!pick || !ward.length) return null;
    return { count: near.length, near, pick, ward: ward.slice(0, 3) };
  }, [projects]);
  const last = data ? SCENES.length - 1 : 0; // without data only the typing scene can play

  useEffect(() => { // pause while off screen
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || !visible) return;
    const t = setTimeout(() => setI((n) => (n >= last ? 0 : n + 1)), SCENES[i].ms);
    return () => clearTimeout(t);
  }, [i, visible, last, reduced]);

  return (
    <div className={`demo${visible ? "" : " paused"}`} ref={root}>
      <div className="phone" aria-hidden="true">
        <div className="screen" key={i}>
          {i === 0 && <SearchScene />}
          {data && i === 1 && <ResultsScene count={data.count} row={data.pick} near={data.near} />}
          {data && i === 2 && <CardScene p={data.pick.p} />}
          {data && i === 3 && <LetterScene p={data.pick.p} />}
          {data && i === 4 && <OfficerScene rows={data.ward} />}
        </div>
      </div>
      <ol className="demo-steps" aria-label={t("How to use VACHAN on your phone")}>
        {SCENES.map((s, n) => (
          <li key={s.en} className={n === i ? "on" : ""}>
            <button onClick={() => setI(n)} disabled={n > last} aria-current={n === i ? "step" : undefined}>
              <span className="d-n">{n + 1}</span><span className="d-l">{t(s.en)}</span>
              {n === i && !reduced && <span className="d-bar" style={{ "--ms": `${s.ms}ms` } as CSSProperties} />}
            </button>
          </li>
        ))}
      </ol>
      <p className="demo-note hand">{t("Live data, not a mock-up.")}</p>
    </div>
  );
}

function Mast({ children }: { children?: ReactNode }) {
  return <div className="d-mast"><b>VACHAN</b><i lang="mr">वचन</i>{children}</div>;
}

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const TYPE_AT = 0.9, TYPE_FOR = 1.3; // when the address starts typing, and for how long (s)

/** The phone keyboard: slides up on the tap, each key lights as its letter types, slides away on the suggestion. */
function Keyboard() {
  const text = PLACE.title.toLowerCase();
  const flashes = (k: string) => [...text].flatMap((c, n) => (c === k ? [TYPE_AT + (n * TYPE_FOR) / text.length] : []))
    .map((t) => <i key={t} className="d-flash" style={d(t)} />);
  return (
    <div className="d-kbd">
      {KEYS.map((row) => <div key={row} className="d-krow">{[...row].map((k) => <span key={k} className="d-key">{k}{flashes(k)}</span>)}</div>)}
      <div className="d-krow"><span className="d-key space">{flashes(" ")}</span></div>
    </div>
  );
}

function SearchScene() {
  return (
    <div className="d-pad">
      <Mast />
      <p className="d-h1">{t("Did your builder promise to process your society's wet waste?")}</p>
      <div className="d-input">
        <span className="d-typed" style={{ "--n": PLACE.title.length, "--t": `${TYPE_FOR}s`, ...d(TYPE_AT) } as CSSProperties}>{PLACE.title}</span>
        <span className="d-caret" />
        <Tap at={0.4} />
      </div>
      <div className="d-btn">{t("Find the promise")}</div>
      <div className="d-suggest d-in" style={d(2.5)}>
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="var(--leaf)" /><circle cx="12" cy="9.5" r="2.6" fill="var(--label)" /></svg>
        {PLACE.title}, Pune
        <Tap at={3.4} />
      </div>
      <Keyboard />
    </div>
  );
}

/** The promises around the address, drawn in km around the pin: no words, just where and how much. */
function MiniMap({ near, pick }: { near: { p: Summary; d: number }[]; pick: Summary }) {
  const max = Math.max(...near.map((r) => r.p.wet_kg_day || 0), 1);
  const cos = Math.cos((PLACE.lat * Math.PI) / 180);
  return (
    <svg className="d-map" viewBox="-2.3 -2.3 4.6 4.6" aria-hidden="true">
      <InkPath d={inkCircle(0, 0, 2)} color="var(--leaf)" width={0.035} dur={600} />
      {near.map(({ p }, n) => {
        const x = (p.lon - PLACE.lon) * 111 * cos, y = -(p.lat - PLACE.lat) * 111;
        const r = 0.05 + 0.13 * Math.sqrt((p.wet_kg_day || 0) / max);
        return <circle key={p.id} cx={x} cy={y} r={p.id === pick.id ? r * 1.5 : r}
          className={`d-dot${p.status === "review" ? " hollow" : ""}${p.id === pick.id ? " pick" : ""}`} style={d(0.2 + (n % 20) * 0.03)} />;
      })}
      <path d="M0 0c-.08-.12-.12-.18-.12-.25a.12.12 0 1 1 .24 0c0 .07-.04.13-.12.25z" fill="var(--rust)" />
    </svg>
  );
}

function ResultsScene({ count, row, near }: { count: number; row: { p: Summary; d: number }; near: { p: Summary; d: number }[] }) {
  return (
    <div className="d-pad">
      <Mast />
      <div className="d-body">
        <p className="d-h2 d-in" style={d(0.1)}>{count} promises within 2 km</p>
        <MiniMap near={near} pick={row.p} />
        <div className="d-row pick d-in" style={d(0.9)}>
          <b>{kg(row.p.wet_kg_day)} kg a day</b>
          <span>{placeName(row.p)}, {row.d.toFixed(1)} km</span>
          <Tap at={2.3} />
        </div>
        <i className="d-ghost d-in" style={d(1.1)} />
        <i className="d-ghost short d-in" style={d(1.2)} />
      </div>
    </div>
  );
}

function CardScene({ p }: { p: Summary }) {
  const pad = useRef<HTMLDivElement>(null), num = useRef<HTMLParagraphElement>(null), clip = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ w: number; h: number; body: string; head: string } | null>(null);
  useLayoutEffect(() => { // layout offsets, not screen boxes: the phone is rotated
    const measure = () => {
      const n = num.current!, c = clip.current!;
      const from: [number, number] = [c.offsetLeft + c.offsetWidth - 26, c.offsetTop - 4];
      const to: [number, number] = [n.offsetLeft + n.offsetWidth - 14, n.offsetTop + n.offsetHeight + 2];
      setInk({ w: pad.current!.offsetWidth, h: pad.current!.offsetHeight, ...arrow(from, to, 22) });
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);
  return (
    <div className="d-pad" ref={pad}>
      <Mast />
      <p className="d-place">{placeName(p)}</p>
      <p className="d-big" ref={num}><span className="d-hl" style={d(0.5)} />{kg(p.wet_kg_day)} kg</p>
      <p className="d-sub">of wet waste a day</p>
      <p className="d-method">{/biogas/i.test(p.quote || "") ? "Processed" : "Composted"} on site: {short(method(p.quote))}</p>
      <div className="d-clip d-in" style={d(0.9)} ref={clip}>
        <span className="d-sub">Page {p.page}</span>
        <span className="d-quote"><span className="d-hl" style={d(1.4)} />{p.quote}</span>
      </div>
      {ink && <svg className="d-arrow" viewBox={`0 0 ${ink.w} ${ink.h}`}>
        <InkPath d={ink.body} color="var(--leaf)" width={2.2} delay={1800} dur={450} />
        <InkPath d={ink.head} color="var(--leaf)" width={2.2} delay={2250} dur={150} />
      </svg>}
      <div className="d-pot">
        <img className="pot" src="/props/pot.webp" alt="" />
        <img className="sd now" src="/props/seedling-2.webp" alt="" />
        <img className="sd next" src="/props/seedling-3.webp" alt="" />
        {["banana", "eggshell", "onion"].map((n, k) => <img key={n} className="d-peel" src={`/props/${n}.webp`} alt="" style={{ "--x": `${(k - 1) * 16}%`, ...d(2.0 + k * 0.28) } as CSSProperties} />)}
      </div>
      <div className="d-btn d-cta">Ask for the plant to run<Tap at={3.8} /></div>
    </div>
  );
}

function LetterScene({ p }: { p: Summary }) {
  const builder = firstName(builderName(p.builder)) || "the builder";
  return (
    <div className="d-pad">
      <Mast />
      <p className="d-place">{placeName(p)}</p>
      <p className="d-big">{kg(p.wet_kg_day)} kg</p>
      <div className="d-sheet">
        <div className="d-choose d-out" style={d(2.1)}>
          <div className="d-opt on">To: {builder}</div>
          <div className="d-seg"><span className="on">English</span><span lang="mr">मराठी</span></div>
          <div className="d-btn">Write my letter<Tap at={1.5} /></div>
        </div>
        <div className="d-letter d-in" style={d(2.3)}>
          <div className="d-paper sent">
            <p>To: {builder}</p>
            <p className="d-quote">“{p.quote}” (page {p.page})</p>
            {[92, 80, 88, 70, 90, 76, 52].map((w, n) => <i key={n} className="d-line" style={{ width: `${w}%`, ...d(2.4 + n * 0.12) }} />)}
          </div>
          <div className="d-bubble">“{p.quote}” (page {p.page})<span className="ticks">✓✓</span></div>
          <div className="d-btn">Send on WhatsApp<Tap at={4.9} /></div>
        </div>
      </div>
    </div>
  );
}

function OfficerScene({ rows }: { rows: Summary[] }) {
  return (
    <div className="d-pad">
      <Mast><span className="d-navon">Ward officers</span></Mast>
      <div className="d-body">
        <p className="d-ward d-in" style={d(0.1)}>Ward {WARD}<span className="hand">check first</span></p>
        {rows.map((p, n) => (
          <div key={p.id} className="d-led d-in" style={d(0.4 + n * 0.25)}>
            <span className="hand">{n + 1}</span>
            <span>{area(p)}</span>
            <b>{kg(p.wet_kg_day)} kg</b>
          </div>
        ))}
      </div>
      <div className="d-btn">Print this list<Tap at={2.7} /></div>
      <span className="d-stamp"><Stamp lines={[t("Printed")]} shape="box" rotate={-10} delay={3000} /></span>
    </div>
  );
}

/** "Pandhare Wasti, Punawale, Pune" -> "Punawale": the locality alone, for short rows. */
function area(p: Summary) {
  return localities(p.village).at(-1) || placeName(p);
}
/** "Organic waste converter (OWC)" -> "OWC"; other methods stay as they are. */
function short(m: string | null) {
  if (!m) return "on site";
  return m.match(/\((\w+)\)$/)?.[1] || m;
}
/** "Kumar Agro Products Pvt. Ltd. - Kumar Construction ... JV" -> "Kumar Agro Products". */
function firstName(b: string) {
  return b.split(/\s+-\s+|,/)[0].replace(/\s*(pvt\.?|private|ltd\.?|limited|llp)\b.*$/i, "").trim();
}
