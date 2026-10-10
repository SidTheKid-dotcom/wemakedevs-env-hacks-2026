"""A gold set for the rules that decide a project's status.

The model reads the minutes, but plain code decides whether a number is shown as a
counted promise or held for a person to check. That decision puts 776 promises on the
map, so it gets a table of real cases, not invented ones.

Every excerpt below is the real shape of a line in a SEAC minutes PDF: the spacing,
the dashes, the "garbage" spelling and the broken table columns are all as found.
Extend this table with Shreya's hand-labelled set when it lands.
"""
import pytest

from vachan import checks

# (name, minutes text, model record, expected status, text expected in the reason)
CASES = [
    (
        "plain operation figure is counted",
        "Operation Phase      Wet waste:      135.00 kg/Day      converting to compost",
        {"wet_kg_day_operation": 135.0, "decision": "recommended"},
        "auto", None,
    ),
    (
        "comma thousands are read",
        "Solid waste         Wet Waste: 17,477 kg/day        as per revised plan",
        {"wet_kg_day_operation": 17477, "decision": "recommended"},
        "auto", None,
    ),
    (
        "'garbage' is the same promise as 'waste'",
        "Solid waste manag     Wet garbage - 1176 kg/day      Treated in OWC",
        {"wet_kg_day_operation": 1176, "decision": "recommended"},
        "auto", None,
    ),
    (
        "no space around the dash and the unit",
        "Solid waste m     Wet garbage -219Kg/day       Increased by",
        {"wet_kg_day_operation": 219, "decision": "recommended"},
        "auto", None,
    ),
    (
        "a figure with no unit still counts",
        "Phase & Capacity of OWC      Wet waste      205        OWC",
        {"wet_kg_day_operation": 205, "decision": "recommended"},
        "auto", None,
    ),
    (
        "the construction-phase figure is held, not counted",
        "During Construction Phase    Wet waste   30 kg/day\n"
        "During Operation Phase       Wet waste   424 kg/day    machines",
        {"wet_kg_day_operation": 30, "decision": "recommended"},
        "review", "construction phase",
    ),
    (
        "the operation figure beside a construction figure is counted",
        "During Construction Phase    Wet waste   30 kg/day\n"
        "During Operation Phase       Wet waste   424 kg/day    machines",
        {"wet_kg_day_operation": 424, "decision": "recommended"},
        "auto", None,
    ),
    (
        "a figure that is not in the minutes is held",
        "Operation Phase      Wet waste:      135.00 kg/Day      converting to compost",
        {"wet_kg_day_operation": 1250000, "decision": "recommended"},
        "review", "Could not find",
    ),
    (
        "an unreadable committee decision is held",
        "Operation Phase      Wet waste:      135.00 kg/Day",
        {"wet_kg_day_operation": 135.0, "decision": "unclear"},
        "review", "decision",
    ),
    (
        "an impossible amount per flat is held",
        "Solid waste         Wet Waste: 17,477 kg/day",
        {"wet_kg_day_operation": 17477, "tenements": 120, "decision": "recommended"},
        "review", "per flat",
    ),
    (
        "a believable amount per flat is counted",
        "Solid waste      Wet waste: 513 kg/day      Organic Waste Convertor",
        {"wet_kg_day_operation": 513, "tenements": 327, "decision": "recommended"},
        "auto", None,
    ),
    (
        "a plant too small for the promise is held",
        "Solid waste      Wet waste: 513 kg/day      Organic Waste Convertor",
        {"wet_kg_day_operation": 513, "owc_capacity_kg_day": 300, "decision": "recommended"},
        "review", "capacity",
    ),
]


@pytest.mark.parametrize("name,text,record,want_status,want_reason", CASES, ids=[c[0] for c in CASES])
def test_rule(name, text, record, want_status, want_reason):
    _, status, reason, quote, _ = checks.run(record, text)
    assert status == want_status, f"{name}: got {status} because {reason!r}"
    if want_reason:
        assert want_reason.lower() in (reason or "").lower(), f"{name}: reason was {reason!r}"
    else:
        assert reason is None
        # A counted promise always carries the line it was read from.
        assert quote and str(record["wet_kg_day_operation"]).rstrip("0").rstrip(".") in quote.replace(",", "")


def test_every_review_reason_is_plain_english():
    """A reader sees these words. They must not blame anyone or use our jargon."""
    banned = ("violat", "fail", "illegal", "missing plant", "error", "null", "none")
    for key, reason in checks.REASONS.items():
        low = reason.lower()
        assert reason[0].isupper() and reason.endswith("."), f"{key}: {reason!r} is not a sentence"
        for word in banned:
            assert word not in low, f"{key}: {reason!r} uses {word!r}"
