"""Draft a polite letter that asks for the promised wet-waste plant to run. Lambda function URL handler.

The facts in the letter come from the published record, not from the model.
A daily cap keeps public use inside the budget.
"""
import json
import os
from datetime import date

import boto3

BUCKET = os.environ.get("BUCKET", "")
TABLE = os.environ.get("TABLE", "")
MODEL_ID = os.environ.get("LETTER_MODEL_ID", "apac.amazon.nova-pro-v1:0")
DAILY_CAP = int(os.environ.get("DAILY_CAP", "300"))
RECIPIENT = {
    "builder": "the builder (the project proponent named below)",
    "pcmc": "the Solid Waste Management Department, Pimpri Chinchwad Municipal Corporation",
    "pmc": "the Solid Waste Management Department, Pune Municipal Corporation",
}
RULES = """Write a short, polite letter (under 220 words) from the residents of this housing project to {to}.
Language: {lang}.
Purpose: ask whether the on-site wet-waste processing promised in the environmental-clearance minutes is built and running, and ask for it to run, so the waste is processed at source.
Use only these facts. Quote the evidence line exactly once. Cite the proposal number, meeting date and page.
Say "promised in writing". Never say violated, failed, illegal or missing. Do not give legal advice. Leave [Name] and [Flat no.] blank for the residents.
FACTS:
{facts}"""
s3 = boto3.client("s3")
bedrock = boto3.client("bedrock-runtime", region_name="ap-south-1")


def _over_cap() -> bool:
    table = boto3.resource("dynamodb").Table(TABLE)
    count = table.update_item(
        Key={"key": "_letters", "sha256": date.today().isoformat()},
        UpdateExpression="ADD n :one", ExpressionAttributeValues={":one": 1}, ReturnValues="UPDATED_NEW",
    )["Attributes"]["n"]
    return count > DAILY_CAP


def draft(project: dict, to: str, lang: str) -> str:
    facts = {k: project.get(k) for k in ("project_name", "builder", "village", "city", "proposal_id", "meeting_date",
                                         "wet_kg_day", "owc_promised", "owc_quote", "tenements")}
    facts["page"] = project["source"]["page"]
    prompt = RULES.format(to=RECIPIENT[to], lang="Marathi" if lang == "mr" else "English", facts=json.dumps(facts, ensure_ascii=False))
    resp = bedrock.converse(modelId=MODEL_ID, messages=[{"role": "user", "content": [{"text": prompt}]}],
                            inferenceConfig={"maxTokens": 700, "temperature": 0.2})
    return resp["output"]["message"]["content"][0]["text"]


def handler(event, context=None):
    try:
        body = json.loads(event.get("body") or "{}")
        pid, to, lang = body["id"], body.get("to", "builder"), body.get("lang", "en")
        if to not in RECIPIENT or lang not in ("en", "mr") or not pid.replace("-", "").isalnum():
            return _reply(400, {"error": "bad request"})
        if _over_cap():
            return _reply(429, {"error": "Daily letter limit reached. Please try again tomorrow."})
        project = json.loads(s3.get_object(Bucket=BUCKET, Key=f"data/p/{pid}.json")["Body"].read())
        return _reply(200, {"text": draft(project, to, lang)})
    except s3.exceptions.NoSuchKey:
        return _reply(404, {"error": "project not found"})
    except (KeyError, json.JSONDecodeError):
        return _reply(400, {"error": "bad request"})


def _reply(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}
