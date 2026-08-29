"""Unit coverage for the unified admin offer activity report."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


class Cursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, _length):
        return self.rows


class Users:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query, _projection):
        selected = set(query["_id"]["$in"])
        return Cursor([row for row in self.rows if row["_id"] in selected])


def test_offer_activity_derives_expiry_and_includes_brand_claims(monkeypatch):
    now = datetime.now(timezone.utc)
    outlet_id = ObjectId()
    outlet_offer_id = ObjectId()
    brand_offer_id = ObjectId()
    outlet_student = ObjectId()
    brand_student = ObjectId()
    stale_coupon_id = ObjectId()
    brand_claim_id = ObjectId()
    outlets = [{"_id": outlet_id, "name": "Campus Cafe", "city": "Delhi"}]
    offers = [
        {
            "_id": outlet_offer_id,
            "outlet_id": outlet_id,
            "brand": "Campus Cafe",
            "title": "Lunch combo",
            "discount": "20% OFF",
        },
        {
            "_id": brand_offer_id,
            "outlet_id": None,
            "brand": "Adobe",
            "title": "Student plan",
            "discount": "50% OFF",
            "validity": "Ongoing",
        },
    ]
    activities = [
        {
            "_id": stale_coupon_id,
            "offer_id": outlet_offer_id,
            "outlet_id": outlet_id,
            "user_id": outlet_student,
            "code": "SCD-EXPIRED",
            "status": "active",
            "created_at": now - timedelta(days=2),
            "expires_at": now - timedelta(days=1),
            "redeemed_at": None,
        },
        {
            "_id": brand_claim_id,
            "offer_id": brand_offer_id,
            "outlet_id": None,
            "user_id": brand_student,
            "record_type": "brand_offer_claim",
            "status": "claimed",
            "created_at": now - timedelta(hours=2),
            "last_visited_at": now - timedelta(hours=1),
            "visit_count": 2,
        },
    ]

    async def fake_loader(_start, _end):
        return outlets, offers, activities

    monkeypatch.setattr(server, "_load_brand_outlet_report_data", fake_loader)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=Users([
        {"_id": outlet_student, "name": "Outlet Student", "email": "outlet@example.com", "college": "IPEC"},
        {"_id": brand_student, "name": "Brand Student", "email": "brand@example.com", "college": "Amity"},
    ])))

    result = asyncio.run(server.admin_offer_activity(
        activity_type="all",
        status=None,
        partner_id=None,
        date_from=None,
        date_to=None,
        page=1,
        page_size=25,
        admin={"role": "admin"},
    ))

    assert result["summary"] == {
        "total_claims": 2,
        "outlet_coupons": 1,
        "brand_claims": 1,
        "active": 0,
        "redeemed": 0,
        "expired": 1,
        "unique_students": 2,
    }
    coupon = next(item for item in result["items"] if item["type"] == "outlet")
    brand = next(item for item in result["items"] if item["type"] == "brand")
    assert coupon["status"] == "expired"
    assert coupon["expires_at"] == (now - timedelta(days=1)).isoformat()
    assert brand["status"] == "claimed"
    assert brand["expires_at"] is None
    assert brand["visit_count"] == 2
    assert brand["student_name"] == "Brand Student"


def test_offer_activity_status_filter_uses_effective_expired_status(monkeypatch):
    now = datetime.now(timezone.utc)
    outlet_id = ObjectId()
    offer_id = ObjectId()
    activity = {
        "_id": ObjectId(),
        "offer_id": offer_id,
        "outlet_id": outlet_id,
        "status": "active",
        "created_at": now,
        "expires_at": now - timedelta(minutes=1),
    }

    async def fake_loader(_start, _end):
        return ([{"_id": outlet_id, "name": "Cafe"}], [{"_id": offer_id, "outlet_id": outlet_id, "title": "Deal"}], [activity])

    monkeypatch.setattr(server, "_load_brand_outlet_report_data", fake_loader)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=Users([])))
    result = asyncio.run(server.admin_offer_activity(
        activity_type="outlet",
        status="expired",
        partner_id=None,
        date_from=None,
        date_to=None,
        page=1,
        page_size=25,
        admin={"role": "admin"},
    ))

    assert result["total"] == 1
    assert result["items"][0]["status"] == "expired"
