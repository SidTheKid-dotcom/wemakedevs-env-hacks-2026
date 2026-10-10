"""Check the published JSON the website reads.

The site shows numbers that must trace to a source PDF. This fails the build if the
published data breaks one of those promises, so a bad nightly run cannot sit on the
live site unnoticed. The data is public, so this needs no AWS credentials.

    DATA_URL=https://... python pipeline/tools/check_published.py
"""
import json
import os
import sys
import urllib.request

DATA = os.environ.get("DATA_URL", "https://d18hjofgs77fd1.cloudfront.net").rstrip("/")
CITIES = {"PMC", "PCMC"}
STATUSES = {"auto", "review"}


def get(path):
    with urllib.request.urlopen(f"{DATA}/data/{path}", timeout=30) as r:
        return json.load(r)


def main():
    bad = []

    def check(ok, msg):
        if not ok:
            bad.append(msg)

    stats, projects = get("stats.json"), get("projects.json")

    # --- the totals on the home page ---
    check(stats["projects"] == len(projects), f"stats.projects {stats['projects']} != {len(projects)} rows in projects.json")
    check(stats["counted_projects"] <= stats["projects"], "counted_projects is larger than projects")
    check(stats["owc_projects"] <= stats["counted_projects"], "owc_projects is larger than counted_projects")
    check(stats["wet_kg_day_total"] > 0, "wet_kg_day_total is zero")
    check(
        stats["wet_kg_day_pmc"] + stats["wet_kg_day_pcmc"] == stats["wet_kg_day_total"],
        f"city totals {stats['wet_kg_day_pmc']} + {stats['wet_kg_day_pcmc']} != {stats['wet_kg_day_total']}",
    )

    # --- the proof line under the hero ---
    check(stats["quotes_checked"] > 0, "no quotes were re-checked in the last run")
    check(
        stats["quotes_verified"] == stats["quotes_checked"],
        f"only {stats['quotes_verified']} of {stats['quotes_checked']} quotes still match the government PDF",
    )

    # --- every row the map and the ward lists depend on ---
    for p in projects:
        where = p.get("id", "?")
        if p.get("city") not in CITIES:
            bad.append(f"{where}: city is {p.get('city')!r}")
        if not p.get("ward"):
            bad.append(f"{where}: no ward, so it cannot appear on an officer's list")
        if p.get("status") not in STATUSES:
            bad.append(f"{where}: status is {p.get('status')!r}")
        if p.get("lat") is None or p.get("lon") is None:
            bad.append(f"{where}: no position, so it cannot go on the map")
        # The honesty rule: a counted number must carry the quote it was read from.
        # A number we could not verify is not deleted, it is sent to review with a reason.
        if p.get("status") == "auto" and p.get("wet_kg_day") is not None and not p.get("quote"):
            bad.append(f"{where}: counted {p['wet_kg_day']} kg a day with no source quote")
        if not p.get("quote") and p.get("status") == "review" and not p.get("review_reason"):
            bad.append(f"{where}: sent to review with no reason shown to the reader")
        if not p.get("pdf") or p.get("page") is None:
            bad.append(f"{where}: no source PDF page to open")
        if len(bad) > 40:  # enough to diagnose; no point printing thousands
            bad.append("… more problems not shown")
            break

    if bad:
        print(f"Published data failed {len(bad)} check(s):", file=sys.stderr)
        for b in bad:
            print(f"  - {b}", file=sys.stderr)
        return 1

    review = sum(1 for p in projects if p.get("status") == "review")
    print(
        f"Published data is good: {stats['projects']} sites, "
        f"{stats['counted_projects']} counted and {review} held for a person to check, "
        f"{stats['wet_kg_day_total']} kg a day promised, "
        f"{stats['quotes_verified']}/{stats['quotes_checked']} quotes re-checked, "
        f"published {stats['published_at']}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
