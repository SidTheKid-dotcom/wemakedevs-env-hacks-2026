"""Deterministic checks on a model record. They, not the model, decide the status.

Plain code also picks the evidence: the source line that holds the wet-waste figure.
"""
import re

WET = re.compile(r"Wet\s+(?:waste|garbage)\s*[:\-–]?\s*(\d[\d,]*(?:\.\d+)?)", re.I)
REASONS = {
    "found_in_minutes": "Could not find this wet-waste figure in the minutes.",
    "operation_phase": "Could not tell the construction phase from the operation phase. A person must check this.",
    "decision_known": "Could not read the committee's decision.",
    "kg_per_flat": "Wet waste per flat is outside 0.5 to 3 kg a day.",
    "owc_capacity": "The stated OWC capacity is below the promised wet waste.",
}


def _figures(text: str):
    """[(kg_per_day, line, offset)] for every 'Wet waste <number>' in the text."""
    out = []
    for m in WET.finditer(text):
        start = text.rfind("\n", 0, m.start()) + 1
        end = text.find("\n", m.end())
        line = re.sub(r"\s+", " ", text[start:end if end > 0 else None]).strip()
        out.append((float(m.group(1).replace(",", "")), line, m.start()))
    return out


def evidence(text: str, wet):
    """(line, offset) of the source line that states this wet-waste figure, or (None, None)."""
    for kg, line, offset in _figures(text):
        if wet is not None and abs(kg - wet) < 0.01:
            return line, offset
    return None, None


def run(record: dict, text: str):
    """Return (checks, status, review_reason, quote, quote_offset)."""
    wet, flats, cap = record.get("wet_kg_day_operation"), record.get("tenements"), record.get("owc_capacity_kg_day")
    figures = _figures(text)
    quote, offset = evidence(text, wet)
    checks = {
        "found_in_minutes": quote is not None,
        # The construction-phase (labour camp) figure is always the smaller one.
        "operation_phase": bool(figures) and wet is not None and wet >= max(kg for kg, _, _ in figures),
        "decision_known": record.get("decision") not in (None, "unclear"),
    }
    if wet and flats:
        checks["kg_per_flat"] = 0.5 <= wet / flats <= 3
    if wet and cap:
        checks["owc_capacity"] = cap >= wet
    failed = [k for k, ok in checks.items() if not ok]
    as_list = [{"name": k, "pass": ok} for k, ok in checks.items()]
    return as_list, ("review" if failed else "auto"), (REASONS[failed[0]] if failed else None), quote, offset
