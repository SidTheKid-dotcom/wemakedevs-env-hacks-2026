from vachan import checks

TEXT = """Solid Waste  During Construction Phase
   Wet waste:   18.00 Kg/Day   Send to Authorized Vendor
Solid Waste  During Operation Phase
   Wet waste:   513 kg/day      Organic Waste Convertor
"""


def test_operation_figure_passes_and_quote_is_the_source_line():
    rec = {"wet_kg_day_operation": 513, "tenements": 327, "decision": "recommended"}
    result, status, reason, quote, _ = checks.run(rec, TEXT)
    assert status == "auto" and reason is None
    assert quote == "Wet waste: 513 kg/day Organic Waste Convertor"


def test_construction_figure_goes_to_review():
    rec = {"wet_kg_day_operation": 18, "tenements": 327, "decision": "recommended"}
    _, status, reason, _, _ = checks.run(rec, TEXT)
    assert status == "review" and "construction phase" in reason


def test_figure_not_in_text_goes_to_review():
    _, status, reason, quote, _ = checks.run({"wet_kg_day_operation": 132000, "decision": "recommended"}, TEXT)
    assert status == "review" and quote is None and "Could not find" in reason
