"""OCR is a rescue for photographed minutes. It must only fire when poppler found nothing,
and the text it returns must keep page breaks, because the page number on every card
is counted from them.
"""
from vachan import ocr, split


def test_a_normal_meeting_is_not_sent_to_ocr():
    assert not ocr.looks_scanned("Wet waste: 513 kg/day Organic Waste Convertor " * 200, pages_hint=120)


def test_an_empty_read_is_sent_to_ocr():
    assert ocr.looks_scanned("\f\f\f   \n  ", pages_hint=120)


def test_a_one_page_note_is_not_mistaken_for_a_scan():
    """A short but real page: the floor is 1,000 characters, not a page count."""
    assert ocr.looks_scanned("Minutes of the meeting.", pages_hint=1)


def test_rebuilt_text_keeps_page_numbers(monkeypatch):
    """Textract gives a page number per line; page_at must agree with it."""
    blocks = [
        {"BlockType": "LINE", "Page": 1, "Text": "Agenda item 1"},
        {"BlockType": "LINE", "Page": 2, "Text": "Wet waste 922.61 In-situ Composting"},
        {"BlockType": "WORD", "Page": 2, "Text": "ignored"},
        {"BlockType": "LINE", "Page": 3, "Text": "Agenda item 3"},
    ]
    calls = {"n": 0}

    class FakeTextract:
        def start_document_text_detection(self, **kw):
            return {"JobId": "job-1"}

        def get_document_text_detection(self, **kw):
            calls["n"] += 1
            return {"JobStatus": "SUCCEEDED", "Blocks": blocks}

    monkeypatch.setattr(ocr, "textract", FakeTextract())
    text = ocr.read("bucket", "pdf/abc.pdf")
    assert "922.61" in text and "ignored" not in text
    assert split.page_at(text, text.index("922.61")) == 2
    assert split.page_at(text, text.index("Agenda item 3")) == 3
