"""Draft a polite letter that asks for the promised wet-waste plant to run. Lambda function URL handler.

The facts in the letter come from the published record, not from the model.
A daily cap keeps public use inside the budget.
"""
import json
import os
from datetime import date
from pathlib import Path

import boto3

BUCKET = os.environ.get("BUCKET", "")
TABLE = os.environ.get("TABLE", "")
MODEL_ID = os.environ.get("LETTER_MODEL_ID", "apac.amazon.nova-pro-v1:0")
DAILY_CAP = int(os.environ.get("DAILY_CAP", "300"))
#: Words the Bedrock guardrail refuses, in and out. The CDK stack reads this same file,
#: so the prompt and the guardrail can never disagree about them.
BLOCKED_WORDS = json.loads((Path(__file__).parent / "blocked_words.json").read_text())
GUARDRAIL_ID = os.environ.get("GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.environ.get("GUARDRAIL_VERSION", "DRAFT")
RECIPIENT = {
    "builder": "the builder (the project proponent named below)",
    "pcmc": "the Solid Waste Management Department, Pimpri Chinchwad Municipal Corporation",
    "pmc": "the Solid Waste Management Department, Pune Municipal Corporation",
}
LANGUAGES = {"en": "English", "mr": "Marathi", "hi": "Hindi"}
#: Terms the model must not guess. Without these it expanded "OWC" as "over-the-wall" and slipped
#: Hindi words ("गीली") into Marathi letters.
TERMS = {
    "en": "",
    "mr": "Write natural, everyday Marathi, as a resident would. Use Marathi words, not Hindi ones. "
          "Terms: OWC = organic waste converter, write it as \"ओला कचरा प्रक्रिया यंत्र (OWC)\"; wet waste = \"ओला कचरा\"; "
          "environmental clearance = \"पर्यावरण मंजुरी\"; minutes = \"इतिवृत्त\"; housing society = \"गृहनिर्माण संस्था\".",
    "hi": "Write natural, everyday Hindi, as a resident would. "
          "Terms: OWC = organic waste converter, write it as \"जैविक कचरा प्रसंस्करण यंत्र (OWC)\"; wet waste = \"गीला कचरा\"; "
          "environmental clearance = \"पर्यावरण मंज़ूरी\"; minutes = \"कार्यवृत्त\"; housing society = \"हाउसिंग सोसाइटी\".",
}
RULES = """Write a short, polite letter (under 220 words) from the residents of this housing project to {to}.
Language: {lang}. {terms}
Never expand an abbreviation unless these instructions give its meaning. Keep the quoted evidence line exactly as written, in English.
Purpose: ask whether the on-site wet-waste processing promised in the environmental-clearance minutes is built and running, and ask for it to run, so the waste is processed at source.
Use only these facts. Quote the evidence line exactly once. Cite the proposal number, meeting date and page.
Say "promised in writing". Do not accuse anyone of wrongdoing, and do not mention penalties or court action: the minutes record a promise, not a verdict. Ask only whether the promised plant is built and running. Do not give legal advice. Leave [Name] and [Flat no.] blank for the residents.
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
    prompt = RULES.format(to=RECIPIENT[to], lang=LANGUAGES[lang], terms=TERMS[lang], facts=json.dumps(facts, ensure_ascii=False))
    extra = {}
    if GUARDRAIL_ID:  # server-side guard: the browser filter alone is bypassable
        extra["guardrailConfig"] = {"guardrailIdentifier": GUARDRAIL_ID, "guardrailVersion": GUARDRAIL_VERSION}
    resp = bedrock.converse(modelId=MODEL_ID, messages=[{"role": "user", "content": [{"text": prompt}]}],
                            inferenceConfig={"maxTokens": 700, "temperature": 0.2}, **extra)
    if resp.get("stopReason") == "guardrail_intervened":
        raise ValueError("the draft was stopped by the guardrail")
    return resp["output"]["message"]["content"][0]["text"]


def handler(event, context=None):
    try:
        body = json.loads(event.get("body") or "{}")
        pid, to, lang = body["id"], body.get("to", "builder"), body.get("lang", "en")
        if to not in RECIPIENT or lang not in LANGUAGES or not pid.replace("-", "").isalnum():
            return _reply(400, {"error": "bad request"})
        if _over_cap():
            return _reply(429, {"error": "Daily letter limit reached. Please try again tomorrow."})
        project = json.loads(s3.get_object(Bucket=BUCKET, Key=f"data/p/{pid}.json")["Body"].read())
        return _reply(200, {"text": draft(project, to, lang)})
    except s3.exceptions.NoSuchKey:
        return _reply(404, {"error": "project not found"})
    except ValueError as e:  # the guardrail stopped the draft; the card and its page still stand
        print("guardrail", e)
        return _reply(422, {"error": "The draft could not be written safely. The promise and the page are still here."})
    except (KeyError, json.JSONDecodeError):
        return _reply(400, {"error": "bad request"})


def _reply(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}
