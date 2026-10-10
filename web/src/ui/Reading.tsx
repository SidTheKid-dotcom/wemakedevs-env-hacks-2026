// The loading mark: a page of minutes, a highlighter reading down it, stopping on one line.
// That is what VACHAN does while you wait. One self-contained SVG, so nothing can stray onto the text.
const LINES = [112, 96, 120, 88, 106, 72]; // ink line lengths, in viewBox units
const PROMISE = 3; // the line the highlighter keeps

export function Reading({ label }: { label: string }) {
  return (
    <div className="reading" role="status" aria-live="polite">
      <svg viewBox="0 0 160 124" width="160" height="124" aria-hidden="true">
        <path className="rd-sheet" d="M10 6h112l28 24v88H10z" />
        <path className="rd-fold" d="M122 6v24h28" />
        {LINES.map((w, i) => {
          const y = 40 + i * 13;
          return (
            <g key={i}>
              <rect className={`rd-hl${i === PROMISE ? " keep" : ""}`} style={{ "--i": i } as React.CSSProperties}
                x="20" y={y - 5.5} width={w} height="11" rx="2" />
              <rect className="rd-line" x="20" y={y - 1.5} width={w} height="3" rx="1.5" />
            </g>
          );
        })}
      </svg>
      <p className="sub">{label}</p>
    </div>
  );
}
