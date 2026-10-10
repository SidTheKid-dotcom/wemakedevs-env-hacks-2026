// One written promise: how much wet waste, how it is processed, the page it is on, what to do (SPEC 5.1, 6.2).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { getProject, pdfUrl, type Project } from "../api";
import { builderName, builderSlug, cityName, kg, longDate, method, placeName, tonnesAYear } from "../format";
import { easeOut, onFrame, reducedMotion } from "../motion";
import { arrow } from "../rough";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { Burst, Highlight, InkPath, Stamp, Tick, Underline, Washi } from "../ui/Ink";
import { ErrorState, Loading, Masthead } from "../ui/Parts";
import { SearchTape } from "./Search";
import { LetterSheet } from "./Letter";
import { ShareSheet } from "./Share";
import { PdfPeek } from "../ui/PdfPeek";

export default function PromisePage() {
  const { id = "" } = useParams();
  const { data: p, error, retry } = useLoad(() => getProject(id), [id]);
  useEffect(() => { if (p) document.title = `${kg(p.wet_kg_day)} kg of wet waste a day: ${placeName(p)} | VACHAN`; }, [p]);
  return (
    <Desk props="card">
      <Masthead search />
      {p ? <Card p={p} key={p.id} />
        : error?.status === 403 || error?.status === 404
          ? <div className="state"><h2>No promise with this link.</h2><p className="sub">Search for a project or address.</p><SearchTape /></div>
          : error ? <ErrorState title="The promise did not load." detail="The data server did not answer." retry={retry} />
            : <Loading />}
    </Desk>
  );
}

/** Counts 0 → n over 500 ms (tabular figures, so the width does not jump). */
function CountUp({ n, play }: { n: number; play: boolean }) {
  const [v, setV] = useState(play ? 0 : n);
  useEffect(() => {
    if (!play) return;
    let t0 = 0;
    const stop = onFrame((t) => {
      t0 ||= t;
      const k = Math.min(1, (t - t0) / 500);
      setV(Math.round(n * easeOut(k)));
      if (k === 1) stop();
    });
    return stop;
  }, [n, play]);
  return <>{kg(v)}</>;
}

function checkLabel(p: Project, name: string, pass: boolean) {
  const perFlat = p.wet_kg_day && p.tenements ? (p.wet_kg_day / p.tenements).toFixed(1) : null;
  switch (name) {
    case "found_in_minutes": return pass ? "Found word for word in the minutes" : "Could not find this figure word for word";
    case "operation_phase": return pass ? "Operation phase, not construction" : "Could not tell the operation phase from construction";
    case "kg_per_flat": return pass ? `${perFlat} kg a flat a day, in the usual range` : `${perFlat} kg a flat a day, outside 0.5 to 3`;
    case "decision_known": return p.decision === "recommended" ? "Recommended for clearance" : pass ? `Committee decision: ${p.decision?.replace("_", " ")}` : "Could not read the committee's decision";
    case "owc_capacity": return pass ? "Plant capacity covers the promised waste" : "Stated plant capacity is below the promised waste";
    default: return name;
  }
}

