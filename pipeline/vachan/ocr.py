"""Read a scanned minutes PDF with Amazon Textract.

Most minutes are born-digital and `pdftotext` reads them. A few are photographs of paper,
where poppler returns almost nothing and the whole meeting drops out silently. Textract
reads those, so the projects inside them are not lost.

The text is rebuilt with a form feed between pages, because `split.page_at` counts those
to find the page a promise is printed on.
"""
import os
import time

import boto3

textract = boto3.client("textract")
POLL_SECONDS = 5
MAX_WAIT = int(os.environ.get("OCR_MAX_WAIT", "540"))  # the Lambda has 15 minutes


def looks_scanned(text: str, pages_hint: int = 1) -> bool:
    """True when poppler found so little text that the file must be images."""
    return len(text.strip()) < max(1000, 40 * pages_hint)


def read(bucket: str, key: str) -> str:
    """The document's text, pages separated by a form feed. Raises on failure."""
    job = textract.start_document_text_detection(
        DocumentLocation={"S3Object": {"Bucket": bucket, "Name": key}},
    )["JobId"]

    waited = 0
    while True:
        r = textract.get_document_text_detection(JobId=job, MaxResults=1)
        status = r["JobStatus"]
        if status == "SUCCEEDED":
            break
        if status == "FAILED":
            raise RuntimeError(f"textract failed: {r.get('StatusMessage', '')[:200]}")
        if waited >= MAX_WAIT:
            raise TimeoutError(f"textract did not finish in {MAX_WAIT}s")
        time.sleep(POLL_SECONDS)
        waited += POLL_SECONDS

    lines: dict[int, list[str]] = {}
    token = None
    while True:
        page = textract.get_document_text_detection(JobId=job, **({"NextToken": token} if token else {}))
        for b in page["Blocks"]:
            if b["BlockType"] == "LINE":
                lines.setdefault(b.get("Page", 1), []).append(b["Text"])
        token = page.get("NextToken")
        if not token:
            break

    # A form feed *between* pages, never before the first: `page_at` counts them, so a
    # leading "\f" would push every page number up by one.
    return "\f".join("\n".join(lines[p]) + "\n" for p in sorted(lines))
