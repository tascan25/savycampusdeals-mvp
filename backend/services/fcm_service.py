"""Small, provider-specific Firebase Cloud Messaging HTTP v1 client.

The rest of the application talks in terms of notification deliveries.  This
module is deliberately the only place that knows about Google credentials or
FCM's response format, which keeps credentials server-side and makes the queue
worker straightforward to test.
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

import aiohttp
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"


class FcmConfigurationError(RuntimeError):
    """Raised when push was enabled without usable Firebase credentials."""


@dataclass
class FcmSendError(RuntimeError):
    message: str
    code: str = "unknown"
    transient: bool = False
    invalid_token: bool = False

    def __str__(self) -> str:
        return self.message


def build_fcm_payload(
    *,
    token: str,
    title: str,
    body: str,
    data: Mapping[str, str],
    channel_id: str,
    priority: str = "normal",
    image_url: str = "",
) -> dict:
    notification: dict[str, str] = {"title": title, "body": body}
    android_notification: dict[str, str] = {"channel_id": channel_id}
    if image_url:
        notification["image"] = image_url
        android_notification["image"] = image_url
    return {
        "message": {
            "token": token,
            "notification": notification,
            "data": {key: str(value) for key, value in data.items()},
            "android": {
                "priority": "HIGH" if priority == "high" else "NORMAL",
                "notification": android_notification,
            },
        }
    }


def fcm_error_from_response(response_status: int, result: object) -> FcmSendError:
    error = result.get("error") if isinstance(result, dict) else None
    status_code = str((error or {}).get("status", "unknown"))
    details = (error or {}).get("details", [])
    provider_code: Optional[str] = None
    for detail in details if isinstance(details, list) else []:
        if isinstance(detail, dict) and detail.get("errorCode"):
            provider_code = str(detail["errorCode"])
            break
    code = provider_code or status_code
    invalid_token = code in {"UNREGISTERED", "SENDER_ID_MISMATCH"}
    transient = response_status in {429, 500, 502, 503, 504} or code in {
        "INTERNAL",
        "QUOTA_EXCEEDED",
        "UNAVAILABLE",
    }
    message = str((error or {}).get("message", "FCM rejected the message"))
    return FcmSendError(
        message=message,
        code=code,
        transient=transient,
        invalid_token=invalid_token,
    )


class FcmSender:
    """Lazy FCM v1 sender suitable for reuse by a long-running worker."""

    def __init__(
        self,
        *,
        project_id: str = "",
        service_account_json: str = "",
        service_account_file: str = "",
        timeout_seconds: float = 15.0,
    ):
        self._configured_project_id = project_id.strip()
        self._service_account_json = service_account_json.strip()
        self._service_account_file = service_account_file.strip()
        self._timeout_seconds = timeout_seconds
        self._credentials = None
        self._project_id = ""
        self._credential_lock = asyncio.Lock()

    @classmethod
    def from_environment(cls) -> "FcmSender":
        return cls(
            project_id=os.environ.get("FCM_PROJECT_ID", ""),
            service_account_json=os.environ.get("FCM_SERVICE_ACCOUNT_JSON", ""),
            service_account_file=os.environ.get("FCM_SERVICE_ACCOUNT_FILE", ""),
            timeout_seconds=float(os.environ.get("FCM_TIMEOUT_SECONDS", "15")),
        )

    @property
    def configured(self) -> bool:
        if not (
            (self._service_account_json or self._service_account_file)
            and self._configured_project_id
        ):
            return False
        try:
            self._load_credentials()
        except (FcmConfigurationError, ValueError):
            return False
        return True

    def _load_credentials(self):
        if self._credentials is not None:
            return
        if self._service_account_json:
            try:
                info = json.loads(self._service_account_json)
            except json.JSONDecodeError as exc:
                raise FcmConfigurationError(
                    "FCM_SERVICE_ACCOUNT_JSON is not valid JSON"
                ) from exc
            credentials = service_account.Credentials.from_service_account_info(
                info, scopes=[FCM_SCOPE]
            )
            discovered_project_id = str(info.get("project_id", ""))
        elif self._service_account_file:
            credentials_path = Path(self._service_account_file).expanduser()
            if not credentials_path.is_file():
                raise FcmConfigurationError("FCM_SERVICE_ACCOUNT_FILE does not exist")
            credentials = service_account.Credentials.from_service_account_file(
                str(credentials_path), scopes=[FCM_SCOPE]
            )
            discovered_project_id = str(getattr(credentials, "project_id", "") or "")
        else:
            raise FcmConfigurationError(
                "Firebase service-account credentials are missing"
            )

        project_id = self._configured_project_id or discovered_project_id
        if not project_id:
            raise FcmConfigurationError("FCM_PROJECT_ID is missing")
        if (
            self._configured_project_id
            and discovered_project_id
            and self._configured_project_id != discovered_project_id
        ):
            raise FcmConfigurationError(
                "FCM_PROJECT_ID does not match the service-account project"
            )
        self._credentials = credentials
        self._project_id = project_id

    async def _access_token(self) -> str:
        async with self._credential_lock:
            self._load_credentials()
            if not self._credentials.valid or self._credentials.expired:
                await asyncio.to_thread(self._credentials.refresh, GoogleAuthRequest())
            if not self._credentials.token:
                raise FcmConfigurationError(
                    "Firebase credentials did not produce an access token"
                )
            return str(self._credentials.token)

    async def send(
        self,
        *,
        token: str,
        title: str,
        body: str,
        data: Mapping[str, str],
        channel_id: str,
        priority: str = "normal",
        image_url: str = "",
    ) -> str:
        access_token = await self._access_token()
        payload = build_fcm_payload(
            token=token,
            title=title,
            body=body,
            data=data,
            channel_id=channel_id,
            priority=priority,
            image_url=image_url,
        )
        endpoint = (
            f"https://fcm.googleapis.com/v1/projects/{self._project_id}/messages:send"
        )
        timeout = aiohttp.ClientTimeout(total=self._timeout_seconds)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    endpoint,
                    json=payload,
                    headers={"Authorization": f"Bearer {access_token}"},
                ) as response:
                    result = await response.json(content_type=None)
                    if response.status < 300:
                        return str(result.get("name", ""))
                    raise fcm_error_from_response(response.status, result)
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            raise FcmSendError(
                message="Could not reach Firebase Cloud Messaging",
                code="network_error",
                transient=True,
            ) from exc
