"""Focused coverage for Savvy Points tiers, ledger idempotency and referrals."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


class UsersCollection:
    def __init__(self, users):
        self.users = {item["_id"]: item for item in users}

    async def find_one(self, query):
        return self.users.get(query.get("_id"))

    async def update_one(self, query, update):
        user = self.users[query["_id"]]
        event_filter = query.get("processed_savvy_point_events", {}).get("$ne")
        if event_filter in user.get("processed_savvy_point_events", []):
            return SimpleNamespace(matched_count=0)
        user.update(update.get("$set", {}))
        for key, value in update.get("$inc", {}).items():
            user[key] = user.get(key, 0) + value
        for key, value in update.get("$addToSet", {}).items():
            if value not in user.setdefault(key, []):
                user[key].append(value)
        return SimpleNamespace(matched_count=1)


class LedgerCollection:
    def __init__(self):
        self.events = {}

    async def insert_one(self, document):
        if document["event_key"] in self.events:
            raise DuplicateKeyError("duplicate event")
        document = {"_id": ObjectId(), **document}
        self.events[document["event_key"]] = document
        return SimpleNamespace(inserted_id=document["_id"])

    async def update_one(self, query, update):
        self.events[query["event_key"]].update(update.get("$set", {}))
        return SimpleNamespace(matched_count=1)


class ReferralsCollection:
    def __init__(self, referral):
        self.referral = referral

    async def find_one(self, query):
        if query.get("referred_id") == self.referral["referred_id"]:
            return self.referral
        return None

    async def update_one(self, query, update):
        self.referral.update(update.get("$set", {}))
        return SimpleNamespace(matched_count=1)


class RewardCursor:
    def __init__(self, rows):
        self.rows = rows

    def sort(self, *args):
        return self

    async def to_list(self, limit):
        return self.rows[:limit]


class RewardsCollection:
    def __init__(self):
        self.rows = []

    async def insert_one(self, document):
        if any(
            row["user_id"] == document["user_id"]
            and row["tier_key"] == document["tier_key"]
            for row in self.rows
        ):
            raise DuplicateKeyError("duplicate tier reward")
        self.rows.append(document)
        return SimpleNamespace(inserted_id=document["_id"])

    def find(self, query):
        return RewardCursor(
            [row for row in self.rows if row["user_id"] == query["user_id"]]
        )


def test_tier_progress_uses_lifetime_points():
    tier = server.savvy_tier(2500)
    assert tier["name"] == "Deal Hunter"
    assert tier["next_tier"]["name"] == "Savvy Insider"
    assert tier["points_to_next"] == 2500
    assert tier["progress_percent"] == 16.7


def test_tier_boundaries_match_current_reward_journey():
    assert server.savvy_tier(1999)["name"] == "Campus Starter"
    assert server.savvy_tier(2000)["name"] == "Deal Hunter"
    assert server.savvy_tier(4999)["name"] == "Deal Hunter"
    assert server.savvy_tier(5000)["name"] == "Savvy Insider"
    assert server.savvy_tier(11999)["name"] == "Savvy Insider"
    assert server.savvy_tier(12000)["name"] == "Campus Icon"


def test_award_is_idempotent(monkeypatch):
    user_id = ObjectId()
    users = UsersCollection(
        [
            {
                "_id": user_id,
                "reward_points": 100,
                "savvy_points_balance": 100,
                "savvy_points_lifetime": 100,
            }
        ]
    )
    ledger = LedgerCollection()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, savvy_points_transactions=ledger),
    )

    first = asyncio.run(
        server.award_savvy_points(
            user_id, 50, "redemption", "coupon-1", "Redeemed", "Partner deal used."
        )
    )
    second = asyncio.run(
        server.award_savvy_points(
            user_id, 50, "redemption", "coupon-1", "Redeemed", "Partner deal used."
        )
    )

    assert first is True
    assert second is False
    assert users.users[user_id]["savvy_points_balance"] == 150
    assert users.users[user_id]["savvy_points_lifetime"] == 150
    assert len(ledger.events) == 1


def test_verified_referral_releases_100_to_each_once(monkeypatch):
    referrer_id = ObjectId()
    referred_id = ObjectId()
    referral_id = ObjectId()
    users = UsersCollection(
        [
            {
                "_id": referrer_id,
                "email": "referrer@example.com",
                "verification_status": "approved",
                "reward_points": 100,
                "savvy_points_balance": 100,
                "savvy_points_lifetime": 100,
            },
            {
                "_id": referred_id,
                "email": "friend@example.com",
                "name": "Verified Friend",
                "verification_status": "approved",
                "reward_points": 300,
                "savvy_points_balance": 300,
                "savvy_points_lifetime": 300,
            },
        ]
    )
    referrals = ReferralsCollection(
        {
            "_id": referral_id,
            "referrer_id": referrer_id,
            "referred_id": referred_id,
            "status": "pending",
            "points_awarded": 0,
        }
    )
    ledger = LedgerCollection()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            users=users,
            referrals=referrals,
            savvy_points_transactions=ledger,
        ),
    )
    monkeypatch.setattr(server, "send_email", lambda *args, **kwargs: {"ok": True})

    assert asyncio.run(server.complete_pending_referral(referred_id)) is True
    assert asyncio.run(server.complete_pending_referral(referred_id)) is False
    assert users.users[referrer_id]["savvy_points_balance"] == 200
    assert users.users[referred_id]["savvy_points_balance"] == 400
    assert referrals.referral["status"] == "awarded"
    assert referrals.referral["points_awarded"] == 100
    assert len(ledger.events) == 2


def test_level_rewards_are_issued_once_with_30_day_qr_and_email(monkeypatch):
    user_id = ObjectId()
    users = UsersCollection(
        [
            {
                "_id": user_id,
                "email": "icon@example.com",
                "name": "Reward Student",
                "verification_status": "approved",
                "savvy_points_balance": 5100,
                "savvy_points_lifetime": 5100,
                "reward_points": 5100,
            }
        ]
    )
    rewards = RewardsCollection()
    emails = []
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, savvy_level_rewards=rewards),
    )
    monkeypatch.setattr(
        server,
        "send_email",
        lambda to, subject, body, attachments=None: emails.append(
            {"to": to, "subject": subject, "body": body, "attachments": attachments}
        )
        or {"ok": True},
    )

    issued = asyncio.run(server.ensure_level_rewards(user_id))
    repeated = asyncio.run(server.ensure_level_rewards(user_id))

    assert [item["tier_key"] for item in issued] == ["deal_hunter", "savvy_insider"]
    assert len(repeated) == 2
    assert len(rewards.rows) == 2
    assert len(emails) == 2
    assert all(item["code"].startswith("SVR-") for item in rewards.rows)
    assert all(
        item["qr_data_uri"].startswith("data:image/png;base64,")
        for item in rewards.rows
    )
    assert all(
        29 <= (item["expires_at"] - item["unlocked_at"]).days <= 30
        for item in rewards.rows
    )
    assert emails[0]["attachments"][0]["content_id"] == "level-reward-qr"
