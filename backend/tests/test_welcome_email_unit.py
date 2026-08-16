"""Focused coverage for the one-time post-verification welcome email."""
import asyncio
import os
import sys
from pathlib import Path

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


class FakeUsers:
    def __init__(self, claimed):
        self.claimed = claimed
        self.claim_calls = []
        self.update_calls = []

    async def find_one_and_update(self, query, update, return_document=None):
        self.claim_calls.append((query, update, return_document))
        return self.claimed

    async def update_one(self, query, update):
        self.update_calls.append((query, update))


class FakeDb:
    def __init__(self, claimed):
        self.users = FakeUsers(claimed)


def eligible_user(**overrides):
    user = {
        "_id": ObjectId(),
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "welcome_email_eligible": True,
    }
    user.update(overrides)
    return user


def test_welcome_email_is_premium_informative_and_escapes_name(monkeypatch):
    monkeypatch.setattr(server, "FRONTEND_URL", "https://savvy.example")
    rendered = server.welcome_email_html(eligible_user(name="<Aarav> Sharma"))

    assert "&lt;Aarav&gt;" in rendered
    assert "100 Savvy Points" in rendered
    assert "No gatekeeping" in rendered
    assert "https://savvy.example/verify" in rendered
    assert "https://savvy.example/privacy" in rendered


def test_welcome_email_claims_and_marks_success_once(monkeypatch):
    user = eligible_user()
    fake_db = FakeDb(user)
    sent = []
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(
        server,
        "send_email",
        lambda to, subject, body: sent.append((to, subject, body)) or {"ok": True, "error": None},
    )

    result = asyncio.run(server.send_welcome_email_once(user))

    assert result == {"ok": True, "error": None, "skipped": False}
    assert len(sent) == 1
    assert "welcome to Savvy" in sent[0][1]
    assert fake_db.users.claim_calls[0][0]["welcome_email_sent_at"] == {"$exists": False}
    assert "welcome_email_sent_at" in fake_db.users.update_calls[0][1]["$set"]


def test_welcome_email_skips_ineligible_and_already_sent_users(monkeypatch):
    fake_db = FakeDb(None)
    monkeypatch.setattr(server, "db", fake_db)

    ineligible = asyncio.run(server.send_welcome_email_once(eligible_user(welcome_email_eligible=False)))
    already_sent = asyncio.run(server.send_welcome_email_once(eligible_user(welcome_email_sent_at="done")))

    assert ineligible["skipped"] is True
    assert already_sent["skipped"] is True
    assert fake_db.users.claim_calls == []


def test_delivery_failure_is_recorded_and_can_be_retried(monkeypatch):
    user = eligible_user()
    fake_db = FakeDb(user)
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(server, "send_email", lambda *_: {"ok": False, "error": "temporary"})

    result = asyncio.run(server.send_welcome_email_once(user))

    assert result["ok"] is False
    failure_update = fake_db.users.update_calls[0][1]
    assert failure_update["$set"]["welcome_email_last_error"] == "temporary"
    assert "welcome_email_sending_at" in failure_update["$unset"]
