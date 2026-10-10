"""Prove every published quote against the live government PDF.

For each published project: download the PDF again from PARIVESH, compare its SHA-256 with ours,
and check that the quote line is on the cited page. Writes the result into data/stats.json.
CLI: python -m vachan.proof
"""
import hashlib
import json
import os
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

import boto3

from vachan import bbox
from vachan.crawl import _get

BUCKET = os.environ.get("BUCKET", "")
s3 = boto3.client("s3")


def _squash(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def page_text(pdf: bytes, page: int) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf)
        f.flush()
        out = subprocess.run(["pdftotext", "-layout", "-f", str(page), "-l", str(page), f.name, "-"],
                             capture_output=True, timeout=60)
    return out.stdout.decode(errors="ignore")


def prove(projects: list[dict]) -> dict:
    """Check one PDF (all projects that cite it). Returns counts.

    While the file is open, also record where the quoted line is printed, so the website
    can highlight it. Only a quote we just proved gets a box.
    """
    src = projects[0]["source"]
    try:
        pdf = _get(src["parivesh_url"], timeout=120)
    except Exception as e:
        return {"checked": 0, "verified": 0, "unreachable": len(projects), "error": repr(e)[:120]}
    same_file = hashlib.sha256(pdf).hexdigest() == src["sha256"]
    verified = 0
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf)
        f.flush()
        for p in projects:
            page = p["source"]["page"]
            if not (same_file and _squash(p["owc_quote"]) in _squash(page_text(pdf, page))):
                continue
            verified += 1
            try:
                box = bbox.find(f.name, page, p["owc_quote"])
            except Exception as e:  # a box is a nicety; never fail the run for one
                print("bbox", p["id"], repr(e)[:120])
                box = None
            if box:
                p["quote_bbox"] = box
    return {"checked": len(projects), "verified": verified, "unreachable": 0, "changed": 0 if same_file else 1,
            "boxed": sum(1 for p in projects if p.get("quote_bbox"))}


def _read(key: str):
    return json.loads(s3.get_object(Bucket=BUCKET, Key=key)["Body"].read())


def handler(event=None, context=None):
    summaries = [p for p in _read("data/projects.json") if p["status"] == "auto"]
    by_pdf = {}
    for s in summaries:
        p = _read(f"data/p/{s['id']}.json")
        by_pdf.setdefault(p["source"]["sha256"], []).append(p)
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(prove, by_pdf.values()))
    total = {k: sum(r.get(k, 0) for r in results) for k in ("checked", "verified", "unreachable", "changed", "boxed")}

    # Put the highlight box on the published record. publish.py wrote these files earlier in
    # the same run, so this adds to them rather than fighting them.
    boxed = [p for group in by_pdf.values() for p in group if p.get("quote_bbox")]
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda p: s3.put_object(
            Bucket=BUCKET, Key=f"data/p/{p['id']}.json", Body=json.dumps(p, ensure_ascii=False).encode(),
            ContentType="application/json", CacheControl="max-age=300"), boxed))

    stats = _read("data/stats.json")
    stats["quotes_verified"], stats["quotes_checked"] = total["verified"], total["checked"]
    stats["quotes_boxed"] = total["boxed"]  # how many can be highlighted on the page
    s3.put_object(Bucket=BUCKET, Key="data/stats.json", Body=json.dumps(stats).encode(),
                  ContentType="application/json", CacheControl="max-age=300")
    print(json.dumps(total))
    return total


if __name__ == "__main__":
    handler()
