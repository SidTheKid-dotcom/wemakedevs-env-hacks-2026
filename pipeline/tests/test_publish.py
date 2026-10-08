from vachan.publish import build


def row(key, date, wet, decision="recommended", status="auto", lat=18.6311, lon=73.7419):
    return {"key": key, "sha256": "abc", "proposal_id": f"SIA/MH/MIS/{key}/2020", "title": "t", "meeting_id": "1",
            "date": date, "source_url": "u", "page": 49, "city": "PCMC", "ward": "52", "zone": "B",
            "lat": lat, "lon": lon, "quote": "Wet waste: 1", "checks": [], "status": status, "review_reason": None,
            "record": {"wet_kg_day_operation": wet, "decision": decision, "owc_promised": True}}


def test_newest_minutes_wins_and_expansion_folds_into_site():
    projects, stats = build([
        row("100", "2020-01-01", 500),
        row("100", "2021-01-01", 600),   # same proposal, newer minutes
        row("200", "2023-01-01", 900),   # expansion at the same point
    ])
    assert len(projects) == 1
    assert projects[0]["wet_kg_day"] == 900
    assert projects[0]["related_proposal_ids"] == ["SIA/MH/MIS/100/2020"]
    assert stats["wet_kg_day_total"] == 900


def test_only_recommended_and_checked_records_count():
    _, stats = build([
        row("1", "2020-01-01", 500, lat=18.60),
        row("2", "2020-01-01", 700, decision="deferred", lat=18.61),
        row("3", "2020-01-01", 900, status="review", lat=18.62),
    ])
    assert stats["wet_kg_day_total"] == 500
    assert stats["review_count"] == 1
