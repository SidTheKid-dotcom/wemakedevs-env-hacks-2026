"""Read one agenda item with Bedrock and return the promise record (dict).

The model only reads. Plain code (checks.py) finds the evidence line and decides whether we trust it.
"""
import json
import os
import re

import boto3

MODEL_ID = os.environ.get("EXTRACT_MODEL_ID", "apac.amazon.nova-pro-v1:0")
KEYWORDS = ("Solid Waste", "Wet waste", "Wet garbage", "OWC", "Organic Waste", "compost", "Solar", "Energy saving",
            "STP", "Sludge", "Tenement", "Flats", "Decision", "Recommendation")
PROMPT = """You read one item from the minutes of a Maharashtra State Expert Appraisal Committee (SEAC) meeting.
Fill the record tool from this text only. Rules:
- wet_kg_day_operation is the wet waste in the OPERATION phase table, in kg/day. Never use the construction phase or labour camp figure.
- builder is the company or firm name only. Never output phone numbers, e-mails or personal addresses.
- decision is the committee's decision for this item: recommended, deferred, not_recommended, withdrawn, or unclear.
  Sending or forwarding the proposal to SEIAA for approval or further action counts as recommended.
- owc_promised is true if operation-phase wet waste is processed on site (OWC, organic waste converter, in-situ composting, vermicomposting or biogas).
- owc_capacity_kg_day is only a capacity stated in kg/day for the OWC itself. Otherwise null.
- Use null for anything the text does not state.

TEXT:
"""

FIELDS = {
    "project_name": "string", "builder": "string", "village": "string", "tenements": "integer",
    "wet_kg_day_operation": "number", "wet_kg_day_construction": "number", "dry_kg_day_operation": "number",
    "owc_promised": "boolean", "owc_capacity_kg_day": "number", "stp_kld": "number",
    "solar_promised": "boolean", "energy_saving_pct": "number",
    "decision": {"type": "string", "enum": ["recommended", "deferred", "not_recommended", "withdrawn", "unclear"]},
}
TOOL = {"toolSpec": {"name": "record", "description": "The promise record for this item.", "inputSchema": {"json": {
    "type": "object",
    "properties": {k: (v if isinstance(v, dict) else {"type": [v, "null"]}) for k, v in FIELDS.items()},
    "required": list(FIELDS),
}}}}

_bedrock = None


def trim(text: str, limit: int = 14000) -> str:
    """Keep the parts of a long item that matter, as verbatim slices (so quotes stay findable)."""
    if len(text) <= limit:
        return text
    spans = [(0, 3000), (len(text) - 2000, len(text))]
    for k in KEYWORDS:
        spans += [(m.start() - 300, m.start() + 900) for m in re.finditer(re.escape(k), text, re.I)]
    spans.sort()
    merged = []
    for a, b in spans:
        a, b = max(a, 0), min(b, len(text))
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return "\n...\n".join(text[a:b] for a, b in merged)[: limit * 2]


def extract(item_text: str, model_id: str = MODEL_ID) -> dict:
    global _bedrock
    _bedrock = _bedrock or boto3.client("bedrock-runtime", region_name="ap-south-1")
    resp = _bedrock.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": PROMPT + trim(item_text)}]}],
        toolConfig={"tools": [TOOL], "toolChoice": {"tool": {"name": "record"}}},
        inferenceConfig={"maxTokens": 1200, "temperature": 0},
    )
    block = next(c for c in resp["output"]["message"]["content"] if "toolUse" in c)
    record = block["toolUse"]["input"]
    record["_usage"] = resp["usage"]
    return record


if __name__ == "__main__":
    import sys
    print(json.dumps(extract(open(sys.argv[1]).read()), indent=1))
