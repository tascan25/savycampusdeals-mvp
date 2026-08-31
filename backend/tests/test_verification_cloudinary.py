"""Unit coverage for backward-compatible Cloudinary verification storage."""

import asyncio
import base64
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
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402
from services import cloudinary_service  # noqa: E402


def image_data_uri(kind="png", payload=None):
    signatures = {
        "png": b"\x89PNG\r\n\x1a\nunit-image",
        "jpeg": b"\xff\xd8\xffunit-image",
        "webp": b"RIFF\x04\x00\x00\x00WEBPunit-image",
    }
    raw = signatures[kind] if payload is None else payload
    return f"data:image/{kind};base64," + base64.b64encode(raw).decode()


class FakeVerifications:
    def __init__(self, *, insert_error=None):
        self.insert_error = insert_error
        self.inserted = None
        self.deleted = None

    async def find_one(self, *args, **kwargs):
        return None

    async def insert_one(self, document):
        if self.insert_error:
            raise self.insert_error
        self.inserted = dict(document)
        return SimpleNamespace(inserted_id=document["_id"])

    async def delete_one(self, query):
        self.deleted = query
        self.inserted = None
        return SimpleNamespace(deleted_count=1)


class FakeUsers:
    def __init__(self, user, *, update_error=None):
        self.user = dict(user)
        self.update_error = update_error
        self.updated = False

    async def update_one(self, query, update):
        if self.update_error:
            raise self.update_error
        self.user.update(update.get("$set", {}))
        for key, value in update.get("$inc", {}).items():
            self.user[key] = self.user.get(key, 0) + value
        for key, value in update.get("$addToSet", {}).items():
            if value not in self.user.setdefault(key, []):
                self.user[key].append(value)
        self.updated = True
        return SimpleNamespace(matched_count=1)

    async def find_one(self, query):
        return self.user


class FakePoints:
    async def insert_one(self, document):
        return SimpleNamespace(inserted_id=ObjectId())

    async def update_one(self, query, update):
        return SimpleNamespace(matched_count=1)


class FakeReferrals:
    async def find_one(self, query):
        return None


def manual_user():
    return {
        "_id": ObjectId(),
        "email": "student@example.com",
        "name": "Unit Student",
        "role": "student",
        "email_verified": True,
        "verification_status": "not_submitted",
        "created_at": None,
    }


def submission(**overrides):
    values = {
        "college_id_image": image_data_uri(),
        "selfie_image": image_data_uri("jpeg"),
        "college_name": "Unit College",
        "course": "B.Tech",
        "year": "3",
        "student_id_number": f"UNIT-{ObjectId()}",
    }
    values.update(overrides)
    return server.VerificationSubmitIn(**values)


def install_fake_db(monkeypatch, user, *, insert_error=None, update_error=None):
    verifications = FakeVerifications(insert_error=insert_error)
    users = FakeUsers(user, update_error=update_error)
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            verifications=verifications,
            users=users,
            savvy_points_transactions=FakePoints(),
            referrals=FakeReferrals(),
        ),
    )
    monkeypatch.setattr(server, "send_email", lambda *args, **kwargs: None)
    return verifications, users


def test_validation_rejects_malformed_unsupported_and_mismatched_images():
    with pytest.raises(cloudinary_service.InvalidVerificationImage):
        cloudinary_service.validate_verification_image(
            "data:image/png;base64,not-valid!"
        )
    with pytest.raises(cloudinary_service.InvalidVerificationImage):
        cloudinary_service.validate_verification_image("data:image/gif;base64,R0lGODlh")
    with pytest.raises(cloudinary_service.InvalidVerificationImage):
        cloudinary_service.validate_verification_image(
            image_data_uri("png", b"\xff\xd8\xffjpeg")
        )


def test_validation_rejects_oversized_image(monkeypatch):
    monkeypatch.setattr(cloudinary_service, "MAX_VERIFICATION_IMAGE_BYTES", 8)
    with pytest.raises(
        cloudinary_service.InvalidVerificationImage,
        match="5 MB or smaller",
    ):
        cloudinary_service.validate_verification_image(image_data_uri())