function Card({ p }: { p: Project }) {
  const review = p.status === "review";
  const play = useRef(!reducedMotion() && !sessionStorage.getItem(`seen:${p.id}`)).current;
  useEffect(() => { try { sessionStorage.setItem(`seen:${p.id}`, "1"); } catch { /* private mode */ } }, [p.id]);
  const [sheet, setSheet] = useState<"letter" | "share" | "peek" | null>(null);
  const m = method(p.owc_quote);
  const found = p.checks.find((c) => c.name === "found_in_minutes")?.pass;
  const opPhase = p.checks.find((c) => c.name === "operation_phase")?.pass;
  const builder = builderName(p.builder);
  const t = play ? 1 : 0; // multiply delays by 0 when the moment was already seen

  return (
    <article className={`card${review ? " review" : ""}`}>
      <div className="card-left">
        {!review && <p className="kicker hand">What the builder promised in writing</p>}
        <h1 className="place">{placeName(p)}</h1>
        <p className="sub city-line">{cityName(p.city)}, ward {p.ward}</p>
        <a className="number" id="num" href={pdfUrl(p)} target="_blank" rel="noreferrer"
          aria-label={`${kg(p.wet_kg_day)} kilograms of wet waste a day, ${review ? "as read by machine" : "promised in writing"}. Opens the PDF page.`}>
          <span className={`big${review ? " pencil" : ""}`}>
            {!review && <span className="num-hl" aria-hidden="true" />}
            <CountUp n={Math.round(p.wet_kg_day || 0)} play={play} /> kg{review && <sup className="q">?</sup>}
          </span>
          {!review && <Burst delay={500 * t} />}
        </a>
        <p className="per-day">of wet waste a day{review && <span className="sub">, as read by machine</span>}</p>
        {!review && <>
          <p className="promised">promised in writing to be processed on site:</p>
          {m ? <p className="method">{m}<Underline seed={4} delay={400 * t} dur={500} /></p>
            : <p className="sub">No on-site method found in the minutes.</p>}
        </>}
        {review && <p className="label reason">{p.review_reason}</p>}
        {!review && p.wet_kg_day ? <p className="outcome">
          If this plant runs, <b>{tonnesAYear(p.wet_kg_day)} tonnes a year</b> stays where it is made, instead of on trucks to the city's dumping grounds.
        </p> : null}
        <p className="note">The builder promised in writing to process this waste on site. Ask whether the plant is built and running.</p>
        {p.city === "PCMC" && <p className="sub fines">PCMC notices set fines for large societies that don't process wet waste.</p>}
        <div className="actions">
          {review ? <a className="btn" href={pdfUrl(p)} target="_blank" rel="noreferrer">Open the page</a>
            : <button className="btn" onClick={() => setSheet("letter")}>Ask for the plant to run</button>}
          <button className="btn ghost share-btn" onClick={() => setSheet("share")} aria-label="Send to my society group">
            <span className="lbl">Send to my society group</span>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
          {!review && <p className="cta-note sub">A free letter to the builder or ward office, in English, <span lang="mr">मराठी</span> or <span lang="hi">हिंदी</span>. No sign-in.</p>}
        </div>
      </div>

      <div className="card-right">
        <figure className="clip-wrap" aria-label="From the minutes">
          <Washi style={{ left: 18, top: -12, transform: "rotate(-24deg)" }} seed={5} />
          <Washi style={{ right: 70, top: -10, transform: "rotate(18deg)" }} seed={8} />
          <div className="clipping">
          <figcaption>SEAC minutes, {longDate(p.meeting_date)}, page {p.source.page}</figcaption>
          <p className="op">Operation Phase</p>
          <p className="quote" id="quote">
            {p.owc_quote ? (review || !found ? <span className="hl-text">{p.owc_quote}</span>
              : <Highlight delay={150 * t} dur={600} play={play}>{p.owc_quote}</Highlight>)
              : <span className="sub">The wet-waste line could not be found word for word.</span>}
          </p>
          </div>
          {opPhase && !review && <span className="label annotate">Operation phase,<br />not construction</span>}
        </figure>
        <span className="card-stamp">
          {review ? <Stamp lines={["A person", "must check", "this"]} color="var(--rust)" shape="box" rotate={-6} delay={400 * t} play={play} />
            : p.status === "verified" ? <Stamp lines={["Checked", "by a", "person"]} color="var(--leaf)" delay={1200 * t} play={play} />
              : p.decision === "recommended" && <Stamp lines={["Recommended", "for clearance", longDate(p.meeting_date)]} delay={1200 * t} play={play} />}
        </span>
        <div className="links">
          <button className="ink hand linkish" onClick={() => setSheet("peek")}>{review ? "Open the page and check it yourself" : `See it on page ${p.source.page}`}</button>
          <a className="ink hand" href={p.source.parivesh_url} target="_blank" rel="noreferrer">Original on PARIVESH</a>
        </div>
        <ul className="checks" aria-label="Checks">
          {p.checks.map((c, i) => (
            <li key={c.name} className={c.pass ? "" : "no"}>
              <Tick ok={c.pass} seed={i + 2} delay={(900 + i * 80) * t} dur={120} play={play} />
              <span>{checkLabel(p, c.name, c.pass)}</span>
            </li>
          ))}
          {found && <li><Tick ok seed={12} delay={(900 + p.checks.length * 80) * t} dur={120} play={play} /><span>On page {p.source.page}</span></li>}
          {!review && <li className="hand-soft"><Tick ok seed={13} delay={1300 * t} dur={120} play={play} /><span>Read by machine, checks passed</span></li>}
        </ul>
      </div>

      <dl className="facts">
        {builder && <div><dt>Builder:</dt><dd className="label">{builder}</dd></div>}
        {p.tenements && <div><dt>Flats:</dt><dd className="label">{p.tenements}</dd></div>}
        <div><dt>{p.decision === "recommended" ? "Recommended for clearance:" : "Committee meeting:"}</dt><dd className="label">{longDate(p.meeting_date)}</dd></div>
        <div><dt>Proposal:</dt><dd className="label">{p.proposal_id.replace("SIA/MH/", "")}</dd></div>
        {builder && <Link className="ink hand" to={`/b/${builderSlug(builder)}`}>Other projects by {builder}</Link>}
      </dl>
      <p className="about sub">VACHAN reads Pune's public environmental-clearance minutes and shows what each builder promised to do with wet waste. A promise is not proof that a plant was built or runs. <Link className="ink hand" to="/">Search another building</Link></p>
      <p className="fixit sub">
        Spotted a mistake on this card? <a className="ink hand" target="_blank" rel="noreferrer"
          href={`https://github.com/SidTheKid-dotcom/wemakedevs-env-hacks-2026/issues/new?title=${encodeURIComponent(`Mistake on ${p.proposal_id}`)}&body=${encodeURIComponent(`Card: ${location.href}\nSource page: ${p.source.page} of ${p.source.mirror_url}\n\nWhat looks wrong:\n`)}`}>Tell us</a>, with the page it is on.
      </p>

      {!review && <QuoteArrow play={play} />}
      {sheet === "letter" && <LetterSheet p={p} onClose={() => setSheet(null)} />}
      {sheet === "share" && <ShareSheet p={p} onClose={() => setSheet(null)} />}
      {sheet === "peek" && <PdfPeek p={p} onClose={() => setSheet(null)} />}
    </article>
  );
}

/** Ink arrow from the highlighted quote to the big number, recomputed from live positions. */
function QuoteArrow({ play }: { play: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const [d, setD] = useState<{ body: string; head: string } | null>(null);
  useLayoutEffect(() => {
    const card = svg.current!.parentElement!;
    const measure = () => {
      const q = document.getElementById("quote"), n = document.querySelector("#num .big");
      if (!q || !n) return;
      const c = card.getBoundingClientRect(), a = q.getBoundingClientRect(), b = n.getBoundingClientRect();
      const wide = innerWidth >= 1024;
      setD(wide
        ? arrow([a.left - c.left - 8, a.top - c.top + a.height / 2], [b.right - c.left - 30, b.top - c.top + b.height * 0.12], 50)
        : arrow([a.left - c.left + 24, a.top - c.top - 6], [b.left - c.left + 40, b.bottom - c.top + 8], 40));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);
  return (
    <svg ref={svg} className="quote-arrow" aria-hidden="true">
      {d && <>
        <InkPath d={d.body} color="var(--leaf)" width={2.4} delay={play ? 750 : 0} dur={400} play={play} />
        <g className={play ? "pop" : undefined} style={{ "--delay": "1150ms" } as CSSProperties}>
          <path d={d.head} fill="none" stroke="var(--leaf)" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      </>}
    </svg>
  );
}
