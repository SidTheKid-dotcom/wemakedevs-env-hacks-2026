// Share a promise (SPEC 5.5): the phone's share sheet when there is one, else copy link and WhatsApp.
import { useEffect, useState } from "react";
import type { Project } from "../api";
import { kg, placeName } from "../format";
import { Washi } from "../ui/Ink";
import { Dialog } from "../ui/Parts";

export function ShareSheet({ p, onClose }: { p: Project; onClose: () => void }) {
  const url = `${location.origin}/p/${p.id}`;
  const text = `${placeName(p)}: ${kg(p.wet_kg_day)} kg of wet waste a day, promised in writing to be processed on site. See the page:`;
  const [copied, setCopied] = useState(false);
  const [native] = useState(() => matchMedia("(pointer: coarse)").matches && "share" in navigator);

  useEffect(() => {
    if (!native) return;
    navigator.share({ title: "VACHAN", text, url }).catch(() => {}).finally(onClose);
  }, [native, text, url, onClose]);
  if (native) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Dialog label="Share this promise" onClose={onClose}>
      <div className="letter-step share">
        <h2>Share this promise</h2>
        <div className="mini-card" aria-hidden="true">
          <Washi style={{ left: "38%", top: -12 }} seed={2} />
          <b className="wm">VACHAN</b>
          <span className="mini-num">{kg(p.wet_kg_day)} kg</span>
          <span>of wet waste a day</span>
          <span className="sub">{placeName(p)}</span>
        </div>
        <button className="btn wide" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
        <a className="btn ghost wide" href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <p className="note">The link opens this page with the PDF page.</p>
        <p className="sr-only" aria-live="polite">{copied ? "Link copied" : ""}</p>
      </div>
    </Dialog>
  );
}
