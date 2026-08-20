"""Focused coverage for predefined student avatar preferences."""

import asyncio
import os
import sys
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


class FakeUsers:
    def __init__(self, user):
        self.user = dict(user)
        self.updates = []

    async def update_one(self, query, update):
        self.updates.append((query, update))
        self.user.update(update.get("$set", {}))
        return SimpleNamespace(modified_count=1)

    async def find_one(self, _query):
        return dict(self.user)


def student():
    return {
        "_id": ObjectId(),
        "email": "avatar@example.com",
        "name": "Avatar Student",
        "role": "student",
        "verification_status": "not_submitted",
    }


def test_profile_accepts_predefined_avatar_and_serializes_it(monkeypatch):
    user = student()
    users = FakeUsers(user)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))

    result = asyncio.run(
        server.update_profile(server.ProfileUpdateIn(avatar_key="campus_cat"), user)
    )

    assert result["avatar_key"] == "campus_cat"
    assert users.updates[0][1]["$set"] == {"avatar_key": "campus_cat"}


def test_profile_rejects_arbitrary_avatar_value(monkeypatch):
    user = student()
    users = FakeUsers(user)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.update_profile(
                server.ProfileUpdateIn(avatar_key="https://example.com/custom.png"),
                user,
            )
        )

    assert exc.value.status_code == 400
    assert users.updates == []


def test_profile_rejects_custom_avatar_url(monkeypatch):
    user = student()
    users = FakeUsers(user)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.update_profile(
                server.ProfileUpdateIn(avatar_url="https://example.com/custom.png"),
                user,
            )
        )

    assert exc.value.status_code == 400
    assert users.updates == []


def test_profile_can_return_to_initials(monkeypatch):
    user = {**student(), "avatar_key": "lucky_star"}
    users = FakeUsers(user)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))

    result = asyncio.run(server.update_profile(server.ProfileUpdateIn(avatar_key=""), user))

    assert result["avatar_key"] == ""
