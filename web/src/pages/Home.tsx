// Home: what VACHAN is and what to do, in one screen; then problem to impact, who it is for, the map, one closing search.
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
import { t, t2, tl, useLang } from "../i18n";

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
  useLang();
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
          <p className="tagline">{t("Read the fine print before you pay the fine.")}</p>
          <h1 className="headline">{t("Did your builder promise to process your society's wet waste?")}</h1>
          <p className="lede">
            {s ? t2("{owc} of the {total} Pune projects recommended for clearance did, in writing.", { owc: s.owc_projects, total: s.counted_projects }) : t("Pune's large housing projects did, in writing.")}{" "}
            {t("Find the promise and its page. Then ask for the plant to run.")}
          </p>
          <div id="search"><SearchTape cta={t("Find the promise")} value={q || params.get("label") || ""} /></div>
          <p className="hand try">{t("try")} {EXAMPLES.map((e, i) => <span key={e.label}>
            <button className="ink hand linkish" onClick={() => example(e)}>{t(e.label)}</button>{i < EXAMPLES.length - 2 ? ", " : i === EXAMPLES.length - 2 ? ` ${t("or")} ` : ""}
          </span>)}</p>
          <p className="away">{t("Not from Pune?")} <Link className="ink hand" to={`/p/${EXAMPLE_ID}`}>{t("See a real promise")}</Link></p>
          {s?.quotes_verified != null && s.quotes_checked != null && <p className="label proof hero-proof">{t2("{v} of {c} quotes re-checked against the government PDF.", { v: s.quotes_verified, c: s.quotes_checked })}</p>}
        </div>
        <div className="hero-demo"><PhoneDemo projects={projects.data} /></div>
      </section>

      {(focus || q) && projects.data && <Results all={projects.data} focus={focus} q={q} label={params.get("label")} radius={radius} setRadius={setRadius} />}

      <Chain s={s} />
      <Paths />

      <section className="atlas">
        <div className="atlas-text">
          <h2>{t("Every dot is a written promise")}</h2>
          <p>{s ? t2("{n} housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.", { n: s.projects }) : t("Housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.")}</p>
          <Link className="ink hand" to="/how">{t("How we find and check each promise")}</Link>
        </div>
        <div className="atlas-map">
          {projects.data ? <PuneMap points={projects.data} focus={null} />
            : projects.error ? <ErrorState title={t("The map did not load.")} detail={t("Search still works.")} retry={projects.retry} />
              : <div className="map skeleton-map" aria-hidden="true" />}
        </div>
      </section>

      <section className="closing">
        <h2>{t("Is your society's wet waste processing unit actually working?")}</h2>
        <p className="lede">{t("Find what your builder promised in writing, and the page it is on.")}</p>
        <SearchTape cta={t("Find the promise")} />
      </section>
      <footer className="foot-note sub">
        {s ? t2("Source: SEAC minutes on PARIVESH, newest meeting {date}.", { date: shortDate(s.newest_meeting_date) }) : t("Source: SEAC minutes on PARIVESH.")} {t("A promise is not proof that a plant was built or runs.")} <Link className="ink hand" to="/how">{t("How it works")}</Link>
      </footer>
    </Desk>
  );
}

