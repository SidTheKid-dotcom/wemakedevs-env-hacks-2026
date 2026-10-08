"""Split SEAC minutes text (pdftotext -layout output) into one item per proposal.

Three header formats occur:
  old SEAC-3:   "P-13     146419/2020 Sai Paradise at ..."  or  " 8   P-8   SIA/MH/MIS/286312/2022 ..."
  2023 SEAC-3:  "19.     SIA/MH/INFRA2/433084/2023   Proposed Residential ..."
  PARIVESH 2.0: "3.5. Agenda Item No 5:"
Some minutes list every item in a contents table first, so a proposal can have several
headers. We keep the longest segment for each proposal.
"""
import re
from dataclasses import dataclass

# Lines can start with "\f" (pdftotext marks each new page that way).
HEADER = re.compile(
    r"^[\f \t]*(?:\d+\.?[ \t]+)?P-?[ \t]?\d+[ \t]+"         # P-13 / 8  P-8 / P01
    r"|^[\f \t]*\d+\.?[ \t]+(?:SIA[ \t]?/|PARIVESH|MIS/)"     # 19.  SIA/MH/...
    r"|^[\f \t]*\d+\.\d+\.[ \t]+Agenda[ \t]+Item[ \t]+No"     # 3.5. Agenda Item No 5:
    r"|^[\f \t]*AGENDA NUMBER[ \t]*$",                       # 2026: "AGENDA NUMBER" block
    re.M,
)
# "SIA /MH/MIS/242454/2021" and "SIA/MH/INFRA2/4436 70/2023" both occur.
# The year can be cut off when a table cell wraps: "SIA/MH/INFRA2/560369/".
SIA_ID = re.compile(r"SIA[ \t]?/[ \t]?MH[ \t]?/[ \t]?([A-Z]+\d?)[ \t]?/[ \t]?(\d[\d ]{3,7}\d)(?:[ \t]?/[ \t]?(\d{4}))?")
PARIVESH_ID = re.compile(r"PARIVESH[ \t]*(?:NO|No)\.?[ \t]*[:\-]?[ \t]*([A-Z]+)[ \t]*/[ \t]*(\d{5,6})")
BARE_ID = re.compile(r"(?:P-?[ \t]?\d+[ \t]+|\bMIS/)(\d{5,6})/(\d{4})")  # "P-01  131887/2019", "MIS/126342/2019"
PROPOSAL_LINE = re.compile(r"Proposal[ \t]+Number[^\n]{0,80}", re.I)


@dataclass
class Item:
    key: str            # numeric proposal id, e.g. "146419"; joins records across minutes
    proposal_id: str    # display form, e.g. "SIA/MH/MIS/146419/2020"
    title: str          # header line text, cleaned
    page: int           # 1-based PDF page where the item starts
    start: int          # character offsets in the minutes text
    end: int
    text: str


def _ids(chunk: str):
    """All (key, display id) pairs in a chunk, fullest form first."""
    out = []
    for s in SIA_ID.finditer(chunk):
        num = s.group(2).replace(" ", "")
        out.append((num, f"SIA/MH/{s.group(1)}/{num}" + (f"/{s.group(3)}" if s.group(3) else "")))
    out += [(p.group(2), f"PARIVESH NO: {p.group(1)}/{p.group(2)}") for p in PARIVESH_ID.finditer(chunk)]
    out += [(b.group(1), f"{b.group(1)}/{b.group(2)}") for b in BARE_ID.finditer(chunk)]
    return out


def find_id(text: str):
    """Return (key, display id) for the proposal in an item, or None.

    The key comes from the header line if it has one, else the 'Proposal Number' line,
    else the first id in the item. The display id is the fullest form with that key.
    """
    header_line = text.lstrip("\f \t\n").split("\n", 1)[0]
    m = PROPOSAL_LINE.search(text[:8000])
    for chunk in [header_line] + ([m.group(0)] if m else []) + [text[:8000]]:
        if found := _ids(chunk):
            key = found[0][0]
            full = [pid for k, pid in _ids(text[:8000]) if k == key and not pid[0].isdigit()]
            return key, max(full, key=len) if full else found[0][1]
    return None


def page_at(text: str, pos: int) -> int:
    return text.count("\f", 0, pos) + 1


def title_of(segment: str) -> str:
    head = segment[:600]
    if "Agenda Item No" in head[:80] or "AGENDA NUMBER" in head[:80]:  # PARIVESH 2.0: title paragraph
        m = re.search(r"(?:Details of the proposal|EC/AGENDA/\S+)\s*\n(.{5,400}?)(?:\n\s*(?:Proposal For|PROPOSAL FOR)|\n\s*\n)", segment[:2500], re.S)
        head = m.group(1) if m else ""
    else:
        head = head.split("\n", 2)
        head = " ".join(head[:2]).split("Proposal Number")[0]
        head = SIA_ID.sub("", head)
        head = re.sub(r"^\s*(\d+\.?\s+)?P-\s?\d+\s+(\d{5,6}/\d{4})?", "", head)
    return re.sub(r"\s+", " ", head).strip(" .:-")[:200]


def split(text: str) -> list[Item]:
    starts = [m.start() for m in HEADER.finditer(text)] + [len(text)]
    best: dict[str, Item] = {}
    for a, b in zip(starts, starts[1:]):
        seg = text[a:b]
        found = find_id(seg)
        if not found:
            continue
        key, pid = found
        first_char = a + len(seg) - len(seg.lstrip("\f \t\n"))
        item = Item(key, pid, title_of(seg), page_at(text, first_char), a, b, seg)
        if key not in best or len(seg) > len(best[key].text):
            best[key] = item
    return sorted(best.values(), key=lambda i: i.start)
