// The search tape (SPEC 5.3): projects, builders and villages from the data; addresses from Amazon Location.
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, placePosition, placesEnabled, suggestPlaces, type Place, type Summary } from "../api";
import { kg, norm, placeName, title } from "../format";

type Option = { kind: "project"; p: Summary } | { kind: "place"; place: Place } | { kind: "query"; q: string };

/** Rank: name starts with the query > a word starts with it > contains it. */
export function matchProjects(all: Summary[], q: string, limit = 5) {
  const n = norm(q);
  if (!n) return [];
  const score = (p: Summary) => {
    let best = 0;
    for (const f of [p.project_name, p.builder, p.village]) {
      const s = norm(f);
      if (s.startsWith(n)) best = Math.max(best, 3);
      else if (` ${s}`.includes(` ${n}`)) best = Math.max(best, 2);
      else if (s.includes(n)) best = Math.max(best, 1);
    }
    return best;
  };
  return all.map((p) => [score(p), p] as const).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || (b[1].wet_kg_day || 0) - (a[1].wet_kg_day || 0)).slice(0, limit).map(([, p]) => p);
}

export async function goToPlace(place: Place, nav: ReturnType<typeof useNavigate>) {
  const pos = await placePosition(place.id);
  nav(`/?near=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}&label=${encodeURIComponent(place.title)}#near`);
}

/** `cta` shows a worded button ("Find the promise") instead of the round search icon. */
export function SearchTape({ autoFocus = false, value = "", cta }: { autoFocus?: boolean; value?: string; cta?: string }) {
  const nav = useNavigate();
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [projects, setProjects] = useState<Summary[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesDown, setPlacesDown] = useState(false);
  const all = useRef<Summary[]>([]);
  const listId = useId();

  useEffect(() => { getProjects().then((p) => (all.current = p)).catch(() => {}); }, []);
  useEffect(() => { setQ(value); }, [value]);

  useEffect(() => { // 250 ms debounce; projects from 1 character, addresses from 3
    setProjects(matchProjects(all.current, q));
    if (q.trim().length < 3 || !placesEnabled) { setPlaces([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => suggestPlaces(q, ctl.signal).then((r) => { setPlaces(r); setPlacesDown(false); })
      .catch((e) => { if (e.name !== "AbortError") setPlacesDown(true); }), 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const options: Option[] = [
    ...projects.map((p) => ({ kind: "project" as const, p })),
    ...places.map((place) => ({ kind: "place" as const, place })),
    ...(q.trim() ? [{ kind: "query" as const, q: q.trim() }] : []),
  ];
  const choose = (o: Option) => {
    setOpen(false);
    if (o.kind === "project") nav(`/p/${o.p.id}`);
    else if (o.kind === "place") goToPlace(o.place, nav).catch(() => setPlacesDown(true));
    else nav(`/?q=${encodeURIComponent(o.q)}#near`);
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") { e.preventDefault(); const o = options[active] || options[0]; if (o) choose(o); }
  };

  return (
    <form className={`search${cta ? " has-cta" : ""}`} role="search" onSubmit={(e) => { e.preventDefault(); if (options[0]) choose(options[active] || options[0]); }}>
      <div className="search-row">
        <input className="search-input" type="search" value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          placeholder="Area, project or builder" aria-label="Search by area, address, project, builder or village"
          role="combobox" aria-expanded={open && options.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onKeyDown={key}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {!cta && <button className="btn round" aria-label="Search">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" strokeWidth="2.6" /><path d="M15 15l5.5 5.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" /></svg>
        </button>}
        {cta && <button className="btn search-cta">{cta}</button>}
      </div>
      {open && options.length > 0 && (
        <ul className="suggest" id={listId} role="listbox">
          {options.map((o, i) => (
            <li key={i} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={`label${i === active ? " on" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}>
              {o.kind === "project" && <><b>{kg(o.p.wet_kg_day)} kg a day</b> <span>{placeName(o.p)}</span></>}
              {o.kind === "place" && <><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="var(--leaf)" /><circle cx="12" cy="9.5" r="2.6" fill="var(--label)" /></svg> <span>{o.place.title}</span></>}
              {o.kind === "query" && <span>All projects matching “{title(o.q)}”</span>}
            </li>
          ))}
        </ul>
      )}
      {placesDown && <p className="sub" role="status">Address search did not answer. Search by project or village instead.</p>}
      <p className="sr-only" aria-live="polite">{open && options.length ? `${options.length} suggestions` : ""}</p>
    </form>
  );
}
