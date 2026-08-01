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
