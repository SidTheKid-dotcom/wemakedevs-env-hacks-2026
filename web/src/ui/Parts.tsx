// Masthead, dialog sheet, and the loading / empty / error states (SPEC 5.9, 6.5, 7.4).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Compost } from "./Compost";
import { Underline } from "./Ink";
import { LANGS, setLang, t, useLang } from "../i18n";

/** Nav label whose letters roll up on hover. */
export function Roll({ text }: { text: string }) {
  // A Devanagari syllable is several code points, so splitting per character scatters its
  // vowel marks ("रहिवासी" became "र ह ि व ा स ी"). Those scripts roll as one piece.
  if (!/^[\x20-\x7E]*$/.test(text)) return <span className="roll whole">{text}</span>;
  return (
    <span className="roll" aria-label={text}>
      {[...text].map((c, i) => <span key={i} data-c={c === " " ? " " : c} style={{ "--i": i } as React.CSSProperties} aria-hidden="true">{c === " " ? " " : c}</span>)}
    </span>
  );
}

/** English, Marathi, Hindi. The choice is remembered and can be shared with ?lang=. */
export function LangPicker() {
  const lang = useLang();
  return (
    <div className="langs" role="radiogroup" aria-label={t("Language")}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} aria-label={l.full}
          lang={l.code} className={lang === l.code ? "on" : ""} onClick={() => setLang(l.code)}>{l.label}</button>
      ))}
    </div>
  );
}

export function Masthead({ children, search = false }: { children?: ReactNode; search?: boolean }) {
  useLang(); // re-render the whole header when the language changes
  return (
    <header className="masthead">
      <Link to="/" className="wordmark" aria-label={t("VACHAN, home")}>
        <b>VACHAN</b><i lang="mr">वचन</i>
        <Underline seed={9} delay={100} dur={500} />
      </Link>
      <nav className="nav" aria-label="Main">
        {children}
        {search && <Link className="btn round" to="/#search" aria-label={t("Search projects and addresses")}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" strokeWidth="2.6" /><path d="M15 15l5.5 5.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" /></svg>
        </Link>}
        <Link className="ink" to="/#search"><Roll text={t("Residents")} /></Link>
        <NavLink className="ink" to="/officer"><Roll text={t("Ward officers")} /></NavLink>
        <NavLink className="ink" to="/how"><Roll text={t("How it works")} /></NavLink>
        <LangPicker />
      </nav>
    </header>
  );
}

/** A modal sheet: slides up on phones, over the right column on desktop. Esc, scrim tap or drag down closes. */
export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const el = panel.current!;
    const focusables = () => [...el.querySelectorAll<HTMLElement>("button, a[href], textarea, input, [tabindex]:not([tabindex='-1'])")];
    focusables()[1]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const back = opener.current;
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; back?.focus(); };
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={panel} className="panel" role="dialog" aria-modal="true" aria-label={label}>
        <button className="grip" aria-label={t("Close")} onClick={onClose}
          onPointerDown={(e) => { drag.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current != null) panel.current!.style.transform = `translateY(${Math.max(0, e.clientY - drag.current)}px)`; }}
          onPointerUp={(e) => { if (drag.current != null && e.clientY - drag.current > 120) onClose(); else panel.current!.style.transform = ""; drag.current = null; }} />
        {children}
      </div>
    </>
  );
}

/** Shows only after 200 ms, so fast loads never flash a skeleton. */
export function Loading({ text = "" }: { text?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="state" aria-live="polite">
      <div className="skeleton" aria-hidden="true"><i style={{ width: "60%" }} /><i /><i style={{ width: "80%" }} /></div>
      <Compost className="state-pot" />
      <p className="sub">{text || t("Reading the minutes…")}</p>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <img className="state-img" src="/props/seedling-3.webp" alt="" />
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function ErrorState({ title, detail, retry }: { title: string; detail?: string; retry?: () => void }) {
  return (
    <div className="state" role="alert">
      <img className="state-img" src="/props/paper-ball.webp" alt="" />
      <h2>{title}</h2>
      {detail && <p className="sub">{detail}</p>}
      {retry && <button className="btn" onClick={retry}>{t("Try again")}</button>}
    </div>
  );
}
