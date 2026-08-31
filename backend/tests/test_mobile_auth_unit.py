"""Unit coverage for the mobile session model: /auth/mobile/login, /refresh
(rotation + reuse detection), /logout, /logout-all — additive to the
website's cookie/7-day-token flow, which these tests don't touch.
"""

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
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


def _matches(doc, query):
    for key, expected in query.items():
        actual = doc.get(key)
        if isinstance(expected, dict) and "$gt" in expected:
            if actual is None or not actual > expected["$gt"]:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, key, direction=1):
        self.rows.sort(key=lambda d: d[key], reverse=direction == -1)
        return self

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for row in self.rows:
            yield row


class FakeUsers:
    def __init__(self, users):
        self.users = {u["_id"]: u for u in users}

    async def find_one(self, query):
        for user in self.users.values():
            if _matches(user, query):
                return user
        return None

    async def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", ObjectId())
        self.users[doc["_id"]] = doc
        return SimpleNamespace(inserted_id=doc["_id"])

    async def update_one(self, query, update):
        for user in self.users.values():
            if _matches(user, query):
                user.update(update.get("$set", {}))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)


class FakeSessions:
    def __init__(self):
        self.docs = {}

    async def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", ObjectId())
        self.docs[doc["_id"]] = doc
        return SimpleNamespace(inserted_id=doc["_id"])

    async def find_one(self, query):
        for doc in self.docs.values():
            if _matches(doc, query):
                return doc
        return None

    async def find_one_and_update(self, query, update, return_document=None):
        for doc in self.docs.values():
            if _matches(doc, query):
                before = dict(doc)
                doc.update(update.get("$set", {}))
                return before
        return None

    async def update_one(self, query, update):
        for doc in self.docs.values():
            if _matches(doc, query):
                doc.update(update.get("$set", {}))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def update_many(self, query, update):
        count = 0
        for doc in self.docs.values():
            if _matches(doc, query):
                doc.update(update.get("$set", {}))
                count += 1
        return SimpleNamespace(matched_count=count, modified_count=count)

    def find(self, query):
        return FakeCursor([doc for doc in self.docs.values() if _matches(doc, query)])


class FakeDeviceTokens:
    def __init__(self):
        self.delete_many_calls = []

    async def delete_many(self, query):
        self.delete_many_calls.append(query)
        return SimpleNamespace(deleted_count=0)


def _student(**overrides):
    user = {
        "_id": ObjectId(),
        "email": "student@example.com",
        "password_hash": server.hash_password("Correct@123"),
        "role": "student",
        "verification_status": "not_submitted",
    }
    user.update(overrides)
    return user


def _fake_request(ip="127.0.0.1", user_agent="pytest-agent"):
    return SimpleNamespace(
        client=SimpleNamespace(host=ip),
        headers={"user-agent": user_agent},
    )


def test_mobile_login_issues_session_and_rejects_wrong_password(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    result = asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(
                email=user["email"], password="Correct@123", platform="ios"
            ),
            _fake_request(),
        )
    )

    assert result["access_token"]
    assert result["refresh_token"]
    assert result["expires_in"] == server.MOBILE_ACCESS_TOKEN_MINUTES * 60
    assert len(sessions.docs) == 1
    doc = next(iter(sessions.docs.values()))
    assert doc["revoked"] is False
    assert doc["platform"] == "ios"
    # The refresh token itself is never stored — only its hash.
    assert doc["refresh_token_hash"] == server._hash_refresh_token(
        result["refresh_token"]
    )
    assert result["refresh_token"] not in str(doc)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.mobile_login(
                server.MobileLoginIn(email=user["email"], password="wrong-password"),
                _fake_request(),
            )
        )
    assert exc.value.status_code == 401


def test_mobile_account_exists_normalizes_email_and_reports_missing(monkeypatch):
    user = _student()
    monkeypatch.setattr(server, "db", SimpleNamespace(users=FakeUsers([user])))

    found = asyncio.run(
        server.mobile_account_exists(
            server.MobileAccountLookupIn(email="STUDENT@example.com")
        )
    )
    missing = asyncio.run(
        server.mobile_account_exists(
            server.MobileAccountLookupIn(email="missing@example.com")
        )
    )

    assert found == {"exists": True}
    assert missing == {"exists": False}


