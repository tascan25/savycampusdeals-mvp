import os
import sys
from pathlib import Path

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def test_outlet_interaction_summary_counts_claims_and_selects_favourite():
    favourite = ObjectId()
    other = ObjectId()

    counts, favourite_id = server.outlet_interaction_summary(
        [
            {"outlet_id": other},
            {"outlet_id": favourite},
            {"outlet_id": favourite},
            {"outlet_id": None},
        ]
    )

    assert counts == {other: 1, favourite: 2}
    assert favourite_id == favourite


def test_outlet_interaction_summary_is_empty_without_outlet_claims():
    counts, favourite_id = server.outlet_interaction_summary([{}, {"outlet_id": None}])

    assert counts == {}
    assert favourite_id is None
