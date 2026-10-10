// Draft letter (SPEC 5.4): who gets it, which language, Bedrock drafts it, it types itself out, copy or WhatsApp.
import { useEffect, useRef, useState } from "react";
import { draftLetter, type Project } from "../api";
import { builderName } from "../format";
import { reducedMotion } from "../motion";
import { Compost } from "../ui/Compost";
import { Stamp } from "../ui/Ink";
import { Dialog } from "../ui/Parts";
import { t, useLang } from "../i18n";

const FORBIDDEN = /violat|fail|illegal|missing|fraud/i; // guard: a letter must never accuse

export function LetterSheet({ p, onClose }: { p: Project; onClose: () => void }) {
  const builder = builderName(p.builder);
  useLang();
  const office = p.city === "PCMC" ? "pcmc" : "pmc";
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem("letter") || "{}"); } catch { return {}; } })();
  const [to, setTo] = useState<"builder" | "pcmc" | "pmc">(builder ? saved.to === "builder" || !saved.to ? "builder" : office : office);
  const [lang, setLang] = useState<"en" | "mr" | "hi">(saved.lang || "en");
  const [step, setStep] = useState<"choose" | "drafting" | "letter" | "error">("choose");
  const [text, setText] = useState("");
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);

  const draft = async () => {
    try { sessionStorage.setItem("letter", JSON.stringify({ to: to === "builder" ? "builder" : "office", lang })); } catch { /* ignore */ }
    setStep("drafting");
    try {
      const t = await draftLetter(p.id, to, lang);
      if (FORBIDDEN.test(t)) throw new Error("guard");
      setText(t);
      setShown(reducedMotion() ? t.length : 0);
      setStep("letter");
    } catch {
      setStep("error");
    }
  };

  // Typewriter: 8 ms a character, a pause at line breaks, never longer than 2.5 s in total.
  const typing = step === "letter" && shown < text.length;
  useEffect(() => {
    if (!typing) return;
    const perChar = Math.min(8, 2500 / text.length);
    const id = setTimeout(() => setShown((n) => Math.min(text.length, n + Math.max(1, Math.round(16 / perChar)))), text[shown] === "\n" ? 120 : 16);
    return () => clearTimeout(id);
  }, [typing, shown, text]);

  const area = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { area.current?.select(); document.execCommand("copy"); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const cardUrl = `${location.origin}/p/${p.id}`;
  const subject = `Wet-waste processing promised in writing: ${p.project_name || p.proposal_id}`;

  return (
    <Dialog label={t("Ask for the plant to run")} onClose={onClose}>
      {step === "choose" && <div className="letter-step">
        <h2>{t("Who should we ask?")}</h2>
        <div role="radiogroup" aria-label="Recipient" className="tags">
          {builder && <label className={`tag${to === "builder" ? " on" : ""}`}>
            <input type="radio" name="to" checked={to === "builder"} onChange={() => setTo("builder")} /> {builder}, {t("the builder")}
          </label>}
          <label className={`tag${to !== "builder" ? " on" : ""}`}>
            <input type="radio" name="to" checked={to !== "builder"} onChange={() => setTo(office)} /> {p.city} {t("ward office")}
          </label>
        </div>
        <div className="seg" role="radiogroup" aria-label={t("Language")}>
          <button role="radio" aria-checked={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
          <button role="radio" aria-checked={lang === "mr"} className={lang === "mr" ? "on" : ""} onClick={() => setLang("mr")} lang="mr">मराठी</button>
          <button role="radio" aria-checked={lang === "hi"} className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")} lang="hi">हिंदी</button>
        </div>
        <button className="btn wide" onClick={draft}>{t("Write my letter")}</button>
      </div>}

      {step === "drafting" && <div className="state" aria-live="polite"><Compost className="state-pot" /><p className="sub">{t("Drafting from the minutes…")}</p></div>}

      {step === "letter" && <div className="letter-step">
        <h2>{t("Your letter")}</h2>
        <div className="letterhead">
          {copied && <span className="copied"><Stamp lines={["Copied"]} shape="box" rotate={-10} /></span>}
          {typing
            ? <pre className="typed" aria-hidden="true">{text.slice(0, shown)}<span className="caret" /></pre>
            : <textarea ref={area} className="typed" value={text} onChange={(e) => setText(e.target.value)} aria-label={t("Letter text, you can edit it")} lang={lang} />}
          {typing && <button className="ink hand" onClick={() => setShown(text.length)}>{t("Show all")}</button>}
        </div>
        <p className="foot">{t("Drafted by Amazon Bedrock from the minutes.")} <mark>{t("Read it before you send.")}</mark></p>
        <div className="actions">
          <button className="btn" onClick={copy}>{copied ? t("Copied") : t("Copy letter")}</button>
          <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(text + "\n\n" + cardUrl)}`} target="_blank" rel="noreferrer">{t("Send on WhatsApp")}</a>
          {/* No recipient: no municipal address is published that we could verify, so the person adds their own. */}
          <a className="btn ghost" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + "\n\n" + cardUrl)}`}>{t("Send by email")}</a>
        </div>
        <p className="note">Email opens with the letter ready. Add your {to === "builder" ? "builder's" : `${p.city} ward office`} address in the To field.</p>
        <p className="sr-only" aria-live="polite">{copied ? "Letter copied" : !typing ? "Letter ready" : ""}</p>
      </div>}

      {step === "error" && <div className="state" role="alert">
        <img className="state-img" src="/props/paper-ball.webp" alt="" />
        <h2>{t("The letter could not be drafted.")}</h2>
        <p className="sub">{t("The promise and the page are still here.")}</p>
        <button className="btn" onClick={draft}>{t("Try again")}</button>
      </div>}
    </Dialog>
  );
}
