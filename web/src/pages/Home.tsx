// Home: what VACHAN is and what to do, in one screen; then problem to impact, who it is for, the map, the story.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getProjects, getStats, suggestPlaces, type Stats, type Summary } from "../api";
import { kg, km, method, placeName, shortDate, title, tonnes } from "../format";
import { PuneMap } from "../map/PuneMap";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { PhoneDemo } from "../ui/PhoneDemo";
import { Empty, ErrorState, Masthead } from "../ui/Parts";
import { goToPlace, matchProjects, SearchTape } from "./Search";
import { Story } from "./Story";

const EXAMPLES: { label: string; q?: string; place?: string }[] = [
  { label: "Punawale", q: "Punawale" }, { label: "Hadapsar", q: "Hadapsar" }, { label: "Seasons Mall", place: "Seasons Mall, Hadapsar, Pune" },
];
const EXAMPLE_ID = "sia-mh-mis-277145-2022";
const PMC_SOURCE = "https://www.thebridgechronicle.com/pune/punes-wet-waste-crisis-deepens-as-processing-capacity-falls-short-agn97";
const PCMC_SOURCE = "https://www.punekarnews.in/pcmcs-major-decision-wet-waste-from-large-housing-societies-will-not-be-collected-from-july-1/";

/** Focus the hero search (used by "Find your building's promise" and the Residents link). */
function focusSearch() {
  const box = document.getElementById("search");
  box?.scrollIntoView({ behavior: "smooth", block: "center" });
  box?.querySelector("input")?.focus({ preventScroll: true });
}

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
  useEffect(() => { document.title = "VACHAN: find your builder's written promise to process wet waste"; }, []);
  useEffect(() => {
    if (hash === "#near") document.getElementById("near")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (hash === "#search") focusSearch();
  }, [hash, params]);

  const example = async (e: (typeof EXAMPLES)[number]) => {
    if (e.q) return nav(`/?q=${encodeURIComponent(e.q)}#near`);
    const [first] = await suggestPlaces(e.place!).catch(() => []);
    if (first) await goToPlace(first, nav);
  };
  const s = stats.data;

  return (
    <Desk props="home">
      <Masthead />
      <section className="hero">
        <div className="hero-text">
          <p className="tagline">Read the fine print before you pay the fine.</p>
          <h1 className="headline">Did your builder promise to process your society's wet waste?</h1>
          <p className="lede">
            {s ? `${s.owc_projects} of the ${s.counted_projects} Pune projects recommended for clearance did, in writing.` : "Pune's large housing projects did, in writing."}{" "}
            Find the promise and its page. Then ask for the plant to run.
          </p>
          <div id="search"><SearchTape cta="Find the promise" value={q || params.get("label") || ""} /></div>
          <p className="hand try">try {EXAMPLES.map((e, i) => <span key={e.label}>
            <button className="ink hand linkish" onClick={() => example(e)}>{e.label}</button>{i < EXAMPLES.length - 2 ? ", " : i === EXAMPLES.length - 2 ? " or " : ""}
          </span>)}</p>
          <p className="away">Not from Pune? <Link className="ink" to={`/p/${EXAMPLE_ID}`}>See a real promise</Link></p>
        </div>
        <div className="hero-demo"><PhoneDemo projects={projects.data} /></div>
      </section>

      {(focus || q) && projects.data && <Results all={projects.data} focus={focus} q={q} label={params.get("label")} radius={radius} setRadius={setRadius} />}

      <Chain s={s} />
      <Paths />

      <section className="atlas">
        <div className="atlas-text">
          <h2>Every dot is a written promise</h2>
          <p>{s ? `${s.projects} housing project sites` : "Housing project sites"} in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.</p>
          {s?.quotes_verified != null && <p className="label proof">{s.quotes_verified} of {s.quotes_checked} quotes re-checked against the live government PDF after the last run, {shortDate(s.published_at.slice(0, 10))}.</p>}
          <Link className="ink" to="/how">How we find and check each promise</Link>
        </div>
        <div className="atlas-map">
          {projects.data ? <PuneMap points={projects.data} focus={null} />
            : projects.error ? <ErrorState title="The map did not load." detail="Search still works." retry={projects.retry} />
              : <div className="map skeleton-map" aria-hidden="true" />}
        </div>
      </section>

      <Story total={s?.wet_kg_day_total} />
      <footer className="foot-note sub">
        Source: SEAC minutes on PARIVESH{s && `, newest meeting ${shortDate(s.newest_meeting_date)}`}. A promise is not proof that a plant was built or runs. <Link className="ink" to="/how">How it works</Link>
      </footer>
    </Desk>
  );
}

/** Problem, solution, how, outcome, impact: one sequence, joined by drawn arrows. */
function Chain({ s }: { s?: Stats }) {
  return (
    <section className="chain" aria-labelledby="chain-h">
      <h2 id="chain-h" className="sr-only">From the problem to the impact</h2>
      <ol>
        <li className="link problem">
          <span className="hand cue">The problem</span>
          <p className="fig">300 t</p>
          <p>of wet waste a day goes from Pune's housing societies and malls to city plants, says <a className="ink" href={PMC_SOURCE} target="_blank" rel="noreferrer">PMC</a>.</p>
          <p className="sub">In Pimpri-Chinchwad, <a className="ink" href={PCMC_SOURCE} target="_blank" rel="noreferrer">notices</a> set fines for large societies that don't process their own.</p>
        </li>
        <li className="link">
          <span className="hand cue">The solution</span>
          <p className="say">The builder already promised to fix it.</p>
          <p>To get environmental clearance, each large project promised in writing to process its wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.</p>
        </li>
        <li className="link">
          <span className="hand cue">How</span>
          <ol className="mini-steps">
            <li>Search your area</li>
            <li>See the promise and its page</li>
            <li>Ask for the plant to run</li>
          </ol>
        </li>
        <li className="link">
          <span className="hand cue">The outcome</span>
          <p className="say">A letter that quotes the builder's own promise.</p>
          <p>It goes to the builder or the ward office, with the page. Ward officers get a list of whom to check first.</p>
        </li>
        <li className="link impact">
          <span className="hand cue">The impact</span>
          <p className="fig">{s ? `${tonnes(s.wet_kg_day_total)} t` : "…"}</p>
          <p>of wet waste a day, promised in writing to be processed on site across Pune. Every plant that runs keeps that waste where it is made, off the trucks to Moshi and Hadapsar.</p>
        </li>
      </ol>
    </section>
  );
}

/** The two people who use VACHAN, side by side. */
function Paths() {
  return (
    <section className="paths" aria-label="Who VACHAN is for">
      <div className="path">
        <h2>For residents and flat buyers</h2>
        <p className="sub">Your society got a wet-waste notice, or you are about to buy a flat.</p>
        <ul className="ticks-list">
          <li>See what your builder promised in writing, and the page</li>
          <li>Send a letter asking for the plant to run</li>
          <li>Share it with your society group</li>
        </ul>
        <button className="btn" onClick={focusSearch}>Find your building's promise</button>
      </div>
      <div className="path officer-path">
        <h2>For ward officers</h2>
        <p className="sub">PCMC is surveying about 1,155 large waste generators. Where do you start?</p>
        <ul className="ticks-list">
          <li>A list for your ward, biggest written promises first</li>
          <li>Each row links to its page in the minutes</li>
          <li>Print it for field visits. It plans visits; it is not a verdict.</li>
        </ul>
        <Link className="btn ghost" to="/officer">Open the ward list</Link>
      </div>
    </section>
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
        {rows.length > 0 && <p className="hand pick-one">Open one to see the page and ask for the plant to run.</p>}
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

