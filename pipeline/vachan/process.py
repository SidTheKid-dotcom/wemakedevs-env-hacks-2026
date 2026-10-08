"""Read one minutes PDF: text -> agenda items -> Pune items -> Bedrock record -> checks -> DynamoDB.

Input (one entry of index/todo.json): {"meeting_id", "date", "url", "sha256"}.
"""
import os
import subprocess
from decimal import Decimal

import boto3

from vachan import checks
from vachan.extract import MODEL_ID, extract
from vachan.geo import latlon, locate
from vachan.split import page_at, split

BUCKET = os.environ.get("BUCKET", "")
TABLE = os.environ.get("TABLE", "")
s3 = boto3.client("s3")


def pdf_text(sha: str) -> str:
    pdf, txt = f"/tmp/{sha}.pdf", f"/tmp/{sha}.txt"
    s3.download_file(BUCKET, f"pdf/{sha}.pdf", pdf)
    subprocess.run(["pdftotext", "-layout", pdf, txt], check=True, timeout=300)
    text = open(txt, errors="ignore").read()
    os.remove(pdf), os.remove(txt)
    s3.put_object(Bucket=BUCKET, Key=f"text/{sha}.txt", Body=text.encode())
    return text


def _dynamo(value):
    """DynamoDB wants Decimal, not float."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_dynamo(v) for v in value]
    return value


def handler(doc, context=None):
    try:
        text = pdf_text(doc["sha256"])
    except subprocess.CalledProcessError:  # a damaged PDF poppler cannot open (e.g. meeting 47956)
        return {"sha256": doc["sha256"], "unreadable": True, "items": 0, "pune": 0}
    if len(text.strip()) < 2000:  # no text layer: a scanned PDF
        return {"sha256": doc["sha256"], "scanned": True, "items": 0, "pune": 0}
    table = boto3.resource("dynamodb").Table(TABLE)
    items, pune = split(text), 0
    for item in items:
        lat, lon = latlon(item.text)
        city, ward, zone = locate(lat, lon, item.title + item.text[:3000])
        if not city:
            continue
        pune += 1
        record = extract(item.text)
        usage = record.pop("_usage", {})
        result, status, reason, quote, offset = checks.run(record, item.text)
        table.put_item(Item=_dynamo({
            "key": item.key, "sha256": doc["sha256"],
            "proposal_id": item.proposal_id, "title": item.title, "meeting_id": doc["meeting_id"],
            "date": doc["date"], "source_url": doc["url"],
            "page": page_at(text, item.start + offset) if offset is not None else item.page,
            "city": city, "ward": ward, "zone": zone, "lat": lat, "lon": lon,
            "record": record, "quote": quote, "checks": result, "status": status, "review_reason": reason,
            "model_id": MODEL_ID, "tokens": usage,
        }))
    return {"sha256": doc["sha256"], "scanned": False, "items": len(items), "pune": pune}
