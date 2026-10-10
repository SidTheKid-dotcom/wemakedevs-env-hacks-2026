// How it works (SPEC 5.8): source and freshness, the pipeline, what the ticks mean, what is not built, credits.
import { useEffect, useRef, useState } from "react";
import { getStats } from "../api";
import { kg, longDate } from "../format";
import { roughLine } from "../rough";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { InkPath, Tick } from "../ui/Ink";
import { Masthead } from "../ui/Parts";
import { dateLocale, t, t2, tl, useLang } from "../i18n";

const STEPS = [
  { id: "fetch", t: "Every night", s: "EventBridge", icon: "M4 7h16v13H4z M4 11h16 M8 4v5 M16 4v5 M8 14h2 M12 14h2 M16 14h2 M8 17h2 M12 17h2" },
  { id: "fetch2", t: "Fetch new minutes", s: "Lambda, S3", icon: "M6 3h9l4 4v14H6z M9 10h7 M9 13h7 M12 15v5 M9.5 17.5L12 20l2.5-2.5" },
  { id: "split", t: "Split into projects", s: "Step Functions", icon: "M4 5h8v14H4z M14 3h7v5h-7z M14 10h7v5h-7z M14 17h7v4h-7z M12 12h2" },
  { id: "read", t: "Read the waste promise", s: "Amazon Bedrock (Nova Pro)", icon: "M5 3h11v18H5z M8 8h6 M8 11h6 M8 14h3 M17 14a3 3 0 1 1-.1 0 M19.2 16.2L22 19" },
  { id: "check", t: "Check every quote against the PDF", s: "plain code", icon: "M3 5h18v14H3z M9 9l-3 3 3 3 M15 9l3 3-3 3 M13 8l-2 8" },
  { id: "see", t: "You see the page", s: "CloudFront, Amplify", icon: "M3 4h18v16H3z M3 8h18 M6 6h.5 M8 6h.5 M10 6h.5 M6 12h8 M6 15h12" },
];
const SIMPLE = [
  { t: "What goes in", b: "Public government minutes", s: "Over a thousand PDFs in which builders promised how they would handle wet waste.", icon: "M6 3h9l4 4v14H6z M9 10h7 M9 13h7 M9 16h5" },
  { t: "What VACHAN does", b: "Finds each promise and checks it", s: "Reads every page, pulls out each project's wet-waste promise, and checks the number word for word against the PDF.", icon: "M5 3h11v18H5z M8 8h6 M8 11h6 M8 14h3 M17 14a3 3 0 1 1-.1 0 M19.2 16.2L22 19" },
  { t: "What comes out", b: "A promise card and a letter", s: "The kg a day, how it is processed, the exact page, and a letter asking for the plant to run.", icon: "M4 6h16v12H4z M4 7l8 6 8-6" },
];
const CHAIN = [
  { k: "Problem", t: "Wet waste from large societies is trucked to city plants." },
  { k: "Product", t: "VACHAN shows what the builder promised in writing, with the page." },
  { k: "Action", t: "Residents ask for the plant to run. Officers know whom to check first." },
  { k: "Solution", t: "The waste is processed where it is made." },
];
const TICKS = ["Found word for word in the minutes", "Operation phase, not construction", "Wet waste per flat in the usual range (0.5 to 3 kg)", "Recommended for clearance"];

