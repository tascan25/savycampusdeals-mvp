"""Focused tests for analytics-only college name grouping."""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

from server import canonical_college_name  # noqa: E402


def test_amity_spelling_and_campus_variants_share_one_name():
    variants = [
        "aAmity univeristy",
        "Amity university noida",
        " AMITY UNIVERSITY ",
    ]

    assert {
        canonical_college_name(value)
        for value in variants
    } == {"Amity University"}


def test_unrelated_amity_institution_is_not_merged_with_university():
    assert canonical_college_name("Amity International School") == (
        "Amity International School"
    )


def test_generic_names_are_case_and_punctuation_normalized():
    assert canonical_college_name("inderprastha engineering college") == (
        "Inderprastha Engineering College"
    )
    assert canonical_college_name("IPEC") == "Inderprastha Engineering College"


def test_supported_college_short_and_full_names_share_canonical_names():
    cases = {
        "IITD": "Indian Institute of Technology Delhi",
        "IIT Delhi": "Indian Institute of Technology Delhi",
        "Indian Institute of Technology Bombay": "Indian Institute of Technology Bombay",
        "IITB": "Indian Institute of Technology Bombay",
        "VIT University": "Vellore Institute of Technology",
        "VIT": "Vellore Institute of Technology",
        "KIETS": "KIET University",
        "Kiet Deemed to be University": "KIET University",
        "KIET Group of Institutions": "KIET University",
        "IPEC": "Inderprastha Engineering College",
        "Indraprastha Engineering College": "Inderprastha Engineering College",
        "I.T.S Mohan Nagar Ghaziabad": "Institute of Technology & Science, Ghaziabad",
        "Institute of Technology and Science": "Institute of Technology & Science, Ghaziabad",
        "ITS college of Pharmacy": "I.T.S College of Pharmacy",
        "IIT MADRAS": "Indian Institute of Technology Madras",
        "MANIT": "Maulana Azad National Institute of Technology",
        "Motilal Nehru College , DU": "Motilal Nehru College",
        "RD engineering college": "R.D. Engineering College",
    }

    for entered_name, expected in cases.items():
        assert canonical_college_name(entered_name) == expected


def test_shared_its_domain_preserves_the_specific_its_institution():
    assert canonical_college_name("ITS college of Pharmacy") == "I.T.S College of Pharmacy"
    assert canonical_college_name("I.T.S Mohan Nagar Ghaziabad") == (
        "Institute of Technology & Science, Ghaziabad"
    )
