"""Turn extraction rows (DynamoDB) into the static JSON the website reads (S3, served by CloudFront).

Writes data/stats.json, data/projects.json (summaries) and data/p/<id>.json (full records).
One project per proposal (its newest minutes), then one per site (same point to ~100 m: expansions).
"""
import json
import math
import os
import re
from datetime import datetime, timezone
from decimal import Decimal

import boto3

BUCKET = os.environ.get("BUCKET", "")
TABLE = os.environ.get("TABLE", "")
CDN = os.environ.get("CDN_URL", "")  # https://<cloudfront domain>
s3 = boto3.client("s3")


def _rows():
    table = boto3.resource("dynamodb").Table(TABLE)
    resp = table.scan()
    yield from resp["Items"]
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        yield from resp["Items"]


def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == int(value) else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def project(row: dict) -> dict:
    r = row["record"]
    return {
        "id": re.sub(r"[^a-z0-9]+", "-", row["proposal_id"].lower()).strip("-"),
        "proposal_id": row["proposal_id"], "title": row["title"],
        "project_name": r.get("project_name") or row["title"], "builder": r.get("builder"), "village": r.get("village"),
        "city": row["city"], "ward": row["ward"], "zone": row.get("zone"), "lat": row["lat"], "lon": row["lon"],
        "tenements": r.get("tenements"), "wet_kg_day": r.get("wet_kg_day_operation"),
        "owc_promised": r.get("owc_promised"), "owc_quote": row.get("quote"),
        "solar_promised": r.get("solar_promised"), "energy_saving_pct": r.get("energy_saving_pct"),
        "stp_kld": r.get("stp_kld"), "decision": r.get("decision"), "meeting_date": row["date"],
        "source": {"parivesh_url": row["source_url"], "mirror_url": f"{CDN}/pdf/{row['sha256']}.pdf",
                   "page": row["page"], "sha256": row["sha256"]},
        "status": row["status"], "checks": row["checks"], "review_reason": row.get("review_reason"),
        "related_proposal_ids": [],
    }


def _builder(name) -> str:
    """'M/s. Pride Builder LLP' and 'Pride Builders LLP' -> 'pride builder'."""
    words = re.sub(r"[^a-z ]", " ", (name or "").lower().replace("m/s", "")).split()
    return " ".join(w.rstrip("s") for w in words if w not in {"llp", "pvt", "ltd", "limited", "private", "the"})


def _km(a: dict, b: dict) -> float:
    return 111 * math.hypot(a["lat"] - b["lat"], (a["lon"] - b["lon"]) * math.cos(math.radians(a["lat"])))


def same_site(a: dict, b: dict) -> bool:
    """Expansions repeat a site under a new proposal id: same point, or same builder within 1 km."""
    if a["city"] != b["city"]:
        return False
    d = _km(a, b)
    return d < 0.1 or (d < 1 and bool(_builder(a["builder"])) and _builder(a["builder"]) == _builder(b["builder"]))


def build(rows) -> tuple[list[dict], dict]:
    newest = {}
    for row in rows:  # one row per proposal: its newest minutes
        if row["key"] not in newest or row["date"] > newest[row["key"]]["date"]:
            newest[row["key"]] = row
    kept = []
    for p in sorted(map(project, newest.values()), key=lambda x: x["meeting_date"], reverse=True):
        same = next((k for k in kept if same_site(k, p)), None)
        if same:  # an older expansion or amendment of a site we already have: keep the newest only
            same["related_proposal_ids"] += [p["proposal_id"]] + p["related_proposal_ids"]
        else:
            kept.append(p)
    projects = sorted(kept, key=lambda p: -(p["wet_kg_day"] or 0))
    counted = [p for p in projects if p["decision"] == "recommended" and p["status"] == "auto"]
    stats = {
        "wet_kg_day_total": round(sum(p["wet_kg_day"] for p in counted)),
        "wet_kg_day_pmc": round(sum(p["wet_kg_day"] for p in counted if p["city"] == "PMC")),
        "wet_kg_day_pcmc": round(sum(p["wet_kg_day"] for p in counted if p["city"] == "PCMC")),
        "projects": len(projects), "counted_projects": len(counted),
        "owc_projects": sum(1 for p in counted if p["owc_promised"]),
        "review_count": sum(1 for p in projects if p["status"] == "review"),
        "quotes_verified": None,  # filled by the proof step
        "newest_meeting_date": max((p["meeting_date"] for p in projects), default=None),
        "published_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    return projects, stats


SUMMARY = ("id", "project_name", "builder", "village", "city", "ward", "lat", "lon", "wet_kg_day", "owc_promised",
           "decision", "meeting_date", "status")


def _put(key: str, body) -> None:
    s3.put_object(Bucket=BUCKET, Key=key, Body=json.dumps(body, ensure_ascii=False).encode(),
                  ContentType="application/json", CacheControl="max-age=300")


def handler(event=None, context=None):
    projects, stats = build(_plain(r) for r in _rows())
    for p in projects:
        _put(f"data/p/{p['id']}.json", p)
    _put("data/projects.json", [{k: p[k] for k in SUMMARY} for p in projects])
    _put("data/stats.json", stats)
    return stats