def test_mobile_refresh_rotates_token_and_keeps_family(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    login = asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(email=user["email"], password="Correct@123"),
            _fake_request(),
        )
    )
    original_family = next(iter(sessions.docs.values()))["family_id"]

    refreshed = asyncio.run(
        server.mobile_refresh(
            server.MobileRefreshIn(refresh_token=login["refresh_token"])
        )
    )

    assert refreshed["access_token"]
    assert refreshed["refresh_token"] != login["refresh_token"]
    assert (
        len(sessions.docs) == 2
    ), "rotation creates a new session document, keeps the old one for audit"
    old_doc = next(
        d
        for d in sessions.docs.values()
        if d["refresh_token_hash"] == server._hash_refresh_token(login["refresh_token"])
    )
    new_doc = next(
        d
        for d in sessions.docs.values()
        if d["refresh_token_hash"]
        == server._hash_refresh_token(refreshed["refresh_token"])
    )
    assert old_doc["revoked"] is True
    assert old_doc["revoked_reason"] == "rotated"
    assert new_doc["revoked"] is False
    assert new_doc["family_id"] == original_family


def test_mobile_refresh_reuse_detection_revokes_whole_family(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    login = asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(email=user["email"], password="Correct@123"),
            _fake_request(),
        )
    )
    refreshed = asyncio.run(
        server.mobile_refresh(
            server.MobileRefreshIn(refresh_token=login["refresh_token"])
        )
    )

    # Replaying the original (already-rotated-away) refresh token is reuse —
    # it must fail AND kill the freshly-issued, otherwise-still-valid token
    # from the legitimate rotation too.
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.mobile_refresh(
                server.MobileRefreshIn(refresh_token=login["refresh_token"])
            )
        )
    assert exc.value.status_code == 401
    assert all(doc["revoked"] for doc in sessions.docs.values())

    with pytest.raises(HTTPException) as exc2:
        asyncio.run(
            server.mobile_refresh(
                server.MobileRefreshIn(refresh_token=refreshed["refresh_token"])
            )
        )
    assert exc2.value.status_code == 401


def test_mobile_refresh_rejects_unknown_or_expired_token(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.mobile_refresh(
                server.MobileRefreshIn(refresh_token="not-a-real-token")
            )
        )
    assert exc.value.status_code == 401

    now = datetime.now(timezone.utc)
    asyncio.run(
        sessions.insert_one(
            {
                "user_id": user["_id"],
                "refresh_token_hash": server._hash_refresh_token("expired-token"),
                "family_id": "fam-1",
                "device_name": "",
                "platform": None,
                "created_at": now - timedelta(days=100),
                "last_used_at": now - timedelta(days=100),
                "expires_at": now - timedelta(days=1),
                "revoked": False,
                "revoked_at": None,
                "revoked_reason": None,
            }
        )
    )
    with pytest.raises(HTTPException) as exc2:
        asyncio.run(
            server.mobile_refresh(server.MobileRefreshIn(refresh_token="expired-token"))
        )
    assert exc2.value.status_code == 401


def test_mobile_refresh_rejects_disabled_partner_account(monkeypatch):
    partner = _student(role="outlet_partner", active=False, email="partner@example.com")
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([partner]), sessions=sessions)
    )

    now = datetime.now(timezone.utc)
    asyncio.run(
        sessions.insert_one(
            {
                "user_id": partner["_id"],
                "refresh_token_hash": server._hash_refresh_token("partner-token"),
                "family_id": "fam-partner",
                "device_name": "",
                "platform": None,
                "created_at": now,
                "last_used_at": now,
                "expires_at": now + timedelta(days=1),
                "revoked": False,
                "revoked_at": None,
                "revoked_reason": None,
            }
        )
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.mobile_refresh(server.MobileRefreshIn(refresh_token="partner-token"))
        )
    assert exc.value.status_code == 403


