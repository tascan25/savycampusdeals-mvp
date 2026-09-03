"""Focused unit coverage for the push-notification safety boundaries."""

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
os.environ["DB_NAME"] = "savycampusdeals_push_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402
from services.fcm_service import (  # noqa: E402
    FcmSender,
    build_fcm_payload,
    fcm_error_from_response,
)


class RecordingDeviceTokens:
    def __init__(self):
        self.delete_many_calls = []
        self.update_many_calls = []
        self.update_one_calls = []

    async def delete_many(self, query):
        self.delete_many_calls.append(query)
        return SimpleNamespace(deleted_count=0)

    async def update_many(self, query, update):
        self.update_many_calls.append((query, update))
        return SimpleNamespace(modified_count=0)

    async def update_one(self, query, update, upsert=False):
        self.update_one_calls.append((query, update, upsert))
        return SimpleNamespace(modified_count=1)


class RecordingCampaigns:
    def __init__(self):
        self.document = None
        self.update_one_calls = []

    async def update_one(self, query, update, upsert=False):
        self.update_one_calls.append((query, update, upsert))
        if self.document is None:
            self.document = dict(update["$setOnInsert"])
            return SimpleNamespace(upserted_id=self.document["_id"])
        return SimpleNamespace(upserted_id=None)

    async def find_one(self, query, projection=None):
        return self.document


class RecordingDeviceCursor:
    def __init__(self, documents):
        self.documents = documents
        self.query = None

    def find(self, query):
        self.query = query
        return self

    async def to_list(self, _length):
        return self.documents


def test_push_campaign_validation_keeps_only_safe_destinations():
    payload = server._validated_push_campaign_payload(
        server.AdminPushCampaignIn(
            title="  Campus deal  ",
            message="  Ends tonight  ",
            cta_url="/offers/abc",
            image_url="https://cdn.example.com/deal.png",
        )
    )
    assert payload["title"] == "Campus deal"
    assert payload["message"] == "Ends tonight"
    assert payload["channel"] == "deals"
    assert payload["scheduled_at"] is None

    with pytest.raises(HTTPException) as exc:
        server._validated_push_campaign_payload(
            server.AdminPushCampaignIn(
                title="Unsafe destination",
                message="This must not launch an arbitrary scheme",
                cta_url="javascript:alert(1)",
            )
        )
    assert exc.value.status_code == 400


def test_register_device_reassigns_token_without_exposing_credentials(monkeypatch):
    devices = RecordingDeviceTokens()
    monkeypatch.setattr(server, "db", SimpleNamespace(device_tokens=devices))
    monkeypatch.setattr(server, "PUSH_ENV", "staging")
    user = {"_id": ObjectId(), "role": "student"}
    result = asyncio.run(
        server.register_push_device(
            server.PushDeviceIn(
                token="fcm-token-that-is-long-enough-for-validation",
                installation_id="install_12345678",
                platform="android",
                app_version="0.1.0",
            ),
            user=user,
        )
    )
    assert result == {"ok": True, "environment": "staging"}
    _, update, upsert = devices.update_one_calls[0]
    assert upsert is True
    assert update["$set"]["user_id"] == user["_id"]
    assert update["$set"]["environment"] == "staging"
    assert "password" not in str(update).lower()


def test_unregister_device_physically_deletes_only_the_current_users_installation(monkeypatch):
    devices = RecordingDeviceTokens()
    monkeypatch.setattr(server, "db", SimpleNamespace(device_tokens=devices))
    monkeypatch.setattr(server, "PUSH_ENV", "production")
    user = {"_id": ObjectId(), "role": "student"}

    result = asyncio.run(
        server.unregister_push_device("install_12345678", user=user)
    )

    assert result == {"ok": True}
    assert devices.delete_many_calls == [
        {
            "user_id": user["_id"],
            "installation_id": "install_12345678",
            "environment": "production",
        }
    ]


def test_send_is_locked_when_push_is_not_explicitly_enabled(monkeypatch):
    monkeypatch.setattr(server, "PUSH_ENABLED", False)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            server.admin_queue_push_campaign(
                str(ObjectId()),
                server.AdminPushCampaignLaunchIn(
                    recipient_count=0, confirmation="SEND"
                ),
                admin={"_id": ObjectId()},
            )
        )
    assert exc.value.status_code == 503


def test_fcm_sender_rejects_missing_or_malformed_private_configuration():
    assert FcmSender(project_id="", service_account_json="").configured is False
    assert (
        FcmSender(
            project_id="savvy-production",
            service_account_json='{"project_id":"savvy-production"}',
        ).configured
        is False
    )


def test_push_campaign_serialization_uses_accepted_not_delivered_language():
    campaign = {
        "_id": ObjectId(),
        "title": "Hello",
        "message": "World",
        "status": "completed",
        "created_at": datetime.now(timezone.utc),
        "stats": {"devices": 5, "accepted": 4, "failed": 1, "opened": 2},
    }
    serialized = server.serialize_push_campaign(campaign)
    assert serialized["stats"] == {
        "devices": 5,
        "pending": 0,
        "accepted": 4,
        "failed": 1,
        "opened": 2,
    }
    assert "delivered" not in serialized["stats"]


