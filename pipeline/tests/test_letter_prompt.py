"""The prompt must not contain the words the guardrail refuses.

This is a real bug that shipped once: the prompt told the model "never say violated,
failed, illegal", the guardrail blocks those words on the way in, and so every letter
was refused. Telling the model what not to say must not use the words themselves.
"""
import json
import re
from pathlib import Path

VACHAN = Path(__file__).resolve().parent.parent / "vachan"
SOURCE = (VACHAN / "letter.py").read_text()
RULES = SOURCE.split('RULES = """')[1].split('"""')[0]
BLOCKED = json.loads((VACHAN / "blocked_words.json").read_text())


def test_the_prompt_trips_no_blocked_word():
    found = [w for w in BLOCKED if re.search(rf"\b{re.escape(w)}", RULES, re.I)]
    assert not found, f"the guardrail would refuse the prompt itself over {found}"


def test_the_prompt_still_forbids_accusing_anyone():
    low = RULES.lower()
    assert "promised in writing" in low
    assert "do not accuse" in low and "penalties" in low


def test_the_blocked_list_is_usable_by_the_guardrail():
    """Bedrock takes plain words, each non-empty and lower case, with no duplicates."""
    assert BLOCKED and len(BLOCKED) == len(set(BLOCKED))
    for w in BLOCKED:
        assert w and w == w.strip() and w == w.lower()


def test_every_language_is_offered_to_the_model():
    assert '"en"' in SOURCE and '"mr"' in SOURCE and '"hi"' in SOURCE
    assert "Marathi" in SOURCE and "Hindi" in SOURCE and "English" in SOURCE


def test_marathi_and_hindi_get_a_glossary():
    """A shipped bug: with no glossary the model wrote OWC as "over-the-wall" and mixed Hindi into Marathi."""
    assert "ओला कचरा प्रक्रिया यंत्र (OWC)" in SOURCE and "गीला कचरा" in SOURCE
    assert "Never expand an abbreviation" in RULES and "{terms}" in RULES


def test_the_glossary_trips_no_blocked_word():
    terms = SOURCE.split("TERMS = {")[1].split("\n}\n")[0]
    found = [w for w in BLOCKED if re.search(rf"\b{re.escape(w)}", terms, re.I)]
    assert not found, found
