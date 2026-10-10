// The cited page, with the quoted line highlighted where the government printed it.
// pdfjs is loaded only when this opens, so no one pays for it just by reading a card.
import { useEffect, useRef, useState } from "react";
import type { Project } from "../api";
import { Dialog } from "./Parts";
import { t, t2, useLang } from "../i18n";

type Box = NonNullable<Project["quote_bbox"]>;

export function PdfPeek({ p, onClose }: { p: Project; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useLang();
  const [hl, setHl] = useState<{ left: string; top: string; width: string; height: string } | null>(null);
  const box = p.quote_bbox as Box | null | undefined;

  useEffect(() => {
    let cancelled = false;
    let task: { destroy?: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // The worker ships with the library; Vite gives us a URL for it.
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const doc = await pdfjs.getDocument({ url: p.source.mirror_url }).promise;
        if (cancelled) return;
        task = doc;
        const page = await doc.getPage(box?.page || p.source.page);
        if (cancelled) return;

        // Render at the width we have, times the screen's pixel ratio, so text stays sharp.
        const css = Math.min(wrap.current?.clientWidth || 640, 820);
        const base = page.getViewport({ scale: 1 });
        const scale = css / base.width;
        const dpr = Math.min(2, devicePixelRatio || 1);
        const vp = page.getViewport({ scale: scale * dpr });
        const c = canvas.current!;
        c.width = vp.width;
        c.height = vp.height;
        c.style.width = `${css}px`;
        c.style.height = `${(base.height * scale).toFixed(1)}px`;
        await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        if (cancelled) return;

        if (box) { // PDF y grows downward in pdftotext -bbox, same as CSS, so no flip
          setHl({
            left: `${(box.x0 / box.pw) * 100}%`,
            top: `${(box.y0 / box.ph) * 100}%`,
            width: `${((box.x1 - box.x0) / box.pw) * 100}%`,
            height: `${((box.y1 - box.y0) / box.ph) * 100}%`,
          });
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; task?.destroy?.(); };
  }, [p.source.mirror_url, p.source.page, box]);

  return (
    <Dialog label={t2("Page {p} of the minutes", { p: box?.page || p.source.page })} onClose={onClose}>
      <div className="peek">
        <h2>{t2("Page {p} of the minutes", { p: box?.page || p.source.page })}</h2>
        <p className="sub">{box ? t("The promise is highlighted where it is printed.") : t("The quoted line is on this page.")}</p>
        <div className="peek-page" ref={wrap}>
          <canvas ref={canvas} aria-label={`Page ${box?.page || p.source.page}, with the quoted line highlighted`} />
          {state === "ready" && hl && <span className="peek-hl" style={hl} aria-hidden="true" />}
          {state === "loading" && <p className="sub peek-msg">{t("Opening the page…")}</p>}
          {state === "error" && <p className="sub peek-msg">{t("The page would not open here. Use the link below.")}</p>}
        </div>
        {p.owc_quote && <p className="peek-quote">“{p.owc_quote}”</p>}
        <div className="actions">
          <a className="btn" href={`${p.source.mirror_url}#page=${box?.page || p.source.page}`} target="_blank" rel="noreferrer">{t("Open the full PDF")}</a>
          <a className="btn ghost" href={p.source.parivesh_url} target="_blank" rel="noreferrer">{t("Original on PARIVESH")}</a>
        </div>
      </div>
    </Dialog>
  );
}
