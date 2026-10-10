"""The highlight box must cover the quoted line and nothing above or below it.

Table rows in these minutes sit about 10 points apart, so a box that grows by vertical
overlap alone swallows the neighbouring cell. These tests pin the tighter rule.
"""
import subprocess

import pytest

from vachan import bbox

pytestmark = pytest.mark.skipif(
    subprocess.run(["which", "pdftotext"], capture_output=True).returncode != 0,
    reason="poppler is not installed",
)

# One page of a minutes-style table, written out as PDF by poppler's own tooling would be
# circular, so the fixture is built with reportlab-free plain PostScript via `ps2pdf` when
# available; otherwise these tests are skipped.
PS = """%!PS-Adobe-3.0
/Helvetica findfont 10 scalefont setfont
72 700 moveto (Solid Waste Management during Construction Phase) show
72 688 moveto (Wet waste 30 kg/day Sent to vendor) show
72 676 moveto (Wet waste 922.61 In-situ Composting) show
72 664 moveto (Dry waste 415 kg/day Sold to recycler) show
showpage
"""


@pytest.fixture(scope="module")
def pdf(tmp_path_factory):
    if subprocess.run(["which", "ps2pdf"], capture_output=True).returncode != 0:
        pytest.skip("ghostscript (ps2pdf) is not installed")
    d = tmp_path_factory.mktemp("bbox")
    ps, out = d / "t.ps", d / "t.pdf"
    ps.write_text(PS)
    subprocess.run(["ps2pdf", str(ps), str(out)], check=True, timeout=60)
    return str(out)


def words_in(pdf, box):
    words, _ = bbox._words(pdf, box["page"])
    return " ".join(w[4] for w in words
                    if box["x0"] <= w[0] and w[2] <= box["x1"] and box["y0"] <= w[1] and w[3] <= box["y1"])


def test_box_holds_the_quoted_line_only(pdf):
    box = bbox.find(pdf, 1, "Wet waste 922.61 In-situ Composting")
    assert box is not None
    inside = words_in(pdf, box)
    assert "922.61" in inside and "In-situ" in inside
    assert "30" not in inside and "415" not in inside  # not the row above or below


def test_the_right_row_when_two_rows_say_wet_waste(pdf):
    """The construction row also says "Wet waste". The figure picks the row."""
    box = bbox.find(pdf, 1, "Wet waste 30 kg/day Sent to vendor")
    assert "vendor" in words_in(pdf, box) and "922.61" not in words_in(pdf, box)


def test_box_is_inside_the_page(pdf):
    box = bbox.find(pdf, 1, "Wet waste 922.61 In-situ Composting")
    assert 0 <= box["x0"] < box["x1"] <= box["pw"]
    assert 0 <= box["y0"] < box["y1"] <= box["ph"]


def test_a_quote_with_no_figure_has_no_box(pdf):
    assert bbox.find(pdf, 1, "Organic waste converter") is None


def test_a_figure_not_on_the_page_has_no_box(pdf):
    assert bbox.find(pdf, 1, "Wet waste 1250000 In-situ Composting") is None
