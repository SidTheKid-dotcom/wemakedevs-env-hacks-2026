// PCMC ward officer: who to check first this week (SPEC 5.7). A list, never a verdict.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProjects } from "../api";
import { kg, method, placeName, shortDate } from "../format";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { Tick } from "../ui/Ink";
import { Empty, ErrorState, Loading, Masthead } from "../ui/Parts";
import { t, t2, useLang } from "../i18n";

export default function Officer() {
  useLang();
  const { data, error, retry } = useLoad(getProjects, []);
  const pcmc = useMemo(() => (data || []).filter((p) => p.city === "PCMC"), [data]);
  const wards = useMemo(() => [...new Set(pcmc.map((p) => p.ward))].sort((a, b) => +a - +b), [pcmc]);
  const [params] = useSearchParams(); // ?ward=52 comes from a ward clicked on the home map
  const [ward, setWard] = useState(() => { try { return params.get("ward") || localStorage.getItem("officer-ward") || "52"; } catch { return params.get("ward") || "52"; } });
  useEffect(() => { try { localStorage.setItem("officer-ward", ward); } catch { /* private mode */ } }, [ward]);
  useEffect(() => { document.title = "Which projects to check first | VACHAN"; }, []);
  const inWard = pcmc.filter((p) => p.ward === ward);
  const first = inWard.filter((p) => p.status === "auto" && p.decision === "recommended")
    .sort((a, b) => (b.wet_kg_day || 0) - (a.wet_kg_day || 0) || a.meeting_date.localeCompare(b.meeting_date));
  const review = inWard.filter((p) => p.status === "review");
  const zone = (w: string) => pcmc.find((p) => p.ward === w)?.zone;

  return (
    <Desk props="plain">
      <Masthead />
      {error ? <ErrorState title={t("The promise list did not load.")} detail={t("The data server did not answer. Try again in a minute.")} retry={retry} />
        : !data ? <Loading />
          : <div className="officer">
            <header className="officer-head">
              <p className="kicker hand">{t("For PCMC ward officers planning visits to large societies")}</p>
              <h1>{t2("Ward {w}: which projects to check first", { w: ward })}</h1>
              <p className="sub">{t("Projects in this ward that promised to process the most wet waste on site, largest first. Use it to choose where to visit first. Being on this list does not mean anything is wrong.")}</p>
              <div className="ward-pick">
                <label className="label select" key={ward}>
                  <span className="sr-only">{t("Ward")}</span>
                  <select value={ward} onChange={(e) => setWard(e.target.value)}>
                    {wards.map((w) => <option key={w} value={w}>{t2("PCMC ward {w}", { w })}{zone(w) ? t2(", zone {z}", { z: zone(w)! }) : ""}</option>)}
                  </select>
                </label>
                <button className="btn no-print print-btn" onClick={() => print()}>{t("Print this list")}</button>
              </div>
            </header>
            <div className="officer-cols">
              <section>
                <h2 className="ledger-h">{t2(first.length === 1 ? "Check first: {n} project" : "Check first: {n} projects", { n: first.length })}</h2>
                {first.length === 0 ? <Empty title={t("No recommended projects found in this ward.")} /> : (
                  <table className="ledger" key={ward}>
                    <caption className="sr-only">{t2("Who to check first in PCMC ward {w}", { w: ward })}</caption>
                    <thead><tr><th>#</th><th>{t("Project")}</th><th>{t("Wet waste a day")}</th><th>{t("Promised")}</th><th>{t("Recommended")}</th><th>{t("Source")}</th></tr></thead>
                    <tbody>
                      {first.map((p, i) => (
                        <tr key={p.id} className="fade-in" style={{ "--delay": `${i * 30}ms` } as CSSProperties}>
                          <td className="hand">{i + 1}</td>
                          <td><Link data-data to={`/p/${p.id}`}>{placeName(p)}</Link></td>
                          <td className="num">{kg(p.wet_kg_day)} kg</td>
                          <td>{method(p.quote) || t("on site")}</td>
                          <td>{shortDate(p.meeting_date)}</td>
                          <td>{p.pdf && <a className="ink hand" href={`${p.pdf}#page=${p.page}`} target="_blank" rel="noreferrer">page {p.page}</a>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <aside className="review-queue">
                <h2 className="hand">{t2("A person must check these: {n}", { n: review.length })}</h2>
                {review.map((p) => (
                  <Link key={p.id} to={`/p/${p.id}`} className="review-slip">
                    <Tick ok={false} play={false} />
                    <span><b className="pencil">{kg(p.wet_kg_day)} kg, {t("as read by machine")}</b>, <b data-data>{placeName(p)}</b>: {t(p.review_reason || "")}</span>
                  </Link>
                ))}
              </aside>
            </div>
            <p className="sub footnote">{t("Ward boundaries: the older PCMC layout, from DataMeet. Each row links to its promise and its page in the minutes.")}</p>
          </div>}
    </Desk>
  );
}
