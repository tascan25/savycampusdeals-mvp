"""Unit tests for backward-compatible multi-category offers."""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def test_multi_category_offer_is_filterable_by_each_category():
    offer = {
        "category": "Developer Tools",
        "categories": ["Developer Tools", "Education"],
    }

    assert server.get_offer_categories(offer) == ["Developer Tools", "Education"]
    assert server.offer_category_query("Education") == {
        "$or": [
            {"category": "Education"},
            {"categories": "Education"},
        ]
    }


def test_legacy_single_category_offer_remains_supported():
    assert server.get_offer_categories({"category": "Tech"}) == ["Tech"]
