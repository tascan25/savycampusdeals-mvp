"""Focused unit coverage for admin-managed five-day announcements."""
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


class AsyncCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.index = 0

    def sort(self, *_args):
        return self

    async def to_list(self, _length):
        return self.rows

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index >= len(self.rows):
            raise StopAsyncIteration
        item = self.rows[self.index]
        self.index += 1
        return item


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class AnnouncementCollection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, _query):
        return AsyncCursor(self.rows)

    async def find_one(self, query):
        return next((row for row in self.rows if row["_id"] == query.get("_id")), None)

    async def insert_one(self, document):
        document["_id"] = ObjectId()
        self.rows.append(document)
        return InsertResult(document["_id"])


class ReceiptCollection:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.updates = []

    def find(self, query):
        rows = [row for row in self.rows if row.get("user_id") == query.get("user_id")]
        return AsyncCursor(rows)

    async def update_one(self, query, update, upsert=False):
        self.updates.append((query, update, upsert))
        return SimpleNamespace(matched_count=1)


def announcement(now, *, audience="students"):
    return {
        "_id": ObjectId(),
        "title": "Savvy Points just levelled up",
        "message": "Explore the new reward journey.",
        "category": "new",
        "audience": audience,
        "priority": 1,
        "cta_label": "Explore now",
        "cta_url": "/dashboard",
        "image_url": "",
        "published": True,
        "starts_at": now - timedelta(hours=1),
        "expires_at": now + timedelta(days=4, hours=23),
        "created_at": now,
        "updated_at": now,
    }


def test_admin_create_announcement_always_uses_five_day_window(monkeypatch):
    rows = []
    fake_db = SimpleNamespace(announcements=AnnouncementCollection(rows))
    monkeypatch.setattr(server, "db", fake_db)
    start = datetime(2026, 8, 15, 6, 30, tzinfo=timezone.utc)

    result = asyncio.run(server.admin_create_announcement(
        server.AdminAnnouncementIn(
            title="A fresh feature",
            message="The Savvy reward collection is now live.",
            audience="students",
            category="new",
            starts_at=start,
            published=True,
        ),
        admin={"_id": ObjectId(), "role": "admin"},
    ))

    assert rows[0]["expires_at"] - rows[0]["starts_at"] == timedelta(days=5)
    assert result["published"] is True
    assert result["audience"] == "students"


def test_student_gets_unseen_modal_once_and_delivery_is_recorded(monkeypatch):
    now = datetime.now(timezone.utc)
    item = announcement(now)
    user_id = ObjectId()
    receipts = ReceiptCollection()
    fake_db = SimpleNamespace(
        announcements=AnnouncementCollection([item]),
        announcement_receipts=receipts,
    )
    monkeypatch.setattr(server, "db", fake_db)

    first = asyncio.run(server.active_announcements(
        user={"_id": user_id, "role": "student"}
    ))
    assert first["unread_count"] == 1
    assert first["modal"]["id"] == str(item["_id"])
    assert receipts.updates[0][2] is True

    receipts.rows.append({
        "user_id": user_id,
        "announcement_id": item["_id"],
        "delivered_at": now,
        "seen_at": now,
    })
    second = asyncio.run(server.active_announcements(
        user={"_id": user_id, "role": "student"}
    ))
    assert second["unread_count"] == 0
    assert second["modal"] is None
    assert second["items"][0]["seen"] is True


def test_admin_student_serializer_exposes_balance_lifetime_and_tier():
    serialized = server.serialize_admin_user({
        "_id": ObjectId(),
        "email": "student@example.com",
        "savvy_points_balance": 1850,
        "savvy_points_lifetime": 3100,
    })
    assert serialized["savvy_points_balance"] == 1850
    assert serialized["savvy_points_lifetime"] == 3100
    assert serialized["savvy_tier"] == "Savvy Insider"
