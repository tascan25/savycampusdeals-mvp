"""Focused rules for the KIET Freshers campaign."""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


def campaign(**overrides):
    item = {
        "_id": ObjectId(),
        "opens_at": datetime(2026, 8, 26, 16, 30, tzinfo=timezone.utc),
        "closes_at": datetime(2026, 8, 27, 18, 30, tzinfo=timezone.utc),
        "grace_ends_at": datetime(2026, 8, 27, 18, 40, tzinfo=timezone.utc),
        "manual_status": "scheduled",
        "gog_offer": "GOG offer",
        "gog_discount_offer": "GOG ₹350 discount offer",
        "s_cafe_offer": "S Cafe offer",
        "big_bite_offer": "Big Bite offer",
        "goodies_description": "Savvy stickers and pamphlet",
    }
    item.update(overrides)
    return item


def test_campaign_window_covers_all_of_august_27_in_india():
    item = campaign()

    assert server.freshers_campaign_status(
        item, datetime(2026, 8, 26, 16, 29, tzinfo=timezone.utc)
    ) == "scheduled"
    assert server.freshers_campaign_status(
        item, datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
    ) == "live"
    assert server.freshers_campaign_status(
        item, datetime(2026, 8, 27, 18, 35, tzinfo=timezone.utc)
    ) == "grace"
    assert server.freshers_campaign_status(
        item, datetime(2026, 8, 27, 18, 41, tzinfo=timezone.utc)
    ) == "closed"


def test_reward_tiers_and_alternating_cafes_are_exact():
    assert server.freshers_tier(1) == "cafe_and_goodies"
    assert server.freshers_tier(200) == "cafe_and_goodies"
    assert server.freshers_tier(201) == "goodies"
    assert server.freshers_tier(400) == "goodies"
    assert server.freshers_tier(401) == "waitlist"
    assert server.freshers_cafe(1) == "big_bite"
    assert server.freshers_cafe(50) == "big_bite"
    assert server.freshers_cafe(51) == "gog"
    assert server.freshers_cafe(52) == "s_cafe"
    assert server.freshers_cafe(109) == "gog"
    assert server.freshers_cafe(110) == "s_cafe"
    assert server.freshers_cafe(111) == "gog"
    assert server.freshers_cafe(199) == "gog"
    assert server.freshers_cafe(200) == "s_cafe"
    assert server.freshers_cafe(201) is None

    assignments = [server.freshers_cafe(position) for position in range(1, 201)]
    assert assignments.count("big_bite") == 50
    assert assignments.count("gog") == 75
    assert assignments.count("s_cafe") == 75

    details = campaign()
    assert server._freshers_offer("gog", details, 51) == "GOG offer"
    assert server._freshers_offer("gog", details, 109) == "GOG offer"
    assert server._freshers_offer("gog", details, 111) == "GOG ₹350 discount offer"
    assert server._freshers_offer("gog", details, 199) == "GOG ₹350 discount offer"


def test_goodies_and_cafe_codes_are_distinct_scanner_types():
    goodies = server._freshers_code("KFG")
    cafe = server._freshers_code("KFC")

    assert goodies.startswith("KFG-")
    assert cafe.startswith("KFC-")
    assert goodies != cafe
    assert server._parse_qr_payload(cafe) == {"kind": "freshers_cafe", "code": cafe}
    assert server._parse_qr_payload(f"https://savvy.example/scan?f={cafe}") == {
        "kind": "freshers_cafe",
        "code": cafe,
    }


def test_reward_email_keeps_qrs_separate_and_states_seven_day_expiry():
    issued = datetime(2026, 8, 27, 8, 0, tzinfo=timezone.utc)
    participant = {
        "_id": ObjectId(),
        "name": "Aarav Student",
        "email": "aarav@kiet.edu",
        "position": 17,
        "status": "unlocked",
        "tier": "cafe_and_goodies",
        "cafe": "gog",
        "cafe_code": "KFC-CAFEUNIT",
        "cafe_name": "GOG Cafe & Bakers",
        "cafe_address": "Near KIET, Muradnagar",
        "goodies_code": "KFG-GOODIESUNIT",
        "expires_at": issued + timedelta(days=7),
    }

    rendered = server.freshers_email_html(participant, campaign(), reservation=False)

    assert "GOG Cafe &amp; Bakers coupon" in rendered
    assert "Near KIET, Muradnagar" in rendered
    assert "Goodies pickup pass" in rendered
    assert 'cid:freshers-cafe-qr' in rendered
    assert 'cid:freshers-goodies-qr' in rendered
    assert "KFC-CAFEUNIT" in rendered
    assert "KFG-GOODIESUNIT" in rendered
    assert "03 September 2026" in rendered


def test_manual_pause_overrides_time_window():
    item = campaign(manual_status="paused")
    assert server.freshers_campaign_status(
        item, datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
    ) == "paused"
