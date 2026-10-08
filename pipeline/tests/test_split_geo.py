from vachan.geo import latlon, locate
from vachan.split import split

OLD = """Minutes of meeting
P-13     146419/2020 Sai Paradise at S. No. 12/1 to 7, Punawale
  Proposal Number                 PARIVESH NO: MIS/146419
  Latitude 18°37'52" N Longitude 73°44'31" E
Decision: - Committee decided to recommend the proposal.
\f  28. P-28     SIA/MH/MIS/214797/2021 Amendment in Residential development at Undri
  Proposal Number   SIA/MH/MIS/214797/2021
"""

V2 = """3.5. Agenda Item No 5:
3.5.1. Details of the proposal
 Proposed Residential Project at Dudulgaon by M/s Shree Sai Mangal Developers

 Proposal For      Fresh EC
 SIA/MH/INFRA2/562192/202              SIA/MH/INFRA2/562192/202
    1.           Proposal Number                            SIA/MH/INFRA2/562192/2025
10.     Latitude and Longitude                                   Latitude –180 40’ 27.85” N
                                                                 Longitude–73052’52.52” E
"""


def test_old_format_and_page_break():
    items = split(OLD)
    assert [i.key for i in items] == ["146419", "214797"]
    assert items[0].proposal_id == "PARIVESH NO: MIS/146419"
    assert items[1].page == 2


def test_parivesh2_format_and_title():
    (item,) = split(V2)
    assert item.proposal_id == "SIA/MH/INFRA2/562192/2025"
    assert item.title.startswith("Proposed Residential Project at Dudulgaon")


def test_latlon_with_curly_quotes_and_ocr_degree():
    lat, lon = latlon(V2)
    assert (round(lat, 3), round(lon, 3)) == (18.674, 73.881)


def test_locate_pmc_pcmc_and_outside():
    assert locate(18.519882, 73.931274, "Hadapsar")[0] == "PMC"
    assert locate(18.631111, 73.741944, "Punawale")[:2] == ("PCMC", "52")
    assert locate(19.0760, 72.8777, "Mumbai") == (None, None, None)
    assert locate(None, None, "") == (None, None, None)
