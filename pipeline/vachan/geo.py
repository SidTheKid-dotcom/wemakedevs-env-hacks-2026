"""Coordinates from minutes text, and PMC / PCMC ward lookup.

Ward polygons: DataMeet (CC BY-SA 2.5 IN). PCMC: older 66-ward layout. PMC: 2022 electoral wards.
"""
import json
import re
from functools import cache
from pathlib import Path

WARDS = Path(__file__).parent / "wards"
DEGREE = r"[°ᴼº˚o0]?"  # OCR often turns the degree sign into "0" or "o"
MINUTE = r"['‘’‟′`]"    # straight and curly quotes both occur
LEFT_PMC_2024 = ("fursungi", "phursungi", "uruli devachi")  # moved to their own council in 2024


def _dms(text: str, lo: int, hi: int):
    for m in re.finditer(r"(\d{2})\s*" + DEGREE + r"\s*(\d{1,2})\s*" + MINUTE + r"\s*(\d{1,2}(?:\.\d+)?)", text):
        d, mi, se = int(m.group(1)), int(m.group(2)), float(m.group(3))
        if lo <= d <= hi and mi < 60 and se < 60:
            return round(d + mi / 60 + se / 3600, 6)
    for m in re.finditer(r"\b(\d{2}\.\d{3,})", text):
        if lo <= float(m.group(1)) <= hi:
            return float(m.group(1))
    return None


def latlon(item_text: str):
    """Return (lat, lon) from the 'Latitude ... Longitude ...' line of an item, or (None, None)."""
    m = re.search(r"Latitude.{0,300}", re.sub(r"\s+", " ", item_text), re.I)
    if not m:
        return None, None
    s = m.group(0)
    i = s.lower().find("long")
    return _dms(s, 15, 22), _dms(s[i:] if i > 0 else s, 72, 81)


@cache
def _polygons(name: str):
    out = []
    for f in json.loads((WARDS / name).read_text())["features"]:
        g = f["geometry"]
        out.append((f["properties"], [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]))
    return out


def _inside(x, y, ring):
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[-1:] + ring[:-1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def _ward(name, lat, lon):
    for props, polys in _polygons(name):
        for poly in polys:
            rings = [[p[:2] for p in r] for r in poly]
            if _inside(lon, lat, rings[0]) and not any(_inside(lon, lat, h) for h in rings[1:]):
                return props
    return None


def locate(lat, lon, place_text: str):
    """Return (city, ward, zone). city is 'PCMC', 'PMC' or None (outside both)."""
    if lat is None or lon is None:
        return None, None, None
    if p := _ward("pcmc_wards_datameet.geojson", lat, lon):
        return "PCMC", str(p["wardnum"]), p["zone"]
    if p := _ward("pmc_wards_2022_datameet.geojson", lat, lon):
        if any(v in place_text.lower() for v in LEFT_PMC_2024):
            return None, None, None
        return "PMC", p["Name1"], None
    return None, None, None
