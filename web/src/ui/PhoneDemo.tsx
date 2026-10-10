// Home hero: a phone that plays the product on live data (search, results, promise, letter, officer list).
// Every number comes from projects.json; the scenes only animate what the real screens show.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Summary } from "../api";
import { builderName, kg, km, method, placeName } from "../format";
import { reducedMotion } from "../motion";

const PLACE = { title: "Seasons Mall, Hadapsar", lat: 18.5199, lon: 73.9313 }; // Amazon Location's point for this address
const DEMO_ID = "sia-mh-mis-213829-2021"; // hand-checked: 1,056 kg a day, OWC, page 3, 540 m from Seasons Mall
const WARD = "52";
const SCENES = [
  { label: "Type your area", ms: 4400 },
  { label: "See the written promises near you", ms: 3800 },
  { label: "Open one: kg a day, and the page it is on", ms: 4600 },
  { label: "Ask for the plant to run, in English or मराठी", ms: 6200 },
  { label: "Ward officers: print a check-first list", ms: 5400 },
];

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;
function Tap({ at }: { at: number }) {
  return <i className="d-tap" style={d(at)} />;
}

export function PhoneDemo({ projects }: { projects?: Summary[] }) {
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
    const rows = [pick, ...near.filter((r) => r !== pick)].slice(0, 3).sort((a, b) => a.d - b.d);
    return { count: near.length, rows, pick: pick.p, ward: ward.slice(0, 3) };
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
          {data && i === 1 && <ResultsScene count={data.count} rows={data.rows} pick={data.pick.id} />}
          {data && i === 2 && <CardScene p={data.pick} />}
          {data && i === 3 && <LetterScene p={data.pick} />}
          {data && i === 4 && <OfficerScene rows={data.ward} />}
        </div>
      </div>
      <ol className="demo-steps" aria-label="How to use VACHAN on your phone">
        {SCENES.map((s, n) => (
          <li key={s.label} className={n === i ? "on" : ""}>
            <button onClick={() => setI(n)} disabled={n > last} aria-current={n === i ? "step" : undefined}>
              <span className="d-n">{n + 1}</span><span className="d-l">{s.label}</span>
              {n === i && !reduced && <span className="d-bar" style={{ "--ms": `${s.ms}ms` } as CSSProperties} />}
            </button>
          </li>
        ))}
      </ol>
      <p className="demo-note hand">Real projects from the live data, not a mock-up.</p>
    </div>
  );
}

function Mast({ children }: { children?: ReactNode }) {
  return <div className="d-mast"><b>VACHAN</b><i lang="mr">वचन</i>{children}</div>;
}

function SearchScene() {
  return (
    <div className="d-pad">
      <Mast />
      <p className="d-tag">Read the fine print before you pay the fine.</p>
      <p className="d-h1">Did your builder promise to process your society's wet waste?</p>
      <div className="d-input">
        <span className="d-typed" style={{ "--n": PLACE.title.length, ...d(0.9) } as CSSProperties}>{PLACE.title}</span>
        <span className="d-caret" />
        <Tap at={0.4} />
      </div>
      <div className="d-btn">Find the promise</div>
      <div className="d-suggest d-in" style={d(2.5)}>
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="var(--leaf)" /><circle cx="12" cy="9.5" r="2.6" fill="var(--label)" /></svg>
        {PLACE.title}, Pune
        <Tap at={3.4} />
      </div>
    </div>
  );
}

function ResultsScene({ count, rows, pick }: { count: number; rows: { p: Summary; d: number }[]; pick: string }) {
  return (
    <div className="d-pad">
      <Mast />
      <p className="d-h2 d-in" style={d(0.1)}>{count} promises within 2 km</p>
      <p className="d-sub d-in" style={d(0.2)}>around {PLACE.title}</p>
      {rows.map(({ p, d: dist }, n) => (
        <div key={p.id} className={`d-row d-in${p.id === pick ? " pick" : ""}`} style={d(0.5 + n * 0.25)}>
          <b className={p.status === "review" ? "pencil" : ""}>{kg(p.wet_kg_day)} kg a day</b>
          <span>{placeName(p)}</span>
          <span className="d-sub">{[`${dist.toFixed(1)} km`, method(p.quote)].filter(Boolean).join(", ")}</span>
          {p.id === pick && <Tap at={2.9} />}
        </div>
      ))}
    </div>
  );
}

