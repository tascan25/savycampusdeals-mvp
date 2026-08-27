"""Unit tests for policy-aware coupon expiry and nearby outlet distance."""
import os
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def test_daily_coupon_expires_at_end_of_india_day():
    now = datetime(2026, 7, 31, 12, 0, tzinfo=timezone.utc)

    expiry = server.coupon_expiry_for_offer(
        {"redemption_policy": "daily"}, now
    )

    assert expiry == datetime(2026, 7, 31, 18, 30, tzinfo=timezone.utc)


def test_monthly_coupon_expires_at_end_of_india_month():
    now = datetime(2026, 7, 15, 12, 0, tzinfo=timezone.utc)

    expiry = server.coupon_expiry_for_offer(
        {"redemption_policy": "monthly"}, now
    )

    assert expiry == datetime(2026, 7, 31, 18, 30, tzinfo=timezone.utc)


def test_non_periodic_coupon_keeps_standard_thirty_day_expiry():
    now = datetime(2026, 7, 31, 12, 0, tzinfo=timezone.utc)

    expiry = server.coupon_expiry_for_offer(
        {"redemption_policy": "once"}, now
    )

    assert expiry == now + timedelta(days=30)


def test_distance_between_the_two_new_noida_cafes_is_small():
    distance = server.distance_km(
        28.541752686713675,
        77.33415735581939,
        28.542372285632688,
        77.33271197116387,
    )

    assert distance == pytest.approx(0.16, abs=0.02)


def test_new_noida_cafes_use_daily_redemption():
    outlets = json.loads((BACKEND_DIR / "data" / "outlets.json").read_text())
    names = {
        "Crave & Co. Cafe",
        "Khayal Aapka Food Cafe",
        "HPMC Juice Counter",
    }
    cafes = [outlet for outlet in outlets if outlet["name"] in names]

    assert {outlet["name"] for outlet in cafes} == names
    assert all(
        offer["redemption_policy"] == "daily"
        for outlet in cafes
        for offer in outlet["offers"]
    )


def test_appetito_sports_offer_uses_daily_redemption_window():
    outlets = json.loads((BACKEND_DIR / "data" / "outlets.json").read_text())
    appetito = next(
        outlet for outlet in outlets if outlet["name"] == "Appetito Club"
    )
    offer = appetito["offers"][0]

    assert offer["category"] == "Sports & Fitness"
    assert offer["redemption_policy"] == "daily"
    assert "once per student per day" in offer["terms"].lower()
    assert "scan and approve" in offer["terms"].lower()

    # Daily coupons expire at the end of the current India calendar day,
    # rather than receiving the standard 30-day coupon lifetime.
    now = datetime(2026, 8, 18, 6, 30, tzinfo=timezone.utc)  # 12:00 PM IST
    assert server.coupon_expiry_for_offer(offer, now) == datetime(
        2026, 8, 18, 18, 30, tzinfo=timezone.utc
    )


def test_big_bite_offers_use_daily_redemption_window():
    outlets = json.loads((BACKEND_DIR / "data" / "outlets.json").read_text())
    big_bite = next(
        outlet for outlet in outlets if outlet["name"] == "The Big Bite Co."
    )

    assert len(big_bite["offers"]) == 2
    assert all(
        offer["redemption_policy"] == "daily"
        for offer in big_bite["offers"]
    )
    bogo = next(
        offer
        for offer in big_bite["offers"]
        if offer["title"] == "Buy 1 Get 1 FREE on Pizza"
    )
    assert bogo["terms"] == (
        "Offer valid on selected pizzas only. To redeem this offer, the outlet "
        "owner or staff must scan and approve your SavvyCampusDeals offer QR "
        "before billing."
    )

    # A Big Bite coupon claimed at noon IST expires at the end of that India
    # calendar day, never at the standard 30-day fallback.
    now = datetime(2026, 8, 26, 6, 30, tzinfo=timezone.utc)  # 12:00 PM IST
    expected_expiry = datetime(2026, 8, 26, 18, 30, tzinfo=timezone.utc)
    assert all(
        server.coupon_expiry_for_offer(offer, now) == expected_expiry
        for offer in big_bite["offers"]
    )


def test_roms_pizza_offer_uses_daily_redemption_window():
    outlets = json.loads((BACKEND_DIR / "data" / "outlets.json").read_text())
    roms = next(
        outlet
        for outlet in outlets
        if outlet["name"] == "Rom's Pizza - Muradnagar"
    )
    offer = roms["offers"][0]

    assert offer["redemption_policy"] == "daily"
    assert "once per student per day" in offer["terms"].lower()
    assert "Rom's Pizza - Muradnagar" in offer["description"]

    # Noon IST claim -> same-day 11:59:59-style boundary (00:00 next day),
    # rather than the standard 30-day coupon lifetime.
    now = datetime(2026, 8, 27, 6, 30, tzinfo=timezone.utc)
    assert server.coupon_expiry_for_offer(offer, now) == datetime(
        2026, 8, 27, 18, 30, tzinfo=timezone.utc
    )
