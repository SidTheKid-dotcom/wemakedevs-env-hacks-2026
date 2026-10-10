"""Where the quoted line sits on its PDF page, in PDF points.

The card already shows the quote and the page. This gives the website the rectangle to
draw over it, so a reader sees the promise highlighted in the government's own document.

No model is involved: the quote text is already decided by `checks.py`, and this only
asks poppler where those words are printed.
"""
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://www.w3.org/1999/xhtml}word"
PAD = 2.0  # points of air around the words, so the highlight does not clip the glyphs


def _words(pdf: str, page: int):
    """[(x0, y0, x1, y1, text)] on one page, plus the page size in points."""
    with tempfile.TemporaryDirectory() as d:
        out = str(Path(d) / "p.xml")
        subprocess.run(["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), pdf, out],
                       check=True, timeout=120)
        root = ET.parse(out).getroot()
    pg = root.find(".//{http://www.w3.org/1999/xhtml}page")
    if pg is None:
        return [], (0.0, 0.0)
    words = [(float(w.get("xMin")), float(w.get("yMin")), float(w.get("xMax")), float(w.get("yMax")), w.text or "")
             for w in pg.iter(W)]
    return words, (float(pg.get("width")), float(pg.get("height")))


def _number(quote: str):
    """The wet-waste figure inside the quote: the thing we can find again on the page."""
    m = re.search(r"(\d[\d,]*(?:\.\d+)?)", quote or "")
    return m.group(1) if m else None


def find(pdf: str, page: int, quote: str):
    """{page, x0, y0, x1, y1, pw, ph} for the quoted line, or None if it cannot be placed."""
    n = _number(quote)
    if not n:
        return None
    words, (pw, ph) = _words(pdf, page)
    if not words:
        return None

    # The figure is distinctive, so start there. Compare without commas: the text layer
    # sometimes splits "17,477" differently from how pdftotext -layout joined it.
    plain = n.replace(",", "")
    anchor = next((w for w in words if plain in w[4].replace(",", "")), None)
    if anchor is None:
        return None

    # Grow along the same printed line: same baseline within 3 points, not the row above
    # or the cell below. Table rows in these minutes sit about 10 points apart.
    base = anchor[1]
    line = [w for w in words if abs(w[1] - base) <= 3.0]
    if not line:
        line = [anchor]
    x0, y0 = min(w[0] for w in line), min(w[1] for w in line)
    x1, y1 = max(w[2] for w in line), max(w[3] for w in line)
    return {
        "page": page,
        "x0": round(max(0.0, x0 - PAD), 2), "y0": round(max(0.0, y0 - PAD), 2),
        "x1": round(min(pw, x1 + PAD), 2), "y1": round(min(ph, y1 + PAD), 2),
        "pw": round(pw, 2), "ph": round(ph, 2),
    }
