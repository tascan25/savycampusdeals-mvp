"""Isolated tests for outlet scanner authorization and redemption audit fields."""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def test_partner_cannot_access_another_outlets_coupon():
    partner_outlet = ObjectId()
    other_outlet = ObjectId()
    scanner = {"role": "outlet_partner", "outlet_id": partner_outlet}

    with pytest.raises(HTTPException) as exc:
        server.ensure_scanner_coupon_access(scanner, {"outlet_id": other_outlet})

    assert exc.value.status_code == 403
    assert "another outlet" in exc.value.detail.lower()


def test_partner_cannot_access_non_outlet_coupon():
    scanner = {"role": "outlet_partner", "outlet_id": ObjectId()}

    with pytest.raises(HTTPException) as exc:
        server.ensure_scanner_coupon_access(scanner, {"outlet_id": None})

    assert exc.value.status_code == 403
    assert "not assigned" in exc.value.detail.lower()


def test_admin_scanner_retains_support_access():
    server.ensure_scanner_coupon_access({"role": "admin"}, {"outlet_id": None})


def test_student_only_dependency_rejects_partner(monkeypatch):
    async def current_user(_request):
        return {"_id": ObjectId(), "role": "outlet_partner"}

    monkeypatch.setattr(server, "get_current_user", current_user)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.get_student_user(object()))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Student access required"


def test_partner_period_rejects_unknown_value():
    with pytest.raises(HTTPException) as exc:
        server._partner_period_bounds("quarter")

    assert exc.value.status_code == 400


def test_partner_activity_item_does_not_expose_student_email():
    item = server._partner_activity_item(
        {
            "_id": ObjectId(),
            "offer_id": ObjectId(),
            "code": "SCD-PRIVATE",
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        },
        {"title": "Student lunch", "discount": "20% off"},
        {
            "name": "Unit Student",
            "student_number": "SCD-2026-UNIT",
            "email": "private@example.com",
        },
    )

    assert item["student_name"] == "Unit Student"
    assert "student_email" not in item


class FakeCollection:
    def __init__(self, document=None):
        self.document = document
        self.last_update = None
        self.updates = []
        self.inserted = []

    async def find_one(self, query, *args, **kwargs):
        return self.document

    async def update_one(self, query, update):
        self.last_update = update
        self.updates.append(update)
        return SimpleNamespace(matched_count=1)

    async def insert_one(self, document):
        self.inserted.append(document)
        return SimpleNamespace(inserted_id=document.get("_id", ObjectId()))


def test_successful_redemption_records_partner_and_outlet(monkeypatch):
    outlet_id = ObjectId()
    partner_id = ObjectId()
    student_id = ObjectId()
    offer_id = ObjectId()
    coupon = {
        "_id": ObjectId(),
        "code": "SCD-UNIT1234",
        "user_id": student_id,
        "offer_id": offer_id,
        "outlet_id": outlet_id,
        "status": "active",
        "expires_at": None,
    }
    coupons = FakeCollection(coupon)
    users = FakeCollection(
        {
            "_id": student_id,
            "name": "Unit Student",
            "student_number": "SCD-2026-UNIT01",
            "verification_status": "approved",
            "savvy_points_balance": 300,
            "savvy_points_lifetime": 300,
            "reward_points": 300,
        }
    )
    offers = FakeCollection(
        {
            "_id": offer_id,
            "title": "Unit offer",
            "discount": "20% off",
            "brand": "Unit Outlet",
            "redemption_policy": "unlimited",
        }
    )
    point_transactions = FakeCollection()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            coupons=coupons,
            users=users,
            offers=offers,
            savvy_points_transactions=point_transactions,
        ),
    )
    scanner = {
        "_id": partner_id,
        "name": "Outlet Owner",
        "role": "outlet_partner",
        "outlet_id": outlet_id,
    }

    result = asyncio.run(
        server.scan_redeem(server.ScanIn(payload=coupon["code"]), scanner=scanner)
    )

    fields = coupons.updates[0]["$set"]
    assert result["ok"] is True
    assert fields["status"] == "redeemed"
    assert fields["approved_by_user_id"] == partner_id
    assert fields["redeemed_by_user_id"] == partner_id
    assert fields["redeemed_outlet_id"] == outlet_id
    assert fields["approved_at"] == fields["redeemed_at"]
    assert result["savvy_points_awarded"] == 50
    assert point_transactions.inserted[0]["event_type"] == "redemption"
    assert users.last_update["$inc"]["savvy_points_balance"] == 50


def test_partner_can_redeem_active_level_reward(monkeypatch):
    outlet_id = ObjectId()
    partner_id = ObjectId()
    student_id = ObjectId()
    reward = {
        "_id": ObjectId(),
        "code": "SVR-UNITREWARD",
        "user_id": student_id,
        "tier_name": "Deal Hunter",
        "reward_title": "One free cold coffee, iced tea, lemonade, or similar drink.",
        "status": "active",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    }
    rewards = FakeCollection(reward)
    users = FakeCollection(
        {
            "_id": student_id,
            "name": "Reward Student",
            "student_number": "SCD-2026-REWARD",
            "verification_status": "approved",
        }
    )
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(savvy_level_rewards=rewards, users=users),
    )
    scanner = {
        "_id": partner_id,
        "name": "Cafe Partner",
        "role": "outlet_partner",
        "outlet_id": outlet_id,
    }

    lookup = asyncio.run(
        server.scan_lookup(server.ScanIn(payload=reward["code"]), scanner=scanner)
    )
    result = asyncio.run(
        server.scan_redeem(server.ScanIn(payload=reward["code"]), scanner=scanner)
    )

    assert lookup["kind"] == "level_reward"
    assert lookup["reward_title"].startswith("One free cold coffee")
    assert result["kind"] == "level_reward"
    assert result["tier_name"] == "Deal Hunter"
    assert rewards.last_update["$set"]["status"] == "redeemed"
    assert rewards.last_update["$set"]["redeemed_outlet_id"] == outlet_id