/** Problem, solution, how, outcome, impact: one sequence, joined by drawn arrows. */
function Chain({ s }: { s?: Stats }) {
  return (
    <section className="chain" aria-labelledby="chain-h">
      <h2 id="chain-h" className="sr-only">{t("From the problem to the impact")}</h2>
      <ol>
        <li className="link problem">
          <span className="hand cue">{t("The problem")}</span>
          <p className="fig">300 t</p>
          <p>{tl("of wet waste a day goes from Pune's housing societies and malls to city plants, says {pmc}.", { pmc: <a className="ink hand" href={PMC_SOURCE} target="_blank" rel="noreferrer">PMC</a> })}</p>
          <p className="sub">{tl("In Pimpri-Chinchwad, {notices} set fines for large societies that don't process their own.", { notices: <a className="ink hand" href={PCMC_SOURCE} target="_blank" rel="noreferrer">{t("notices")}</a> })}</p>
        </li>
        <li className="link">
          <span className="hand cue">{t("The solution")}</span>
          <p className="say">{t("Who is keeping the promise?")}</p>
          <p>{s ? t2("To get environmental clearance, {owc} of the {total} Pune projects promised in writing to process their wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.", { owc: s.owc_projects, total: s.counted_projects }) : t("To get environmental clearance, each large project promised in writing to process its wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.")}</p>
        </li>
        <li className="link">
          <span className="hand cue">{t("How")}</span>
          <ol className="mini-steps">
            <li>{t("Search your area")}</li>
            <li>{t("See the promise and its page")}</li>
            <li>{t("Ask for the plant to run")}</li>
          </ol>
        </li>
        <li className="link">
          <span className="hand cue">{t("The outcome")}</span>
          <p className="say">{t("A letter that quotes the builder's own promise.")}</p>
          <p>{t("It goes to the builder or the ward office, with the page. Ward officers get a list of whom to check first.")}</p>
        </li>
        <li className="link impact">
          <span className="hand cue">{t("The impact")}</span>
          <p className="fig">{s ? `${tonnes(s.wet_kg_day_total)} t` : "…"}</p>
          <p>{t("of wet waste a day, promised in writing to be processed on site across Pune. Every plant that runs keeps that waste where it is made, instead of on trucks to the city's dumping grounds and waste plants.")}</p>
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
        <h2>{t("For residents and flat buyers")}</h2>
        <p className="sub">{t("Your society got a wet-waste notice, or you are about to buy a flat.")}</p>
        <ul className="ticks-list">
          <li>{t("See what your builder promised in writing, and the page")}</li>
          <li>{t("Send a letter asking for the plant to run")}</li>
          <li>{t("Share it with your society group")}</li>
        </ul>
        <button className="btn" onClick={focusSearch}>{t("Find your building's promise")}</button>
      </div>
      <div className="path officer-path">
        <h2>{t("For ward officers")}</h2>
        <p className="sub">{t("PCMC is surveying about 1,155 large waste generators. Where do you start?")}</p>
        <ul className="ticks-list">
          <li>{t("A list for your ward, biggest written promises first")}</li>
          <li>{t("Each row links to its page in the minutes")}</li>
          <li>{t("Print it for field visits.")}</li>
        </ul>
        <Link className="btn ghost" to="/officer">{t("Open the ward list")}</Link>
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
  const heading = focus ? t2(rows.length === 1 ? "{n} promise within {r} km" : "{n} promises within {r} km", { n: rows.length, r: radius })
    : t2("{n} projects matching “{q}”", { n: rows.length, q: title(q || "") });

  return (
    <section className="results" id="near" aria-live="polite">
      <div className="results-map">{focus && <PuneMap points={rows.map((r) => r.p)} focus={focus} radiusKm={radius} highlight={hover} label={`Promises near ${label}`} />}</div>
      <div className="results-list">
        <h2>{heading}</h2>
        {focus && label && <p className="sub">{t2("around {place}", { place: label })}</p>}
        {rows.length > 0 && <p className="hand pick-one">{t("Open one to see the page and ask for the plant to run.")}</p>}
        {rows.length === 0 ? (focus
          ? <Empty title={t2("No written promises within {r} km of this address.", { r: radius })}>{radius < 5 && <button className="btn" onClick={() => setRadius(5)}>{t("Search 5 km")}</button>}</Empty>
          : <Empty title={t("No projects match this search.")} />)
          : <ul className="rows">
            {rows.slice(0, 40).map(({ p, d }, i) => (
              <li key={p.id} className="fade-in" style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as React.CSSProperties}
                onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                <Link to={`/p/${p.id}`} className="row">
                  <b className={p.status === "review" ? "pencil" : ""}>{kg(p.wet_kg_day)} {t("kg a day")}</b>
                  <span data-data>{placeName(p)}</span>
                  <span className="sub">{[d != null && `${d.toFixed(1)} km`, method(p.quote), p.status === "review" && t("a person must check")].filter(Boolean).join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>}
      </div>
    </section>
  );
}

