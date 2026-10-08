// What one builder promised across projects (SPEC 5.6). Never a score or a rank.
import { useEffect, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjects } from "../api";
import { builderName, builderSlug, kg, longDate, method, placeName } from "../format";
import { useLoad } from "../useLoad";
import { Desk } from "../ui/Desk";
import { Underline } from "../ui/Ink";
import { Empty, ErrorState, Loading, Masthead } from "../ui/Parts";
import { SearchTape } from "./Search";

export default function Builder() {
  const { slug = "" } = useParams();
  const { data, error, retry } = useLoad(getProjects, []);
  const mine = (data || []).filter((p) => p.builder && builderSlug(builderName(p.builder)) === slug)
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const name = mine[0] ? builderName(mine[0].builder) : "";
  const counted = mine.filter((p) => p.decision === "recommended" && p.status === "auto"); // same rule as the Pune total
  const total = counted.reduce((s, p) => s + (p.wet_kg_day || 0), 0);
  useEffect(() => { if (name) document.title = `${name}: wet waste promised in writing | VACHAN`; }, [name]);

  return (
    <Desk props="plain">
      <Masthead />
      {error ? <ErrorState title="The promise list did not load." detail="The data server did not answer. Try again in a minute." retry={retry} />
        : !data ? <Loading />
          : !mine.length ? <Empty title="No projects found for this builder."><SearchTape /></Empty>
            : <div className="builder">
              <aside className="builder-side">
                <h1>{name}</h1>
                <p>Wet waste promised in writing across {counted.length} {counted.length === 1 ? "project" : "projects"}</p>
                <p className="total-hl"><b>{kg(total)}</b> kg a day</p>
                <p className="note">This is what was promised.<br />It is not a score.<span className="ul"><Underline seed={6} /></span></p>
              </aside>
              <ul className="entries">
                {mine.map((p, i) => (
                  <li key={p.id} className="entry fade-in" style={{ "--delay": `${Math.min(i, 10) * 60}ms` } as CSSProperties}>
                    <a className="entry-kg" href={p.pdf ? `${p.pdf}#page=${p.page}` : `/p/${p.id}`} target="_blank" rel="noreferrer">
                      <b className={p.status === "review" ? "pencil" : "hl-band"}>{kg(p.wet_kg_day)} kg a day</b>
                    </a>
                    <Link className="entry-name" to={`/p/${p.id}`}>{placeName(p)}</Link>
                    <span className="sub">{p.decision === "recommended" ? "Recommended" : "Committee meeting"} {longDate(p.meeting_date)}</span>
                    <span className="sub">{[method(p.quote), p.status === "review" ? "a person must check this figure" : null].filter(Boolean).join(", ")}</span>
                    {p.page && <a className="ink" href={`${p.pdf}#page=${p.page}`} target="_blank" rel="noreferrer">page {p.page}</a>}
                  </li>
                ))}
              </ul>
            </div>}
    </Desk>
  );
}
