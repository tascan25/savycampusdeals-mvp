"""Unit coverage for permanent student account deletion."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException, Response

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


class VerificationCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, _limit):
        return list(self.rows)


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.deleted_queries = []

    def find(self, query, projection=None):
        matching = [row for row in self.rows if row.get("user_id") == query.get("user_id")]
        return VerificationCursor(matching)

    async def delete_many(self, query, **_kwargs):
        self.deleted_queries.append(query)
        return SimpleNamespace(deleted_count=1)

    async def delete_one(self, query, **_kwargs):
        self.deleted_queries.append(query)
        return SimpleNamespace(deleted_count=1)

    async def update_many(self, query, update, **_kwargs):
        self.deleted_queries.append((query, update))
        return SimpleNamespace(modified_count=1)


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def with_transaction(self, callback):
        return await callback(self)


class FakeClient:
    async def start_session(self):
        return FakeSession()


def fake_db(*, verification_rows=None):
    names = (
        "users",
        "verifications",
        "saved_offers",
        "coupons",
        "brand_offer_claims",
        "savvy_points_transactions",
        "savvy_level_rewards",
        "announcement_receipts",
        "email_campaign_recipients",
        "outlet_daily_redemptions",
        "offer_monthly_redemptions",
        "offer_once_redemptions",
        "otp_codes",
        "password_resets",
        "referrals",
    )
    collections = {name: FakeCollection() for name in names}
    collections["verifications"] = FakeCollection(verification_rows)
    return SimpleNamespace(**collections)


def student():
    return {
        "_id": ObjectId(),
        "role": "student",
        "name": "Test Student",
        "email": "student@example.com",
        "password_hash": server.hash_password("Secure1!"),
    }


def test_delete_account_purges_all_owned_records(monkeypatch):
    user = student()
    database = fake_db(
        verification_rows=[
            {
                "user_id": user["_id"],
                "college_id_image_public_id": "savycampusdeals/verification/id/college",
            }
        ]
    )
    cloud_calls = []
    sent_emails = []
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "client", FakeClient())
    monkeypatch.setattr(
        server,
        "delete_verification_images_for_user",
        lambda identifier: cloud_calls.append(identifier) or True,
    )
    monkeypatch.setattr(
        server,
        "send_email",
        lambda to, subject, body: sent_emails.append((to, subject, body))
        or {"ok": True, "error": None},
    )

    result = asyncio.run(
        server.delete_account(
            server.DeleteAccountIn(password="Secure1!", confirmation="DELETE"),
            Response(),
            user,
        )
    )

    assert result == {"ok": True}
    assert cloud_calls == [str(user["_id"])]
    assert len(sent_emails) == 1
    assert sent_emails[0][0] == user["email"]
    assert "sad to see you go" in sent_emails[0][1]
    assert "permanently deleted" in sent_emails[0][2]
    assert database.users.deleted_queries == [
        (
            {"referrer_id": user["_id"]},
            {"$unset": {"referrer_id": ""}},
        ),
        {"_id": user["_id"]},
    ]
    assert database.referrals.deleted_queries == [
        {"$or": [{"referrer_id": user["_id"]}, {"referred_id": user["_id"]}]}
    ]
    for name, collection in vars(database).items():
        if name not in {"users", "referrals"}:
            assert collection.deleted_queries == [{"user_id": user["_id"]}]


def test_delete_account_rejects_incorrect_password_before_any_deletion(monkeypatch):
    user = student()
    database = fake_db()
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "client", FakeClient())

    with pytest.raises(HTTPException, match="Incorrect password") as exc:
        asyncio.run(
            server.delete_account(
                server.DeleteAccountIn(password="Wrong1!", confirmation="DELETE"),
                Response(),
                user,
            )
        )

    assert exc.value.status_code == 401
    assert not any(collection.deleted_queries for collection in vars(database).values())


def test_account_deleted_email_escapes_name_and_links_support(monkeypatch):
    monkeypatch.setattr(server, "FRONTEND_URL", "https://savvy.example")
    rendered = server.account_deleted_email_html(student() | {"name": "<Aarav> Sharma"})

    assert "&lt;Aarav&gt;" in rendered
    assert "https://savvy.example/support" in rendered
    assert "associated account data and verification images" in rendered


def test_cloudinary_failure_keeps_database_account(monkeypatch):
    user = student()
    database = fake_db(
        verification_rows=[
            {
                "user_id": user["_id"],
                "selfie_image_public_id": "savycampusdeals/verification/id/selfie",
            }
        ]
    )
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "client", FakeClient())
    monkeypatch.setattr(server, "delete_verification_images_for_user", lambda _id: False)
    sent_emails = []
    monkeypatch.setattr(
        server,
        "send_email",
        lambda *args: sent_emails.append(args) or {"ok": True, "error": None},
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.delete_account(
                server.DeleteAccountIn(password="Secure1!", confirmation="DELETE"),
                Response(),
                user,
            )
        )

    assert exc.value.status_code == 503
    assert not any(collection.deleted_queries for collection in vars(database).values())
    assert sent_emails == []