def test_upload_returns_only_secure_url_and_public_id(monkeypatch):
    monkeypatch.setattr(cloudinary_service, "configure_cloudinary", lambda: None)
    monkeypatch.setattr(
        cloudinary_service.cloudinary.uploader,
        "upload",
        lambda *args, **kwargs: {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/id.png",
            "public_id": kwargs["public_id"],
            "ignored": "raw-provider-response",
        },
    )

    result = cloudinary_service.upload_verification_image(
        image_data_uri(),
        asset_type="college-id",
        user_identifier=str(ObjectId()),
    )

    assert result["secure_url"].startswith("https://res.cloudinary.com/")
    assert result["public_id"].startswith("savycampusdeals/verification/")
    assert set(result) == {"secure_url", "public_id"}


def test_delete_user_verification_prefix_removes_every_page(monkeypatch):
    monkeypatch.setattr(cloudinary_service, "configure_cloudinary", lambda: None)
    calls = []
    responses = iter([{"next_cursor": "page-2"}, {"deleted": {"asset": "deleted"}}])
    monkeypatch.setattr(
        cloudinary_service.cloudinary.api,
        "delete_resources_by_prefix",
        lambda prefix, **options: calls.append((prefix, options)) or next(responses),
    )
    deleted_folders = []
    monkeypatch.setattr(
        cloudinary_service.cloudinary.api,
        "delete_folder",
        lambda folder: deleted_folders.append(folder),
    )

    assert cloudinary_service.delete_verification_images_for_user("user-123") is True
    assert calls[0][0] == "savycampusdeals/verification/user-123/"
    assert "next_cursor" not in calls[0][1]
    assert calls[1][1]["next_cursor"] == "page-2"
    assert deleted_folders == ["savycampusdeals/verification/user-123"]


def test_new_manual_submission_stores_urls_and_public_ids(monkeypatch):
    user = manual_user()
    verifications, users = install_fake_db(monkeypatch, user)
    uploads = iter(
        [
            {
                "secure_url": "https://res.cloudinary.com/demo/college.png",
                "public_id": "verification/college",
            },
            {
                "secure_url": "https://res.cloudinary.com/demo/selfie.jpg",
                "public_id": "verification/selfie",
            },
        ]
    )
    monkeypatch.setattr(
        server, "upload_verification_image", lambda *a, **k: next(uploads)
    )

    result = asyncio.run(server.submit_verification(submission(), user=user))

    assert result["verification_method"] == "document_review"
    assert users.updated is True
    assert verifications.inserted["college_id_image"].startswith("https://")
    assert verifications.inserted["selfie_image"].startswith("https://")
    assert (
        verifications.inserted["college_id_image_public_id"] == "verification/college"
    )
    assert verifications.inserted["selfie_image_public_id"] == "verification/selfie"


def test_old_and_new_admin_image_values_serialize_unchanged():
    for image_value in (
        image_data_uri(),
        "https://res.cloudinary.com/demo/image/upload/id.png",
    ):
        result = server.serialize_admin_verification(
            {
                "_id": ObjectId(),
                "user_id": ObjectId(),
                "college_id_image": image_value,
                "selfie_image": image_value,
            },
            include_images=True,
        )
        assert result["college_id_image"] == image_value
        assert result["selfie_image"] == image_value
        assert result["selfie_with_id"] == image_value


def test_second_upload_failure_cleans_first_and_skips_database(monkeypatch):
    user = manual_user()
    verifications, users = install_fake_db(monkeypatch, user)
    calls = {"uploads": 0, "deleted": []}

    def upload(*args, **kwargs):
        calls["uploads"] += 1
        if calls["uploads"] == 2:
            raise cloudinary_service.CloudinaryUploadError("provider unavailable")
        return {
            "secure_url": "https://res.cloudinary.com/demo/college.png",
            "public_id": "verification/college",
        }

    monkeypatch.setattr(server, "upload_verification_image", upload)
    monkeypatch.setattr(
        server,
        "delete_verification_image",
        lambda public_id: calls["deleted"].append(public_id),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.submit_verification(submission(), user=user))

    assert exc.value.status_code == 503
    assert calls["deleted"] == ["verification/college"]
    assert verifications.inserted is None
    assert users.updated is False


