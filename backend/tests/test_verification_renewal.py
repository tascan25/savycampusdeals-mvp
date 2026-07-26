"""Focused unit coverage for verification expiry and email correction."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from bson import ObjectId
from fastapi import Response

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


class UsersCollection:
    def __init__(self, user):
        self.user = dict(user)

    async def find_one(self, query, *args, **kwargs):
        if "email" in query and query["email"] != self.user.get("email"):
            return None
        if "_id" in query and query["_id"] != self.user.get("_id"):
            return None
        return dict(self.user)

    async def update_one(self, query, update):
        if query.get("_id") != self.user["_id"]:
            return SimpleNamespace(matched_count=0)
        if query.get("email") and query["email"] != self.user["email"]:
            return SimpleNamespace(matched_count=0)
        self.user.update(update.get("$set", {}))
        for key in update.get("$unset", {}):
            self.user.pop(key, None)
        return SimpleNamespace(matched_count=1)


class OtpCollection:
    def __init__(self):
        self.items = []

    async def update_many(self, query, update):
        for item in self.items:
            if item["user_id"] == query["user_id"] and not item.get("used"):
                item.update(update["$set"])
        return SimpleNamespace(modified_count=len(self.items))

    async def insert_one(self, document):
        self.items.append(dict(document))
        return SimpleNamespace(inserted_id=ObjectId())

    async def find_one(self, query, *args, **kwargs):
        matches = [
            item
            for item in self.items
            if item["user_id"] == query["user_id"]
            and item.get("used", False) == query.get("used", False)
        ]
        return dict(matches[-1]) if matches else None

    async def update_one(self, query, update):
        for item in self.items:
            if item.get("_id") == query.get("_id"):
                item.update(update.get("$set", {}))
                for key, amount in update.get("$inc", {}).items():
                    item[key] = item.get(key, 0) + amount
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)


class VerificationCollection:
    def __init__(self, document):
        self.document = dict(document)

    async def find_one(self, *args, **kwargs):
        return dict(self.document)

    async def update_one(self, query, update):
        self.document.update(update["$set"])
        self.document.setdefault("review_history", []).append(
            update["$push"]["review_history"]
        )
        return SimpleNamespace(matched_count=1)

    async def replace_one(self, query, document):
        self.document = dict(document)
        return SimpleNamespace(matched_count=1)


def expired_user(**overrides):
    now = datetime.now(timezone.utc)
    user = {
        "_id": ObjectId(),
        "email": "student@example.com",
        "name": "Renewing Student",
        "role": "student",
        "email_verified": True,
        "verification_status": "approved",
        "verification_expiry": now - timedelta(days=1),
        "student_number": "SCD-RENEW",
        "reward_points": 200,
        "created_at": now - timedelta(days=400),
    }
    user.update(overrides)
    return user


def test_expired_approval_serializes_as_expired():
    user = expired_user()

    result = server.serialize_user(user)

    assert result["verification_status"] == "expired"
    assert result["reverification_email_verified"] is False


def test_start_reverification_invalidates_email_and_issues_fresh_otp(monkeypatch):
    user = expired_user(verification_status="expired")
    users = UsersCollection(user)
    otps = OtpCollection()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, otp_codes=otps),
    )
    monkeypatch.setattr(
        server,
        "send_email",
        lambda *args, **kwargs: {"ok": True, "error": None},
    )

    result = asyncio.run(server.start_reverification(user=user))

    assert result["user"]["verification_status"] == "expired"
    assert result["user"]["email_verified"] is False
    assert users.user["email_verified"] is False
    assert otps.items[-1]["purpose"] == "reverification"
    assert otps.items[-1]["attempts"] == 0


def test_change_email_updates_same_account_and_issues_new_token(monkeypatch):
    user = expired_user(
        verification_status="expired",
        email_verified=False,
    )
    users = UsersCollection(user)
    otps = OtpCollection()
    otps.items.append({
        "user_id": user["_id"],
        "email": user["email"],
        "otp": "111111",
        "used": False,
    })
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, otp_codes=otps),
    )
    monkeypatch.setattr(
        server,
        "send_email",
        lambda *args, **kwargs: {"ok": True, "error": None},
    )

    result = asyncio.run(
        server.change_pending_email(
            server.EmailChangeIn(email="corrected@iitd.ac.in"),
            Response(),
            user=user,
        )
    )

    assert users.user["email"] == "corrected@iitd.ac.in"
    assert result["user"]["id"] == str(user["_id"])
    assert result["user"]["email"] == "corrected@iitd.ac.in"
    assert result["token"]
    assert otps.items[0]["used"] is True
    assert otps.items[-1]["email"] == "corrected@iitd.ac.in"
    assert otps.items[-1]["purpose"] == "reverification"


def test_same_student_id_can_be_reused_by_original_owner_for_renewal(monkeypatch):
    now = datetime.now(timezone.utc)
    user = expired_user(
        email="student@iitd.ac.in",
        verification_status="expired",
        reverification_email_verified_at=now,
    )
    verification = {
        "_id": ObjectId(),
        "user_id": user["_id"],
        "student_id_number": "IITD-100",
        "student_id_normalized": "IITD-100",
        "college_id_image": "https://res.cloudinary.com/demo/old-id.png",
        "selfie_image": "https://res.cloudinary.com/demo/old-selfie.png",
        "method": "document_review",
        "status": "approved",
        "submitted_at": now - timedelta(days=366),
        "reviewed_at": now - timedelta(days=365),
        "reviewer_note": "",
    }
    users = UsersCollection(user)
    verifications = VerificationCollection(verification)
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, verifications=verifications),
    )

    result = asyncio.run(
        server.submit_verification(
            server.VerificationSubmitIn(
                college_id_image="",
                selfie_image="",
                college_name="IIT Delhi",
                course="B.Tech",
                year="4",
                student_id_number="IITD-100",
            ),
            user=user,
        )
    )

    assert result["verification_method"] == "college_email"
    assert verifications.document["_id"] == verification["_id"]
    assert verifications.document["status"] == "approved"
    assert len(verifications.document["review_history"]) == 1
    assert users.user["verification_status"] == "approved"
    assert users.user["verification_expiry"] > now


def test_otp_is_invalidated_after_five_wrong_attempts(monkeypatch):
    user = expired_user(verification_status="expired", email_verified=False)
    users = UsersCollection(user)
    otps = OtpCollection()
    otp_id = ObjectId()
    otps.items.append({
        "_id": otp_id,
        "user_id": user["_id"],
        "email": user["email"],
        "otp": "123456",
        "attempts": 4,
        "used": False,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=users, otp_codes=otps),
    )

    try:
        asyncio.run(
            server.verify_otp(
                server.OtpVerifyIn(email=user["email"], otp="000000")
            )
        )
        assert False, "wrong OTP should not succeed"
    except server.HTTPException as exc:
        assert exc.status_code == 429

    assert otps.items[0]["attempts"] == 5
    assert otps.items[0]["used"] is True