def test_fcm_payload_and_provider_errors_are_classified_for_worker_safety():
    payload = build_fcm_payload(
        token="device-token",
        title="Hello",
        body="A campus update",
        data={"delivery_id": "123", "attempt": 2},
        channel_id="deals",
        priority="high",
    )
    assert payload["message"]["android"]["priority"] == "HIGH"
    assert payload["message"]["data"] == {"delivery_id": "123", "attempt": "2"}

    unregistered = fcm_error_from_response(
        404,
        {
            "error": {
                "status": "NOT_FOUND",
                "message": "Requested entity was not found.",
                "details": [{"errorCode": "UNREGISTERED"}],
            }
        },
    )
    assert unregistered.invalid_token is True
    assert unregistered.transient is False

    unavailable = fcm_error_from_response(
        503, {"error": {"status": "UNAVAILABLE", "message": "Try later"}}
    )
    assert unavailable.transient is True
    assert unavailable.invalid_token is False


def test_transactional_push_is_idempotent_and_contains_no_sensitive_values(monkeypatch):
    campaigns = RecordingCampaigns()
    monkeypatch.setattr(server, "db", SimpleNamespace(push_campaigns=campaigns))
    monkeypatch.setattr(server, "PUSH_ENABLED", True)
    monkeypatch.setattr(server, "PUSH_ENV", "production")
    user_id = ObjectId()

    first = asyncio.run(
        server.queue_transactional_push(
            user_id=user_id,
            event_key="coupon_redeemed:coupon-123",
            event_type="coupon_redeemed",
            title="Coupon redeemed successfully",
            message="Your partner deal was redeemed. Your Savvy Points are updated.",
            cta_url="/wallet",
        )
    )
    second = asyncio.run(
        server.queue_transactional_push(
            user_id=user_id,
            event_key="coupon_redeemed:coupon-123",
            event_type="coupon_redeemed",
            title="Coupon redeemed successfully",
            message="Your partner deal was redeemed. Your Savvy Points are updated.",
            cta_url="/wallet",
        )
    )

    assert first == second == campaigns.document["_id"]
    assert campaigns.document["target_user_id"] == user_id
    assert campaigns.document["kind"] == "transactional"
    assert campaigns.document["environment"] == "production"
    serialized = str(campaigns.document).lower()
    assert "coupon_code" not in serialized
    assert "qr_data" not in serialized
    assert "reset_token" not in serialized


def test_targeted_device_lookup_selects_all_active_android_installations(monkeypatch):
    user_id = ObjectId()
    devices = RecordingDeviceCursor(
        [
            {"token": "phone-token", "user_id": user_id},
            {"token": "tablet-token", "user_id": user_id},
            {"token": "phone-token", "user_id": user_id},
        ]
    )
    monkeypatch.setattr(server, "db", SimpleNamespace(device_tokens=devices))
    monkeypatch.setattr(server, "PUSH_ENV", "production")

    eligible = asyncio.run(server._eligible_push_devices(user_ids=[user_id]))

    assert {item["token"] for item in eligible} == {"phone-token", "tablet-token"}
    stale_filter = devices.query.pop("last_seen_at")
    assert devices.query == {
        "user_id": {"$in": [user_id]},
        "environment": "production",
        "platform": {"$in": ["android"]},
        "active": True,
    }
    assert stale_filter["$gte"] <= datetime.now(timezone.utc)
    assert stale_filter["$gte"] > datetime.now(timezone.utc) - timedelta(
        days=server.PUSH_TOKEN_STALE_DAYS + 1
    )


def test_stale_device_cleanup_deletes_only_expired_environment_tokens(monkeypatch):
    devices = RecordingDeviceTokens()

    async def delete_many(query):
        devices.delete_many_calls.append(query)
        return SimpleNamespace(deleted_count=1)

    devices.delete_many = delete_many
    monkeypatch.setattr(server, "db", SimpleNamespace(device_tokens=devices))
    monkeypatch.setattr(server, "PUSH_ENV", "production")
    monkeypatch.setattr(server, "_next_push_token_cleanup_at", None)

    changed = asyncio.run(server._prune_stale_push_devices(force=True))

    assert changed == 1
    query = devices.delete_many_calls[0]
    assert query["environment"] == "production"
    assert query["$or"][0]["last_seen_at"]["$lt"] < datetime.now(timezone.utc)
    assert query["$or"][1] == {"last_seen_at": {"$exists": False}}
    assert server._next_push_token_cleanup_at > datetime.now(timezone.utc)


def test_provider_boundary_keeps_transactional_payload_platform_neutral(monkeypatch):
    class RecordingSender:
        def __init__(self):
            self.payload = None

        async def send(self, **payload):
            self.payload = payload
            return "provider-message-id"

    sender = RecordingSender()
    monkeypatch.setattr(server, "_fcm_sender", sender)
    campaign_id = ObjectId()
    delivery_id = ObjectId()
    result = asyncio.run(
        server._send_push_delivery(
            {"platform": "android", "token": "device-token", "_id": delivery_id},
            {
                "_id": campaign_id,
                "kind": "transactional",
                "event_type": "verification_approved",
                "title": "Student verification approved",
                "message": "Your student account is verified.",
                "channel": "account",
                "priority": "high",
                "cta_url": "/profile",
            },
        )
    )

    assert result == "provider-message-id"
    assert sender.payload["data"] == {
        "kind": "transactional",
        "campaign_id": str(campaign_id),
        "delivery_id": str(delivery_id),
        "route": "/profile",
        "event_type": "verification_approved",
        "play_sound": "true",
    }
    with pytest.raises(server.PushSendError) as exc:
        asyncio.run(
            server._send_push_delivery(
                {"platform": "ios", "token": "apns-token", "_id": ObjectId()},
                {"_id": ObjectId(), "title": "Hello", "message": "World"},
            )
        )
    assert exc.value.code == "provider_not_configured"
