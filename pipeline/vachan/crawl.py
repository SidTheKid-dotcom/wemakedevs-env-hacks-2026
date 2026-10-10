"""Fetch the PARIVESH minutes indexes and copy new minutes PDFs to S3.

Writes index/todo.json: the documents the processing step must read
(one entry per unique PDF, keyed by SHA-256, because PARIVESH lists one PDF under several meeting ids).
"""
import hashlib
import json
import os
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import boto3

BUCKET = os.environ.get("BUCKET", "")
V2_INDEX = "https://parivesh.nic.in/agendamom/getAgendaMomDocumentByCommitteeV2?committee=SEAC&ref_type=MOM&workgroupId=1&state=27"
V1_INDEX = "https://parivesh.nic.in/parivesh_api/proponentApplicant/getParivesh1AgendaMom?committee=MoMCatB&workgroup=EC&type=Mom&authority=State"

# PARIVESH certificates are broken; the PDFs are public and we store their SHA-256.
TLS = ssl.create_default_context()
TLS.check_hostname = False
TLS.verify_mode = ssl.CERT_NONE
s3 = boto3.client("s3")


def _get(url: str, body=None, timeout=300) -> bytes:
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"} if body else {},
                                 method="POST" if body else "GET")
    with urllib.request.urlopen(req, context=TLS, timeout=timeout) as r:
        return r.read()


def minutes_index() -> list[dict]:
    """All Maharashtra SEAC minutes: PARIVESH 2.0 (2024 on) plus old SEAC-3 (2019-25)."""
    docs = []
    for r in json.loads(_get(V2_INDEX, body=json.dumps("SEAC").encode()))["data"]:
        if r.get("state") == "27" and r.get("pdfFilePath"):
            path = r["pdfFilePath"]
            docs.append({"meeting_id": str(r["meeting_id"]), "date": r["meeting_start_date"][:10],
                         "url": path if path.startswith("http") else "https://parivesh.nic.in" + path})
    try:  # the old portal is a frozen backfill (already in index/minutes.json); its outages must not stop a run
        v1 = json.loads(_get(V1_INDEX))
    except Exception as e:
        print("v1 index unavailable", repr(e)[:200])
        v1 = []
    for r in v1:
        url = (r.get("MoM_URL") or "").replace("http://", "https://")
        if "aharash" in (r.get("state_name") or "") and r.get("SEIAA_SEAC") == "SEAC3" and url.lower().endswith(".pdf"):
            docs.append({"meeting_id": str(r["meeting_id"]), "date": (r.get("from_date") or "")[:10], "url": url})
    return docs


def _known() -> dict:
    try:
        return json.loads(s3.get_object(Bucket=BUCKET, Key="index/minutes.json")["Body"].read())
    except s3.exceptions.NoSuchKey:
        return {}


def _copy(doc: dict) -> dict:
    pdf = _get(doc["url"], timeout=120)
    sha = hashlib.sha256(pdf).hexdigest()
    s3.put_object(Bucket=BUCKET, Key=f"pdf/{sha}.pdf", Body=pdf, ContentType="application/pdf")
    return {**doc, "sha256": sha}


def handler(event=None, context=None):
    """Copy every index entry we have not seen, in batches, and stop before the Lambda time limit.

    The next run continues where this one stopped. Event {"all": true} queues every known PDF
    again (to re-read them after a prompt change).
    """
    known = _known()
    new = [d for d in minutes_index() if d["meeting_id"] not in known]
    started, done, failed = time.time(), [], 0
    with ThreadPoolExecutor(16) as pool:
        for i in range(0, len(new), 64):
            if time.time() - started > 600:
                break
            for result in pool.map(lambda d: _try(_copy, d), new[i:i + 64]):
                if result:
                    known[result["meeting_id"]] = result
                    done.append(result)
                else:
                    failed += 1
    s3.put_object(Bucket=BUCKET, Key="index/minutes.json", Body=json.dumps(known))
    queue = list(known.values()) if (event or {}).get("all") else done
    todo = list({d["sha256"]: d for d in queue}.values())  # one entry per unique PDF
    s3.put_object(Bucket=BUCKET, Key="index/todo.json", Body=json.dumps(todo))
    return {"index": len(known), "new": len(done), "failed": failed, "left": len(new) - len(done) - failed,
            "todo": len(todo)}


def _try(fn, arg):
    try:
        return fn(arg)
    except Exception as e:  # one bad PDF must not stop the crawl
        print("copy failed", arg.get("url"), repr(e)[:200])
        return None
