// PCMC ward officer: who to check first this week (SPEC 5.7). A list, never a verdict.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProjects } from "../api";
import { kg, method, placeName, shortDate } from "../format";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { Tick } from "../ui/Ink";
import { Empty, ErrorState, Loading, Masthead } from "../ui/Parts";

export default function Officer() {
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
      {error ? <ErrorState title="The promise list did not load." detail="The data server did not answer. Try again in a minute." retry={retry} />
        : !data ? <Loading />
          : <div className="officer">
            <header className="officer-head">
              <p className="kicker hand">For PCMC ward officers planning visits to large societies</p>
              <h1>Ward {ward}: which projects to check first</h1>
              <p className="sub">Projects in this ward that promised to process the most wet waste on site, largest first. Use it to choose where to visit first. Being on this list does not mean anything is wrong.</p>
              <div className="ward-pick">
                <label className="label select" key={ward}>
                  <span className="sr-only">Ward</span>
                  <select value={ward} onChange={(e) => setWard(e.target.value)}>
                    {wards.map((w) => <option key={w} value={w}>PCMC ward {w}{zone(w) ? `, zone ${zone(w)}` : ""}</option>)}
                  </select>
                </label>
                <button className="btn no-print print-btn" onClick={() => print()}>Print this list</button>
              </div>
            </header>
            <div className="officer-cols">
              <section>
                <h2 className="ledger-h">Check first: {first.length} {first.length === 1 ? "project" : "projects"}</h2>
                {first.length === 0 ? <Empty title="No recommended projects found in this ward." /> : (
                  <table className="ledger" key={ward}>
                    <caption className="sr-only">Who to check first in PCMC ward {ward}</caption>
                    <thead><tr><th>#</th><th>Project</th><th>Wet waste a day</th><th>Promised</th><th>Recommended</th><th>Source</th></tr></thead>
                    <tbody>
                      {first.map((p, i) => (
                        <tr key={p.id} className="fade-in" style={{ "--delay": `${i * 30}ms` } as CSSProperties}>
                          <td className="hand">{i + 1}</td>
                          <td><Link to={`/p/${p.id}`}>{placeName(p)}</Link></td>
                          <td className="num">{kg(p.wet_kg_day)} kg</td>
                          <td>{method(p.quote) || "on site"}</td>
                          <td>{shortDate(p.meeting_date)}</td>
                          <td>{p.pdf && <a className="ink hand" href={`${p.pdf}#page=${p.page}`} target="_blank" rel="noreferrer">page {p.page}</a>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <aside className="review-queue">
                <h2 className="hand">A person must check these: {review.length}</h2>
                {review.map((p) => (
                  <Link key={p.id} to={`/p/${p.id}`} className="review-slip">
                    <Tick ok={false} play={false} />
                    <span><b className="pencil">{kg(p.wet_kg_day)} kg as read by machine</b>, <b>{placeName(p)}</b>: {p.review_reason}</span>
                  </Link>
                ))}
              </aside>
            </div>
            <p className="sub footnote">Ward boundaries: the older PCMC layout, from DataMeet. Each row links to its promise and its page in the minutes.</p>
          </div>}
    </Desk>
  );
}
