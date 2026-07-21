"""Isolated tests for outlet scanner authorization and redemption audit fields."""
import asyncio
import os
import sys
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


class FakeCollection:
    def __init__(self, document=None):
        self.document = document
        self.last_update = None

    async def find_one(self, query, *args, **kwargs):
        return self.document

    async def update_one(self, query, update):
        self.last_update = update
        return SimpleNamespace(matched_count=1)


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
    users = FakeCollection({
        "_id": student_id,
        "name": "Unit Student",
        "student_number": "SCD-2026-UNIT01",
        "verification_status": "approved",
    })
    offers = FakeCollection({
        "_id": offer_id,
        "title": "Unit offer",
        "discount": "20% off",
        "brand": "Unit Outlet",
        "redemption_policy": "unlimited",
    })
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(coupons=coupons, users=users, offers=offers),
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

    fields = coupons.last_update["$set"]
    assert result["ok"] is True
    assert fields["status"] == "redeemed"
    assert fields["approved_by_user_id"] == partner_id
    assert fields["redeemed_by_user_id"] == partner_id
    assert fields["redeemed_outlet_id"] == outlet_id
    assert fields["approved_at"] == fields["redeemed_at"]
