"""Focused unit coverage for the push-notification safety boundaries."""

import asyncio
import os
import sys
from datetime import datetime, timezone
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
        self.update_many_calls = []
        self.update_one_calls = []

    async def update_many(self, query, update):
        self.update_many_calls.append((query, update))
        return SimpleNamespace(modified_count=0)

    async def update_one(self, query, update, upsert=False):
        self.update_one_calls.append((query, update, upsert))
        return SimpleNamespace(modified_count=1)


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
