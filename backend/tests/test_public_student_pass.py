"""Public student-pass QR verification coverage."""
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
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


class UsersCollection:
    def __init__(self, user):
        self.user = dict(user)

    async def find_one(self, query, *args, **kwargs):
        if query.get("_id") != self.user["_id"]:
            return None
        if query.get("role") != self.user["role"]:
            return None
        return dict(self.user)


def approved_student(**overrides):
    user = {
        "_id": ObjectId(),
        "role": "student",
        "name": "Public Test Student",
        "email": "private@example.com",
        "phone": "+91 9999999999",
        "college": "Test College",
        "course": "B.Tech",
        "year": "2nd year",
        "student_number": "SCD-2026-PUBLIC",
        "verification_status": "approved",
        "verification_expiry": datetime.now(timezone.utc) + timedelta(days=30),
    }
    user.update(overrides)
    return user


def test_public_pass_token_round_trip_and_rejects_tampering():
    user = approved_student()
    token = server.create_public_pass_token(user)

    assert server.decode_public_pass_token(token) == user["_id"]

    try:
        server.decode_public_pass_token(f"{token[:-1]}X")
        assert False, "tampered token should not validate"
    except server.HTTPException as exc:
        assert exc.status_code == 404


def test_student_card_qr_points_to_public_verification(monkeypatch):
    user = approved_student()
    monkeypatch.setattr(server, "generate_qr_data_uri", lambda payload: payload)

    result = asyncio.run(server.student_card(user=user))

    assert result["qr_data_uri"].startswith(
        f"{server.FRONTEND_URL}/verify-pass?t="
    )
    assert "/scan?" not in result["qr_data_uri"]


def test_public_pass_returns_limited_verified_profile(monkeypatch):
    user = approved_student()
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=UsersCollection(user)),
    )

    result = asyncio.run(
        server.public_student_pass(server.create_public_pass_token(user))
    )

    assert result["verified"] is True
    assert result["status"] == "approved"
    assert result["name"] == user["name"]
    assert result["student_number"] == user["student_number"]
    assert "email" not in result
    assert "phone" not in result


def test_public_pass_reports_expired_status(monkeypatch):
    user = approved_student(
        verification_expiry=datetime.now(timezone.utc) - timedelta(days=1)
    )
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(users=UsersCollection(user)),
    )

    result = asyncio.run(
        server.public_student_pass(server.create_public_pass_token(user))
    )

    assert result["verified"] is False
    assert result["status"] == "expired"
