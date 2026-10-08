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
    """Check one PDF (all projects that cite it). Returns counts."""
    src = projects[0]["source"]
    try:
        pdf = _get(src["parivesh_url"], timeout=120)
    except Exception as e:
        return {"checked": 0, "verified": 0, "unreachable": len(projects), "error": repr(e)[:120]}
    same_file = hashlib.sha256(pdf).hexdigest() == src["sha256"]
    verified = sum(1 for p in projects
                   if same_file and _squash(p["owc_quote"]) in _squash(page_text(pdf, p["source"]["page"])))
    return {"checked": len(projects), "verified": verified, "unreachable": 0, "changed": 0 if same_file else 1}


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
    total = {k: sum(r.get(k, 0) for r in results) for k in ("checked", "verified", "unreachable", "changed")}
    stats = _read("data/stats.json")
    stats["quotes_verified"], stats["quotes_checked"] = total["verified"], total["checked"]
    s3.put_object(Bucket=BUCKET, Key="data/stats.json", Body=json.dumps(stats).encode(),
                  ContentType="application/json", CacheControl="max-age=300")
    print(json.dumps(total))
    return total


if __name__ == "__main__":
    handler()
