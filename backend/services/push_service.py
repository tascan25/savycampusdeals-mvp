"""Provider-neutral errors shared by Android FCM and the future iOS APNs sender."""

from dataclasses import dataclass


class PushConfigurationError(RuntimeError):
    """Raised when the selected platform provider has no usable credentials."""


@dataclass
class PushSendError(RuntimeError):
    message: str
    code: str = "unknown"
    transient: bool = False
    invalid_token: bool = False

    def __str__(self) -> str:
        return self.message
