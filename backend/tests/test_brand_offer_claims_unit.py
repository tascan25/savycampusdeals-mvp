"""Focused tests for the non-partner listed-brand claim path."""
import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


class BrandClaimsCollection:
    def __init__(self):
        self.document = None

    async def find_one(self, query):
        return self.document

    async def insert_one(self, document):
        document = {**document, "_id": ObjectId()}
        self.document = document
        return SimpleNamespace(inserted_id=document["_id"])

    async def update_one(self, query, update):
        if self.document:
            self.document.update(update.get("$set", {}))
            for field, amount in update.get("$inc", {}).items():
                self.document[field] = self.document.get(field, 0) + amount
        return SimpleNamespace(modified_count=1)


class OffersCollection:
    def __init__(self, offer):
        self.offer = offer
        self.claim_increments = 0

    async def find_one(self, query):
        return self.offer

    async def update_one(self, query, update):
        self.claim_increments += update.get("$inc", {}).get("claims_count", 0)
        return SimpleNamespace(modified_count=1)


def test_brand_claim_creates_no_coupon_or_qr_and_sends_link_email(monkeypatch):
    offer = {
        "_id": ObjectId(),
        "title": "Student plan",
        "brand": "Example Brand",
        "brand_url": "https://example.com/student",
        "brand_logo": "/brand.webp",
        "category": "Tech",
        "description": "Student pricing",
        "discount": "50% OFF",
        "image_url": "/offer.webp",
        "terms": "Verify on the official website.",
        "validity": "Ongoing",
        "outlet_id": None,
    }
    brand_claims = BrandClaimsCollection()
    offers = OffersCollection(offer)
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(brand_offer_claims=brand_claims, offers=offers),
    )
    emails = []
    monkeypatch.setattr(
        server,
        "send_email",
        lambda to, subject, body, attachments=None: emails.append(
            (to, subject, body, attachments)
        ),
    )
    user = {
        "_id": ObjectId(),
        "email": "student@example.com",
        "verification_status": "approved",
    }

    result = asyncio.run(server.claim_offer(str(offer["_id"]), user=user))

    assert result["kind"] == "listed_brand_offer"
    assert result["status"] == "claimed"
    assert result["official_url"] == offer["brand_url"]
    assert "code" not in result
    assert "qr_data_uri" not in result
    assert offers.claim_increments == 1
    assert len(emails) == 1
    assert emails[0][3] is None
    assert "coupon-qr" not in emails[0][2]
    assert server.BRAND_OFFER_DISCLAIMER in emails[0][2]
    assert "SavvyCampusDeals" in server.BRAND_OFFER_DISCLAIMER
    assert "SavyCampusDeals" not in emails[0][2]

    repeated = asyncio.run(server.claim_offer(str(offer["_id"]), user=user))
    assert repeated["id"] == result["id"]
    assert offers.claim_increments == 1
    assert len(emails) == 1


def test_brand_claim_serializer_never_exposes_legacy_coupon_credentials():
    claim = {
        "_id": "legacy-id",
        "offer_id": ObjectId(),
        "source": "legacy_coupon",
    }
    offer = {
        "title": "Student plan",
        "brand": "Example",
        "brand_url": "https://example.com",
    }

    result = server.serialize_brand_offer_claim(claim, offer)

    assert result["legacy"] is True
    assert "code" not in result
    assert "qr_data_uri" not in result
