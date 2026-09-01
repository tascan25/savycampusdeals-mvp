"""Focused coverage for idempotent partner-outlet coupon claims."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def coupon_document(user_id, offer_id, outlet_id):
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(),
        "user_id": user_id,
        "offer_id": offer_id,
        "outlet_id": outlet_id,
        "code": "SCD-EXISTING",
        "qr_data_uri": "data:image/png;base64,existing",
        "status": "active",
        "created_at": now,
        "expires_at": now + timedelta(hours=4),
        "redeemed_at": None,
    }


class OffersCollection:
    def __init__(self, offer):
        self.offer = offer
        self.claim_increments = 0

    async def find_one(self, query):
        return self.offer

    async def update_one(self, query, update):
        self.claim_increments += update.get("$inc", {}).get("claims_count", 0)
        return SimpleNamespace(modified_count=1)


class ExistingCouponCollection:
    def __init__(self, coupon):
        self.coupon = coupon
        self.insert_calls = 0

    async def find_one(self, query, *args, **kwargs):
        if query.get("status") == "active":
            return self.coupon
        return None

    async def update_one(self, query, update):
        return SimpleNamespace(modified_count=0)

    async def insert_one(self, document):
        self.insert_calls += 1
        raise AssertionError("an existing active coupon must not be inserted again")


class RacingCouponCollection(ExistingCouponCollection):
    def __init__(self, coupon):
        super().__init__(coupon)
        self.active_lookups = 0

    async def find_one(self, query, *args, **kwargs):
        if query.get("status") == "active":
            self.active_lookups += 1
            return self.coupon if self.active_lookups > 1 else None
        return None

    async def insert_one(self, document):
        self.insert_calls += 1
        raise DuplicateKeyError("one_active_coupon_per_user_offer")


def partner_offer():
    return {
        "_id": ObjectId(),
        "outlet_id": ObjectId(),
        "title": "Buy 2 get 1",
        "brand": "Crave & Co.",
        "brand_logo": "",
        "category": "Dining",
        "description": "Student offer",
        "discount": "BUY 2 GET 1",
        "image_url": "",
        "redemption_policy": "daily",
    }


def verified_user():
    return {
        "_id": ObjectId(),
        "email": "student@example.com",
        "verification_status": "approved",
    }


def test_repeated_claim_returns_existing_coupon_as_active_state(monkeypatch):
    offer = partner_offer()
    user = verified_user()
    coupon = coupon_document(user["_id"], offer["_id"], offer["outlet_id"])
    coupons = ExistingCouponCollection(coupon)
    offers = OffersCollection(offer)
    monkeypatch.setattr(server, "db", SimpleNamespace(coupons=coupons, offers=offers))

    result = asyncio.run(server.claim_offer(str(offer["_id"]), user=user))

    assert result["id"] == str(coupon["_id"])
    assert result["already_active"] is True
    assert coupons.insert_calls == 0
    assert offers.claim_increments == 0


def test_duplicate_key_race_returns_winning_coupon(monkeypatch):
    offer = partner_offer()
    user = verified_user()
    coupon = coupon_document(user["_id"], offer["_id"], offer["outlet_id"])
    coupons = RacingCouponCollection(coupon)
    offers = OffersCollection(offer)
    monkeypatch.setattr(server, "db", SimpleNamespace(coupons=coupons, offers=offers))
    monkeypatch.setattr(server, "generate_qr_data_uri", lambda payload: "data:image/png;base64,new")

    result = asyncio.run(server.claim_offer(str(offer["_id"]), user=user))

    assert result["id"] == str(coupon["_id"])
    assert result["already_active"] is True
    assert coupons.insert_calls == 1
    assert offers.claim_increments == 0
