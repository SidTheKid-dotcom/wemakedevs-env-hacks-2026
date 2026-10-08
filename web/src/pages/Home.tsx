// Home (SPEC 5.2): what VACHAN is in one sentence, the Pune total, search, the map, the scroll story.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getProjects, getStats, suggestPlaces, type Summary } from "../api";
import { kg, km, method, placeName, shortDate, title } from "../format";
import { PuneMap } from "../map/PuneMap";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { InkPath } from "../ui/Ink";
import { Empty, ErrorState, Masthead } from "../ui/Parts";
import { roughLine } from "../rough";
import { goToPlace, matchProjects, SearchTape } from "./Search";
import { Story } from "./Story";

const EXAMPLES: { label: string; q?: string; place?: string }[] = [
  { label: "Punawale", q: "Punawale" }, { label: "Hadapsar", q: "Hadapsar" }, { label: "Seasons Mall", place: "Seasons Mall, Hadapsar, Pune" },
];
const STEPS = [
  { t: "Fetched every night", to: "/how#fetch", icon: "M6 4h9l4 4v12H6z M9 10h7 M9 13h7 M9 16h5" },
  { t: "Read by Amazon Bedrock", to: "/how#read", icon: "M5 4h14v16H5z M8 8h8 M8 11h8 M8 14h5" },
  { t: "Every quote checked against the government PDF", to: "/how#check", icon: "M5 4h11v16H5z M8 8h5 M8 11h5 M17 14a3 3 0 1 1-.1 0 M19 17l3 3" },
  { t: "You act", to: "/how#data", icon: "M4 20h16 M7 20V9h6v11 M15 20v-6h3v6 M9 12h2 M9 15h2" },
];

export default function Home() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { hash } = useLocation();
  const stats = useLoad(getStats, []);
  const projects = useLoad(getProjects, []);
  const near = params.get("near")?.split(",").map(Number);
  const focus = near && near.length === 2 ? { lat: near[0], lon: near[1] } : null;
  const q = params.get("q");
  const [radius, setRadius] = useState(2);
  useEffect(() => { setRadius(2); }, [params]);
  useEffect(() => { document.title = "VACHAN: read the fine print before you pay the fine"; }, []);
  useEffect(() => { if (hash === "#near") document.getElementById("near")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [hash, params]);

  const example = async (e: (typeof EXAMPLES)[number]) => {
    if (e.q) return nav(`/?q=${encodeURIComponent(e.q)}#near`);
    const [first] = await suggestPlaces(e.place!).catch(() => []);
    if (first) await goToPlace(first, nav);
  };

  return (
    <Desk props="home">
      <Masthead />
      <section className="hero">
        <div className="hero-text">
          {stats.data ? <div className="total label">
            <p>Wet waste promised in writing, Pune: <b>{kg(stats.data.wet_kg_day_total)} kg a day</b></p>
            <p className="total-sub">{stats.data.counted_projects} projects checked, {stats.data.review_count} waiting for a person · as of {shortDate(stats.data.published_at.slice(0, 10))} ·{" "}
              <Link className="ink" to="/how#data">how we count</Link></p>
          </div> : !stats.error && <p className="total label sub">Pune total is loading…</p>}
          <h1 className="headline">Read the fine print before you pay the fine.</h1>
          <p className="lede">Pune's large housing projects promised the government, in writing, to process their own wet waste on site. VACHAN finds that promise for your building, and the page it is written on.</p>
          <div id="search"><SearchTape value={q || params.get("label") || ""} autoFocus={hash === "#search"} /></div>
          <p className="hand try">try {EXAMPLES.map((e, i) => <span key={e.label}>
            <button className="ink hand linkish" onClick={() => example(e)}>{e.label}</button>{i < EXAMPLES.length - 2 ? ", " : i === EXAMPLES.length - 2 ? " or " : ""}
          </span>)}, or <Link className="ink hand" to="/p/sia-mh-mis-277145-2022">see an example promise →</Link></p>
        </div>
        <div className="hero-map">
          {projects.data ? <PuneMap points={projects.data} focus={focus} radiusKm={radius} />
            : projects.error ? <ErrorState title="The map did not load." detail="Search still works." retry={projects.retry} />
              : <div className="map skeleton-map" aria-hidden="true" />}
        </div>
      </section>

      {(focus || q) && projects.data && <Results all={projects.data} focus={focus} q={q} label={params.get("label")} radius={radius} setRadius={setRadius} />}

      <ol className="strip" aria-label="How it works">
        {STEPS.map((s, i) => (
          <li key={s.t}>
            <Link to={s.to} className="step">
              <svg viewBox="0 0 24 24" aria-hidden="true"><InkPath d={s.icon} width={1.3} play={false} /></svg>
              <span className="label">{s.t}</span>
            </Link>
            {i < STEPS.length - 1 && <svg className="step-arrow" viewBox="0 0 40 20" aria-hidden="true"><InkPath d={roughLine([2, 10], [36, 10], i + 3)} width={2} play={false} /><path d="M28 4l8 6-8 6" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" /></svg>}
          </li>
        ))}
      </ol>

      <Story total={stats.data?.wet_kg_day_total} />
      <footer className="foot-note sub">
        Source: SEAC minutes on PARIVESH{stats.data && `, newest meeting ${shortDate(stats.data.newest_meeting_date)}`}. A promise is not proof that a plant was built or runs. <Link className="ink" to="/how">How it works</Link>
      </footer>
    </Desk>
  );
}

function Results({ all, focus, q, label, radius, setRadius }: {
  all: Summary[]; focus: { lat: number; lon: number } | null; q: string | null; label: string | null; radius: number; setRadius: (r: number) => void;
}) {
  const rows = useMemo(() => focus
    ? all.filter((p) => p.decision === "recommended").map((p) => ({ p, d: km(focus, p) })).filter((r) => r.d <= radius).sort((a, b) => a.d - b.d)
    : matchProjects(all, q || "", 60).map((p) => ({ p, d: null as number | null })), [all, focus, q, radius]);
  const [hover, setHover] = useState<string | null>(null);
  const heading = focus ? `${rows.length} ${rows.length === 1 ? "promise" : "promises"} within ${radius} km` : `${rows.length} projects matching “${title(q || "")}”`;

  return (
    <section className="results" id="near" aria-live="polite">
      <div className="results-map">{focus && <PuneMap points={rows.map((r) => r.p)} focus={focus} radiusKm={radius} highlight={hover} label={`Promises near ${label}`} />}</div>
      <div className="results-list">
        <h2>{heading}</h2>
        {focus && label && <p className="sub">around {label}</p>}
        {rows.length === 0 ? (focus
          ? <Empty title={`No written promises within ${radius} km of this address.`}>{radius < 5 && <button className="btn" onClick={() => setRadius(5)}>Search 5 km</button>}</Empty>
          : <Empty title="No projects match this search." />)
          : <ul className="rows">
            {rows.slice(0, 40).map(({ p, d }, i) => (
              <li key={p.id} className="fade-in" style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as React.CSSProperties}
                onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                <Link to={`/p/${p.id}`} className="row">
                  <b className={p.status === "review" ? "pencil" : ""}>{kg(p.wet_kg_day)} kg a day</b>
                  <span>{placeName(p)}</span>
                  <span className="sub">{[d != null && `${d.toFixed(1)} km`, method(p.quote), p.status === "review" && "a person must check"].filter(Boolean).join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>}
      </div>
    </section>
  );
}