export default function How() {
  useLang();
  const { data: s } = useLoad(getStats, []);
  const strip = useRef<HTMLOListElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { document.title = t("How VACHAN works"); });
  useEffect(() => { // arrows draw in, one after the other, when the diagram comes into view
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setDrawn(true), io.disconnect()), { threshold: 0.3 });
    io.observe(strip.current!);
    return () => io.disconnect();
  }, []);

  return (
    <Desk props="plain" pot={false}>
      <Masthead />
      <article className="how">
        <h1>{t("How VACHAN works")}</h1>
        <p className="how-lede">{t("To get environmental clearance, each large housing project tells a state committee how it will handle its waste. The committee's meeting minutes are public, on a government website called PARIVESH. VACHAN reads them for you.")}</p>
        <ol className="flow three">
          {SIMPLE.map((st, i) => (
            <li key={st.t} className="flow-box">
              <svg className="flow-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <InkPath d={roughLine([2, 2], [98, 3], i) + roughLine([98, 3], [97, 98], i + 1) + roughLine([97, 98], [3, 97], i + 2) + roughLine([3, 97], [2, 2], i + 3)} width={1.6} color="var(--leaf)" play={false} />
              </svg>
              <span className="hand cue">{t(st.t)}</span>
              <svg className="flow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={st.icon} fill="none" stroke="var(--leaf)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <b>{t(st.b)}</b>
              <span className="sub">{t(st.s)}</span>
              {i < SIMPLE.length - 1 && <svg className="flow-arrow" viewBox="0 0 30 30" aria-hidden="true"><path d="M3 15 L25 15 M18 8 L26 15 L18 22" fill="none" stroke="var(--leaf)" strokeWidth="2.4" strokeLinecap="round" /></svg>}
            </li>
          ))}
        </ol>
        <ol className="why-chain" aria-label={t("From the problem to the solution")}>
          {CHAIN.map((c) => <li key={c.k}><span className="hand cue">{t(c.k)}</span><span>{t(c.t)}</span></li>)}
        </ol>
        <p className="label fresh">
          {t("Source: SEAC minutes on PARIVESH.")}{s && <> {t2("Newest meeting {date}.", { date: longDate(s.newest_meeting_date) })} {t2("Published {when}.", { when: new Date(s.published_at).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }) })}</>}
        </p>
        <div className="how-cols">
          <section id="data">
            <h2>{t("What the numbers are")}</h2>
            {s ? <p>{tl("Wet waste promised in writing across Pune: {total} (PMC {pmc}, PCMC {pcmc}).", { total: <b>{kg(s.wet_kg_day_total)} {t("kg a day")}</b>, pmc: kg(s.wet_kg_day_pmc), pcmc: kg(s.wet_kg_day_pcmc) })} {t2("We count a project only if the committee recommended it and every check passed: {c} of {n} project sites.", { c: s.counted_projects, n: s.projects })} {t("Each site is counted once: the newest minutes win, and expansions of the same site fold into one.")} {t2("{r} records wait for a person to check them.", { r: s.review_count })}</p>
              : <p className="sub">{t("Loading the numbers…")}</p>}
            {s?.quotes_verified != null && <p className="label proof">{t2("{v} of {c} quotes re-checked against the live government PDF after the last run.", { v: s.quotes_verified, c: s.quotes_checked ?? 0 })}</p>}
          </section>
          <section id="check">
            <h2>{t("What the ticks mean")}</h2>
            <ul className="checks">{TICKS.map((k, i) => <li key={k}><Tick ok seed={i + 3} play={false} /><span>{t(k)}</span></li>)}</ul>
            <p className="sub">{t("The model only reads. Plain code finds the quoted line, the page and the phase, and decides whether a record is shown as checked.")}</p>
          </section>
          <section>
            <h2>{t("What we have not built")}</h2>
            <p>{t("We do not know whether a plant runs today. We show what was promised in writing, and the page it is written on. Projects cleared before 2019, and buildings below the clearance size, are not in these minutes.")}</p>
          </section>
          <section id="credits">
            <h2>{t("Credits")}</h2>
            <ul className="plain">
              <li>{t("Minutes:")} <a className="ink hand" href="https://parivesh.nic.in/" target="_blank" rel="noreferrer">PARIVESH</a>, {t("Ministry of Environment, Forest and Climate Change")}</li>
              <li>{t("Ward maps:")} <a className="ink hand" href="https://github.com/datameet/Municipal_Spatial_Data" target="_blank" rel="noreferrer">DataMeet</a>, <a className="ink hand" href="https://creativecommons.org/licenses/by-sa/2.5/in/" target="_blank" rel="noreferrer">CC BY-SA 2.5 IN</a></li>
              <li>{t("Address search:")} Amazon Location Service</li>
              <li>{t("Desk props: modelled and rendered in Blender by the team")}</li>
              <li>{t("AI tools: Claude Code, ChatGPT images (design concepts), Amazon Bedrock (reading the minutes and drafting letters)")}</li>
            </ul>
          </section>
        </div>
        <details className="hood">
          <summary><h2>{t("Under the hood: the AWS pipeline")}</h2></summary>
          <p className="sub">{t("For the technically curious. Every night the pipeline reads new minutes and re-checks every quote.")}</p>
        <ol className="flow" ref={strip}>
            {STEPS.map((st, i) => (
              <li key={st.id} id={st.id} className="flow-box">
                <svg className="flow-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <InkPath d={roughLine([2, 2], [98, 3], i) + roughLine([98, 3], [97, 98], i + 1) + roughLine([97, 98], [3, 97], i + 2) + roughLine([3, 97], [2, 2], i + 3)} width={1.6} color="var(--leaf)" play={false} />
                </svg>
                <b>{t(st.t)}</b>
                <svg className="flow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={st.icon} fill="none" stroke="var(--leaf)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="label">{t(st.s)}</span>
                {i < STEPS.length - 1 && <svg className="flow-arrow" viewBox="0 0 30 30" aria-hidden="true">
                  <InkPath d="M3 15 L25 15 M18 8 L26 15 L18 22" color="var(--leaf)" width={2.4} play={drawn} delay={i * 300} dur={300} />
                </svg>}
              </li>
            ))}
          </ol>
        </details>
      </article>
    </Desk>
  );
}