def test_database_failure_cleans_both_uploads(monkeypatch):
    user = manual_user()
    verifications, _ = install_fake_db(
        monkeypatch,
        user,
        insert_error=RuntimeError("database unavailable"),
    )
    uploaded_public_ids = []
    upload_number = {"value": 0}

    def upload(*args, **kwargs):
        upload_number["value"] += 1
        public_id = f"verification/{upload_number['value']}"
        return {
            "secure_url": f"https://res.cloudinary.com/demo/{upload_number['value']}.png",
            "public_id": public_id,
        }

    monkeypatch.setattr(server, "upload_verification_image", upload)
    monkeypatch.setattr(
        server,
        "delete_verification_image",
        lambda public_id: uploaded_public_ids.append(public_id),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.submit_verification(submission(), user=user))

    assert exc.value.status_code == 503
    assert set(uploaded_public_ids) == {"verification/1", "verification/2"}
    assert verifications.inserted is None


def test_user_update_failure_rolls_back_document_and_both_uploads(monkeypatch):
    user = manual_user()
    verifications, _ = install_fake_db(
        monkeypatch,
        user,
        update_error=RuntimeError("database unavailable"),
    )
    deleted_public_ids = []
    upload_number = {"value": 0}

    def upload(*args, **kwargs):
        upload_number["value"] += 1
        return {
            "secure_url": f"https://res.cloudinary.com/demo/{upload_number['value']}.png",
            "public_id": f"verification/{upload_number['value']}",
        }

    monkeypatch.setattr(server, "upload_verification_image", upload)
    monkeypatch.setattr(
        server,
        "delete_verification_image",
        lambda public_id: deleted_public_ids.append(public_id) or True,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.submit_verification(submission(), user=user))

    assert exc.value.status_code == 503
    assert verifications.deleted is not None
    assert verifications.inserted is None
    assert set(deleted_public_ids) == {"verification/1", "verification/2"}


def test_trusted_college_email_flow_does_not_upload(monkeypatch):
    user = manual_user()
    user["email"] = "student@iitd.ac.in"
    verifications, users = install_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        server,
        "upload_verification_image",
        lambda *a, **k: pytest.fail("trusted email flow must not upload images"),
    )

    result = asyncio.run(
        server.submit_verification(
            submission(college_id_image="", selfie_image=""),
            user=user,
        )
    )

    assert result["verification_method"] == "college_email"
    assert users.user["verification_status"] == "approved"
    assert verifications.inserted["college_id_image"] == ""
    assert "college_id_image_public_id" not in verifications.inserted


def test_pending_submission_retry_is_idempotent(monkeypatch):
    user = manual_user()
    user["verification_status"] = "pending"
    existing = {
        "_id": ObjectId(),
        "user_id": user["_id"],
        "student_id_number": "UNIT-PENDING",
        "student_id_normalized": "UNIT-PENDING",
        "method": "document_review",
        "status": "pending",
    }

    class ExistingVerification:
        async def find_one(self, *args, **kwargs):
            return existing

    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(verifications=ExistingVerification()),
    )
    monkeypatch.setattr(
        server,
        "upload_verification_image",
        lambda *a, **k: pytest.fail("a pending retry must not upload again"),
    )

    result = asyncio.run(
        server.submit_verification(
            submission(student_id_number="UNIT-PENDING"),
            user=user,
        )
    )

    assert result["ok"] is True
    assert result["already_submitted"] is True
    assert result["user"]["verification_status"] == "pending"


def test_missing_cloudinary_configuration_is_controlled(monkeypatch):
    user = manual_user()
    verifications, _ = install_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        server,
        "upload_verification_image",
        lambda *a, **k: (_ for _ in ()).throw(
            RuntimeError("Missing Cloudinary environment variables")
        ),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.submit_verification(submission(), user=user))

    assert exc.value.status_code == 503
    assert "CLOUDINARY" not in exc.value.detail
    assert verifications.inserted is None
