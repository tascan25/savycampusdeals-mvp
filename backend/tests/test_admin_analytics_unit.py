"""Focused tests for analytics-only college name grouping."""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

from server import (  # noqa: E402
    build_college_registration_directory,
    canonical_college_name,
    group_college_registrations,
)


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


def test_all_kiet_legal_campus_school_and_location_variants_share_one_name():
    variants = [
        "KIET",
        "KIETS",
        "KIET COLLEGE",
        "KIET - Deemed To Be University",
        "KIET Deemed to be University, Ghaziabad,Delhi-NCR.",
        "KIET Demeed to be University",
        "KIET School of Management",
        "Kiet group of institutions Gaziyabad",
        "Kiet institute of technology",
        "Kiet Muradnagar delhi ncr",
        "Krishna Institute of Engineering and Technology",
        "Krishna institute of engineering",
        "Krishna institute of technology and Management",
    ]

    assert {
        canonical_college_name(value)
        for value in variants
    } == {"KIET University"}


def test_shared_its_domain_preserves_the_specific_its_institution():
    assert canonical_college_name("ITS college of Pharmacy") == "I.T.S College of Pharmacy"
    assert canonical_college_name("I.T.S Mohan Nagar Ghaziabad") == (
        "Institute of Technology & Science, Ghaziabad"
    )


def test_universal_grouping_combines_contained_campus_and_spelling_variants():
    grouped = group_college_registrations([
        {"college": "Lovely Professional University", "registrations": 2},
        {"college": "Lovely Professional University Punjab", "registrations": 3},
        {"college": "lovely professional univercity", "registrations": 1},
    ])

    assert grouped == {"Lovely Professional University": 6}


def test_universal_grouping_handles_word_order_acronyms_and_typos():
    grouped = group_college_registrations([
        {"college": "University of Delhi", "registrations": 2},
        {"college": "Delhi University", "registrations": 3},
        {"college": "National Institute of Fashion Technology", "registrations": 4},
        {"college": "NIFT", "registrations": 1},
        {"college": "Global Institue of Technlogy", "registrations": 2},
        {"college": "Global Institute of Technology", "registrations": 1},
    ])

    assert grouped["Delhi University"] == 5
    assert grouped["National Institute Of Fashion Technology"] == 5
    assert grouped["Global Institute Of Technology"] == 3


def test_universal_grouping_does_not_merge_different_institutions_or_specialisations():
    grouped = group_college_registrations([
        {"college": "Delhi University", "registrations": 2},
        {"college": "Delhi Technical University", "registrations": 3},
        {"college": "St Joseph College", "registrations": 4},
        {"college": "St Joseph College of Pharmacy", "registrations": 5},
    ])

    assert grouped == {
        "Delhi University": 2,
        "Delhi Technical University": 3,
        "St Joseph College": 4,
        "St Joseph College Of Pharmacy": 5,
    }


def test_college_directory_separates_all_time_and_selected_period_totals():
    directory = build_college_registration_directory(
        [
            {"college": "Amity University", "registrations": 14},
            {"college": "Amity University Noida", "registrations": 7},
            {"college": "KIET Deemed to be University", "registrations": 8},
            {"college": "KIET Ghaziabad", "registrations": 4},
        ],
        [
            {"college": "Amity University Noida", "registrations": 7},
            {"college": "KIET Ghaziabad", "registrations": 2},
        ],
    )

    amity = next(item for item in directory if item["college"] == "Amity University")
    kiet = next(item for item in directory if item["college"] == "KIET University")
    assert amity["total_registrations"] == 21
    assert amity["period_registrations"] == 7
    assert len(amity["variants"]) == 2
    assert kiet["total_registrations"] == 12
    assert kiet["period_registrations"] == 2
