"""Focused unit coverage for the admin referral network response."""
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


class ReferralCollection:
    def __init__(self, referrer_id, referred_id, now):
        self.referrer_id = referrer_id
        self.referred_id = referred_id
        self.now = now

    async def count_documents(self, _query):
        return 1

    async def distinct(self, _field, _query):
        return [self.referrer_id]

    def aggregate(self, pipeline):
        if any("$facet" in stage for stage in pipeline):
            return Cursor(
                [
                    {
                        "metadata": [{"total": 1}],
                        "items": [
                            {
                                "referrer_id": self.referrer_id,
                                "name": "Alice Ambassador",
                                "email": "alice@example.com",
                                "college": "Amity University",
                                "referral_code": "ALICE123",
                                "account_exists": True,
                                "reward_points": 300,
                                "referral_count": 1,
                                "points_awarded": 100,
                                "latest_referral": self.now,
                            }
                        ],
                    }
                ]
            )
        if any(
            "$group" in stage and stage["$group"].get("_id") is None
            for stage in pipeline
        ):
            return Cursor([{"_id": None, "points": 100}])
        if any(stage.get("$limit") == 1 for stage in pipeline):
            return Cursor(
                [
                    {
                        "name": "Alice Ambassador",
                        "email": "alice@example.com",
                        "referral_count": 1,
                    }
                ]
            )
        return Cursor(
            [
                {
                    "_id": self.referrer_id,
                    "verified_referrals": 1,
                    "students": [
                        {
                            "id": self.referred_id,
                            "account_exists": True,
                            "name": "Bob Student",
                            "email": "bob@example.com",
                            "college": "Amity University",
                            "verification_status": "approved",
                            "verification_expiry": (
                                self.now + timedelta(days=30)
                            ),
                            "points_awarded": 100,
                            "joined_at": self.now,
                        }
                    ],
                }
            ]
        )


class UserCollection:
    async def count_documents(self, _query):
        return 1


def test_admin_referrals_returns_leaderboard_and_relationships(monkeypatch):
    now = datetime.now(timezone.utc)
    referrer_id = ObjectId()
    referred_id = ObjectId()
    fake_db = SimpleNamespace(
        referrals=ReferralCollection(referrer_id, referred_id, now),
        users=UserCollection(),
    )
    monkeypatch.setattr(server, "db", fake_db)

    result = asyncio.run(
        server.admin_referrals(
            q=None,
            page=1,
            page_size=12,
            admin={"role": "admin"},
        )
    )

    assert result["summary"]["total_referrals"] == 1
    assert result["summary"]["active_referrers"] == 1
    assert result["summary"]["verified_referred"] == 1
    assert result["summary"]["top_referrer"]["name"] == "Alice Ambassador"
    assert result["items"][0]["referral_count"] == 1
    assert result["items"][0]["verified_referrals"] == 1
    assert result["items"][0]["referred_students"][0] == {
        "id": str(referred_id),
        "account_exists": True,
        "name": "Bob Student",
        "email": "bob@example.com",
        "college": "Amity University",
        "verification_status": "approved",
        "points_awarded": 100,
        "joined_at": now,
    }
