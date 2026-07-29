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
    assert canonical_college_name("IPEC") == "IPEC"