function CardScene({ p }: { p: Summary }) {
  return (
    <div className="d-pad d-card">
      <Mast />
      <p className="d-kick">What the builder promised in writing</p>
      <p className="d-place">{placeName(p)}</p>
      <p className="d-big"><span className="d-hl" style={d(0.5)} />{kg(p.wet_kg_day)} kg</p>
      <p className="d-sub">of wet waste a day, promised to be processed on site:</p>
      <p className="d-method">{method(p.quote) || "on site"}</p>
      <div className="d-clip d-in" style={d(0.9)}>
        <span className="d-sub">SEAC minutes, page {p.page}</span>
        <span className="d-quote"><span className="d-hl" style={d(1.4)} />{p.quote}</span>
      </div>
      <p className="d-tick d-in" style={d(2.1)}>✓ Found word for word on page {p.page}</p>
      <p className="d-tick d-in" style={d(2.4)}>✓ Recommended for clearance</p>
      <div className="d-actions">
        <div className="d-btn">Ask for the plant to run<Tap at={3.8} /></div>
        <div className="d-btn ghost">Send to my society group</div>
      </div>
    </div>
  );
}

function LetterScene({ p }: { p: Summary }) {
  const builder = builderName(p.builder);
  return (
    <div className="d-pad d-card">
      <Mast />
      <p className="d-place">{placeName(p)}</p>
      <p className="d-big">{kg(p.wet_kg_day)} kg</p>
      <div className="d-sheet">
        <div className="d-choose d-out" style={d(2.1)}>
          <p className="d-h2">Who should get this letter?</p>
          <div className="d-opt on">{builder || "The builder"}, the builder</div>
          <div className="d-opt">{p.city} ward office</div>
          <div className="d-seg"><span className="on">English</span><span lang="mr">मराठी</span></div>
          <div className="d-btn">Write my letter<Tap at={1.5} /></div>
        </div>
        <div className="d-letter d-in" style={d(2.3)}>
          <p className="d-h2">Your letter</p>
          <div className="d-paper">
            <p>To: {builder || "the builder"}</p>
            <p>Subject: the wet-waste plant promised in writing</p>
            <p className="d-quote">“{p.quote}” (page {p.page})</p>
            {[92, 80, 88, 64].map((w, n) => <i key={n} className="d-line" style={{ width: `${w}%`, ...d(2.8 + n * 0.35) }} />)}
          </div>
          <div className="d-actions">
            <div className="d-btn">Copy letter</div>
            <div className="d-btn ghost">Send on WhatsApp<Tap at={5.0} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfficerScene({ rows }: { rows: Summary[] }) {
  return (
    <div className="d-pad">
      <Mast><span className="d-navon">Ward officers</span></Mast>
      <p className="d-h2 d-in" style={d(0.1)}>Ward {WARD}: which projects to check first</p>
      <p className="d-sub d-in" style={d(0.2)}>A list to plan visits, not a verdict.</p>
      {rows.map((p, n) => (
        <div key={p.id} className="d-led d-in" style={d(0.5 + n * 0.25)}>
          <span className="hand">{n + 1}</span>
          <span>{placeName(p)}</span>
          <b>{kg(p.wet_kg_day)} kg</b>
        </div>
      ))}
      <div className="d-btn">Print this list<Tap at={2.9} /></div>
      <div className="d-print">
        <p><b>Check first: PCMC ward {WARD}</b></p>
        {rows.map((p, n) => <p key={p.id}>{n + 1}. {placeName(p)}, {kg(p.wet_kg_day)} kg, page {p.page}</p>)}
      </div>
    </div>
  );
}
