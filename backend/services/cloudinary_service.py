import base64
import binascii
import io
import os
import re
from uuid import uuid4

import cloudinary
import cloudinary.uploader

_configured = False
MAX_VERIFICATION_IMAGE_BYTES = 5 * 1024 * 1024
_DATA_URI_PATTERN = re.compile(
    r"^data:(image/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$",
    re.IGNORECASE,
)


class InvalidVerificationImage(ValueError):
    """The submitted value is not a supported, valid verification image."""


class CloudinaryUploadError(RuntimeError):
    """Cloudinary could not store a verification image."""


def configure_cloudinary() -> None:
    global _configured

    if _configured:
        return

    required_variables = (
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
    )

    missing_variables = [
        variable
        for variable in required_variables
        if not os.getenv(variable)
    ]

    if missing_variables:
        raise RuntimeError(
            "Missing Cloudinary environment variables: "
            + ", ".join(missing_variables)
        )

    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )

    _configured = True


def validate_verification_image(image_source: str) -> tuple[bytes, str]:
    if not isinstance(image_source, str) or not image_source:
        raise InvalidVerificationImage("A verification image is required.")

    match = _DATA_URI_PATTERN.fullmatch(image_source)
    if not match:
        raise InvalidVerificationImage(
            "Verification images must be JPEG, PNG, or WebP files."
        )

    mime_type = match.group(1).lower()
    if mime_type == "image/jpg":
        mime_type = "image/jpeg"

    encoded_data = match.group(2)
    max_encoded_length = 4 * ((MAX_VERIFICATION_IMAGE_BYTES + 2) // 3)
    if len(encoded_data) > max_encoded_length:
        raise InvalidVerificationImage(
            "Each verification image must be 5 MB or smaller."
        )

    try:
        image_bytes = base64.b64decode(encoded_data, validate=True)
    except (binascii.Error, ValueError):
        raise InvalidVerificationImage(
            "The verification image data is malformed."
        ) from None

    if not image_bytes:
        raise InvalidVerificationImage("A verification image is required.")
    if len(image_bytes) > MAX_VERIFICATION_IMAGE_BYTES:
        raise InvalidVerificationImage(
            "Each verification image must be 5 MB or smaller."
        )

    detected_type = _detect_image_type(image_bytes)
    if detected_type is None or detected_type != mime_type:
        raise InvalidVerificationImage(
            "The verification image content does not match its file type."
        )

    return image_bytes, mime_type


def _detect_image_type(image_bytes: bytes) -> str | None:
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if (
        len(image_bytes) >= 12
        and image_bytes.startswith(b"RIFF")
        and image_bytes[8:12] == b"WEBP"
    ):
        return "image/webp"
    return None


def upload_verification_image(
    image_source: str,
    *,
    asset_type: str,
    user_identifier: str,
) -> dict[str, str]:
    image_bytes, _ = validate_verification_image(image_source)
    safe_user_identifier = re.sub(r"[^A-Za-z0-9_-]", "", user_identifier)
    safe_asset_type = re.sub(r"[^A-Za-z0-9_-]", "", asset_type)
    if not safe_user_identifier or not safe_asset_type:
        raise CloudinaryUploadError("Verification image upload is unavailable.")

    configure_cloudinary()
    public_id = (
        "savycampusdeals/verification/"
        f"{safe_user_identifier}/{safe_asset_type}-{uuid4().hex}"
    )
    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(image_bytes),
            public_id=public_id,
            resource_type="image",
            overwrite=False,
            use_filename=False,
            unique_filename=False,
        )
    except Exception:
        # The provider may have accepted the asset before a response failed.
        delete_verification_image(public_id)
        raise CloudinaryUploadError(
            "Verification image upload is temporarily unavailable."
        ) from None

    secure_url = result.get("secure_url")
    uploaded_public_id = result.get("public_id")
    if (
        not isinstance(secure_url, str)
        or not secure_url.startswith("https://")
        or not isinstance(uploaded_public_id, str)
        or not uploaded_public_id
    ):
        delete_verification_image(
            uploaded_public_id
            if isinstance(uploaded_public_id, str)
            else public_id
        )
        raise CloudinaryUploadError(
            "Verification image upload is temporarily unavailable."
        )

    return {"secure_url": secure_url, "public_id": uploaded_public_id}


def delete_verification_image(public_id: str) -> bool:
    if not public_id:
        return True
    try:
        configure_cloudinary()
        cloudinary.uploader.destroy(
            public_id,
            resource_type="image",
            invalidate=True,
        )
    except Exception:
        return False
    return True