def test_mobile_logout_revokes_only_the_matching_session(monkeypatch):
    user = _student()
    other_user_id = ObjectId()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    login = asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(email=user["email"], password="Correct@123"),
            _fake_request(),
        )
    )
    other_login_doc_id = asyncio.run(
        sessions.insert_one(
            {
                "user_id": other_user_id,
                "refresh_token_hash": server._hash_refresh_token("someone-elses-token"),
                "family_id": "fam-other",
                "device_name": "",
                "platform": None,
                "created_at": datetime.now(timezone.utc),
                "last_used_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
                "revoked": False,
                "revoked_at": None,
                "revoked_reason": None,
            }
        )
    ).inserted_id

    result = asyncio.run(
        server.mobile_logout(server.MobileLogoutIn(refresh_token=login["refresh_token"]))
    )

    assert result == {"ok": True}
    my_doc = next(
        d
        for d in sessions.docs.values()
        if d["refresh_token_hash"] == server._hash_refresh_token(login["refresh_token"])
    )
    assert my_doc["revoked"] is True
    assert my_doc["revoked_reason"] == "logout"
    assert sessions.docs[other_login_doc_id]["revoked"] is False


def test_mobile_logout_all_revokes_every_session_and_clears_push_tokens(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    device_tokens = FakeDeviceTokens()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            users=FakeUsers([user]), sessions=sessions, device_tokens=device_tokens
        ),
    )

    asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(email=user["email"], password="Correct@123"),
            _fake_request(),
        )
    )
    asyncio.run(
        server.mobile_login(
            server.MobileLoginIn(email=user["email"], password="Correct@123"),
            _fake_request(),
        )
    )
    assert len(sessions.docs) == 2

    result = asyncio.run(server.mobile_logout_all(user=user))

    assert result["revoked_count"] == 2
    assert all(doc["revoked"] for doc in sessions.docs.values())
    assert all(doc["revoked_reason"] == "logout_all" for doc in sessions.docs.values())
    assert device_tokens.delete_many_calls == [{"user_id": user["_id"]}]


def test_mobile_sessions_lists_only_active_unexpired_sessions(monkeypatch):
    user = _student()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server, "db", SimpleNamespace(users=FakeUsers([user]), sessions=sessions)
    )

    now = datetime.now(timezone.utc)
    asyncio.run(
        sessions.insert_one(
            {
                "_id": ObjectId(),
                "user_id": user["_id"],
                "refresh_token_hash": "active-hash",
                "family_id": "fam-active",
                "device_name": "iPhone 17 Pro",
                "platform": "ios",
                "created_at": now,
                "last_used_at": now,
                "expires_at": now + timedelta(days=10),
                "revoked": False,
            }
        )
    )
    asyncio.run(
        sessions.insert_one(
            {
                "_id": ObjectId(),
                "user_id": user["_id"],
                "refresh_token_hash": "revoked-hash",
                "family_id": "fam-revoked",
                "device_name": "Old Android",
                "platform": "android",
                "created_at": now,
                "last_used_at": now,
                "expires_at": now + timedelta(days=10),
                "revoked": True,
            }
        )
    )

    result = asyncio.run(server.mobile_sessions(user=user))

    assert len(result["sessions"]) == 1
    assert result["sessions"][0]["device_name"] == "iPhone 17 Pro"


def test_mobile_register_reuses_shared_account_creation(monkeypatch):
    users = FakeUsers([])
    otp_codes = FakeSessions()  # generic insert-only fake works fine here
    savvy_tx = FakeSessions()
    referrals = FakeSessions()
    sessions = FakeSessions()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            users=users,
            otp_codes=otp_codes,
            savvy_points_transactions=savvy_tx,
            referrals=referrals,
            sessions=sessions,
        ),
    )
    monkeypatch.setattr(server, "send_email", lambda *args, **kwargs: {"ok": True})

    result = asyncio.run(
        server.mobile_register(
            server.MobileRegisterIn(
                name="Mobile Student",
                email="mobile.student@example.com",
                password="Correct@123",
                platform="android",
            ),
            _fake_request(),
        )
    )

    assert result["user"]["email"] == "mobile.student@example.com"
    assert result["access_token"]
    assert result["refresh_token"]
    assert len(users.users) == 1
    assert len(sessions.docs) == 1
