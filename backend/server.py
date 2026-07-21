from dotenv import load_dotenv
from pathlib import Path
import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import base64
import secrets
import logging
import asyncio
import html
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from zoneinfo import ZoneInfo

import bcrypt
import jwt
import qrcode
import resend
from bson import ObjectId
from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Request,
    Response,
    Depends,
    UploadFile,
    File,
    Form,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from utils.json_loader import load_data

# -----------------------------
# Setup
# -----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("savycampusdeals")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
INDIA_TIMEZONE = ZoneInfo("Asia/Kolkata")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "onboarding@resend.dev")
# Keep this list deliberately explicit: a domain is trusted only when it appears
# here.  A non-consumer domain alone is never enough to bypass document review.
APPROVED_COLLEGE_DOMAINS = {
    domain.strip().lower()
    for domain in os.environ.get(
        "APPROVED_COLLEGE_DOMAINS", "iitd.ac.in,iitb.ac.in,vit.ac.in,amity.edu,kiet.edu,ipec.org.in"
    ).split(",")
    if domain.strip()
}

resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(
    MONGO_URL,
    tls=True,
    tlsCAFile=certifi.where(),
)
db = client[DB_NAME]

app = FastAPI(title="SavyCampusDeals API")
api = APIRouter(prefix="/api")


# -----------------------------
# Helpers
# -----------------------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_access_token(uid: str, email: str, role: str) -> str:
    return jwt.encode(
        {
            "sub": uid,
            "email": email,
            "role": role,
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
        },
        JWT_SECRET,
        algorithm=JWT_ALGO,
    )


def serialize_user(u: dict) -> dict:
    verification_status = u.get("verification_status", "not_submitted")
    # Legacy accounts used "unverified" before verification states were added.
    # Preserve their records while exposing the new public state to clients.
    if verification_status == "unverified":
        verification_status = "not_submitted"
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "student"),
        "college": u.get("college", ""),
        "course": u.get("course", ""),
        "year": u.get("year", ""),
        "phone": u.get("phone", ""),
        "avatar_url": u.get("avatar_url", ""),
        "email_verified": u.get("email_verified", False),
        "verification_status": verification_status,
        "verification_method": "college_email"
        if is_approved_college_email(u["email"])
        else "document_review",
        "student_number": u.get("student_number", ""),
        "verification_expiry": u.get("verification_expiry"),
        "reward_points": u.get("reward_points", 0),
        "referral_code": u.get("referral_code", ""),
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_verified_user(request: Request) -> dict:
    """Requires the user's email to be verified (or the user to be admin)."""
    user = await get_current_user(request)
    if user.get("role") != "admin" and not user.get("email_verified"):
        raise HTTPException(403, "Please verify your email before continuing.")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
        path="/",
    )


def _aware(dt):
    """Ensure datetime is tz-aware UTC (MongoDB returns naive BSON datetimes)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_redemption_policy(offer: dict) -> str:
    """Return the configured redemption policy with a legacy-safe fallback."""
    policy = offer.get("redemption_policy", "").strip().lower()
    if policy in {"daily", "monthly", "unlimited", "once"}:
        return policy
    # Existing partner offers predate the explicit policy field. Preserve their
    # stated once-per-day terms until they are next imported with the field.
    if "once per student per day" in offer.get("terms", "").lower():
        return "daily"
    return "new_offer"


def is_daily_outlet_offer(offer: dict) -> bool:
    return get_redemption_policy(offer) == "daily"


def india_day_bounds(now: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """UTC bounds for the current calendar day in the partners' local timezone."""
    local_now = (now or datetime.now(timezone.utc)).astimezone(INDIA_TIMEZONE)
    local_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        local_start.astimezone(timezone.utc),
        (local_start + timedelta(days=1)).astimezone(timezone.utc),
    )


def india_month_bounds(now: Optional[datetime] = None) -> tuple[datetime, datetime]:
    """UTC bounds for the current calendar month in India."""
    local_now = (now or datetime.now(timezone.utc)).astimezone(INDIA_TIMEZONE)
    local_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if local_start.month == 12:
        local_end = local_start.replace(year=local_start.year + 1, month=1)
    else:
        local_end = local_start.replace(month=local_start.month + 1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


DEV_OTP_FALLBACK = os.environ.get("DEV_OTP_FALLBACK", "true").lower() == "true"


def send_email(to: str, subject: str, html: str, attachments=None) -> dict:
    """Returns {ok: bool, error: str|None}."""
    if not RESEND_API_KEY:
        logger.warning(f"[Email skipped: no key] To={to}")
        return {"ok": False, "error": "no_api_key"}
    try:
        params = {
            "from": f"SavyCampusDeals <{FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if attachments:
            params["attachments"] = attachments
        resend.Emails.send(params)
        return {"ok": True, "error": None}
    except Exception as e:
        logger.error(f"Resend error: {e}")
        return {"ok": False, "error": str(e)}


def is_approved_college_email(email: str) -> bool:
    """Whether this email's exact domain is allowed to use the academic-only flow."""
    return email.rsplit("@", 1)[-1].lower() in APPROVED_COLLEGE_DOMAINS


def is_image_data_uri(value: Optional[str]) -> bool:
    """Accept the image data-URI format produced by the existing upload control."""
    return bool(
        value
        and value.startswith("data:image/")
        and ";base64," in value
        and len(value) <= 7 * 1024 * 1024
    )


def normalize_student_id(value: str) -> str:
    """Create a case- and whitespace-insensitive key for student IDs/roll numbers."""
    return re.sub(r"\s+", "", value).upper()


def verification_email_html(
    heading: str, body: str, cta_label: str = "Open SavyCampusDeals", cta_path: str = "/dashboard"
) -> str:
    href = f"{FRONTEND_URL.rstrip('/')}{cta_path}"
    return f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
    <h1 style="font-family:Outfit,Arial,sans-serif;font-weight:800">{heading}</h1>
    <p style="color:#d4d4dc;line-height:1.6">{body}</p>
    <a href="{href}" style="display:inline-block;margin-top:20px;background:#ffffff;color:#111111;border-radius:999px;padding:12px 20px;font-weight:700;text-decoration:none">{cta_label}</a>
    </div>"""


def generate_qr_data_uri(payload: str) -> str:
    qr = qrcode.QRCode(
        box_size=8, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


PASSWORD_RE = re.compile(r"^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$")


def validate_password(pw: str) -> None:
    if len(pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", pw):
        raise HTTPException(400, "Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", pw):
        raise HTTPException(400, "Password must include at least one digit.")
    if not re.search(r"[^A-Za-z0-9\s]", pw):
        raise HTTPException(
            400, "Password must include at least one special character."
        )
    if re.search(r"\s", pw):
        raise HTTPException(400, "Password must not contain spaces.")


def gen_ref_code(name: str) -> str:
    stub = "".join(c for c in name.upper() if c.isalpha())[:4] or "SAVY"
    return f"{stub}{secrets.token_hex(2).upper()}"


def gen_student_number() -> str:
    return f"SCD-{datetime.now().year}-{secrets.token_hex(3).upper()}"


# -----------------------------
# Models
# -----------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)
    college: Optional[str] = ""
    course: Optional[str] = ""
    year: Optional[str] = ""
    phone: Optional[str] = ""
    referral_code: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8)


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    course: Optional[str] = None
    year: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class VerificationSubmitIn(BaseModel):
    college_id_image: Optional[str] = ""  # base64 data URI (optional)
    selfie_image: Optional[str] = ""  # base64 data URI (optional)
    college_name: str = Field(min_length=1)
    course: str = Field(min_length=1)
    year: str = Field(min_length=1)
    student_id_number: str = Field(min_length=1)


class VerificationReviewIn(BaseModel):
    status: str
    reviewer_note: Optional[str] = ""


class AdminVerificationDecisionIn(BaseModel):
    verification_id: str = Field(min_length=24, max_length=24)
    rejection_reason: Optional[str] = Field(default="", max_length=1000)


class OtpVerifyIn(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class OtpResendIn(BaseModel):
    email: EmailStr


# -----------------------------
# Auth Routes
# -----------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    validate_password(body.password)
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")

    # Look up referrer if a code was provided
    ref_code_raw = (body.referral_code or "").strip().upper()
    referrer = None
    if ref_code_raw:
        referrer = await db.users.find_one({"referral_code": ref_code_raw})
        if not referrer:
            raise HTTPException(400, f"Referral code '{ref_code_raw}' is not valid.")

    now = datetime.now(timezone.utc)
    verify_token = secrets.token_urlsafe(24)
    welcome_points = 100
    referral_bonus = 100 if referrer else 0
    user_doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": "student",
        "college": body.college or "",
        "course": body.course or "",
        "year": body.year or "",
        "phone": body.phone or "",
        "avatar_url": "",
        "email_verified": False,
        "email_verify_token": verify_token,
        "verification_status": "not_submitted",
        "student_number": "",
        "verification_expiry": None,
        "reward_points": welcome_points + referral_bonus,
        "referral_code": gen_ref_code(body.name),
        "referred_by": ref_code_raw if referrer else "",
        "referrer_id": referrer["_id"] if referrer else None,
        "created_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # Reward the referrer + log the referral event
    if referrer:
        await db.users.update_one(
            {"_id": referrer["_id"]}, {"$inc": {"reward_points": 100}}
        )
        await db.referrals.insert_one(
            {
                "referrer_id": referrer["_id"],
                "referrer_email": referrer["email"],
                "referred_id": result.inserted_id,
                "referred_email": email,
                "points_awarded": 100,
                "created_at": now,
            }
        )
        # Bonus notification email (best-effort)
        send_email(
            referrer["email"],
            "You just earned 100 SavyPoints",
            f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
            <h1 style="font-family:Outfit,sans-serif;font-weight:800">+100 SavyPoints</h1>
            <p>{body.name.split(' ')[0]} just joined SavyCampusDeals using your code <b>{ref_code_raw}</b>. 100 points added to your account.</p>
            </div>""",
        )

    # Generate and send OTP (6-digit)
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.insert_one(
        {
            "user_id": result.inserted_id,
            "email": email,
            "otp": otp,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now,
        }
    )
    email_result = send_email(
        email,
        "Your SavyCampusDeals verification code",
        f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
        <h1 style="font-family:Outfit,sans-serif;font-weight:800">Welcome, {body.name}!</h1>
        <p style="color:#a1a1aa">Enter this 6-digit code on the site to verify your email — expires in 10 minutes.</p>
        <div style="margin:24px 0;padding:20px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.4);border-radius:16px;text-align:center">
          <div style="font-family:'JetBrains Mono',monospace;font-size:40px;letter-spacing:12px;font-weight:800;color:#a5b4fc">{otp}</div>
        </div>
        <p style="color:#71717A;font-size:12px">If you didn't create an account, ignore this email.</p>
        </div>""",
    )
    logger.info(f"OTP for {email}: {otp} (email delivery: {email_result['ok']})")

    token = create_access_token(str(result.inserted_id), email, "student")
    set_auth_cookie(response, token)
    resp = {
        "user": serialize_user(user_doc),
        "token": token,
        "email_sent": email_result["ok"],
    }
    if DEV_OTP_FALLBACK and not email_result["ok"]:
        resp["dev_otp"] = otp
        resp["email_error"] = email_result["error"]
    return resp


@api.post("/auth/send-otp")
async def send_otp(body: OtpResendIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "No account with that email")
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    # Throttle: reject if latest OTP < 60 s old
    latest = await db.otp_codes.find_one(
        {"user_id": user["_id"]}, sort=[("created_at", -1)]
    )
    now = datetime.now(timezone.utc)
    if latest and (now - _aware(latest["created_at"])).total_seconds() < 60:
        raise HTTPException(429, "Please wait a minute before requesting a new code")
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.insert_one(
        {
            "user_id": user["_id"],
            "email": email,
            "otp": otp,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now,
        }
    )
    email_result = send_email(
        email,
        "Your SavyCampusDeals verification code",
        f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
        <p>Your new verification code:</p>
        <div style="margin:16px 0;padding:20px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.4);border-radius:16px;text-align:center">
          <div style="font-family:monospace;font-size:40px;letter-spacing:12px;font-weight:800;color:#a5b4fc">{otp}</div>
        </div>
        <p style="color:#71717A;font-size:12px">Expires in 10 minutes.</p>
        </div>""",
    )
    logger.info(f"OTP resend for {email}: {otp} (email delivery: {email_result['ok']})")
    resp = {"ok": True, "email_sent": email_result["ok"]}
    if DEV_OTP_FALLBACK and not email_result["ok"]:
        resp["dev_otp"] = otp
        resp["email_error"] = email_result["error"]
    return resp


@api.post("/auth/verify-otp")
async def verify_otp(body: OtpVerifyIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "No account with that email")
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True, "user": serialize_user(user)}
    doc = await db.otp_codes.find_one(
        {"user_id": user["_id"], "otp": body.otp, "used": False},
        sort=[("created_at", -1)],
    )
    if not doc:
        raise HTTPException(400, "Invalid code")
    if _aware(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Code has expired. Request a new one.")
    await db.otp_codes.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"email_verified": True}})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return {"ok": True, "user": serialize_user(fresh)}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(str(user["_id"]), email, user.get("role", "student"))
    set_auth_cookie(response, token)
    return {"user": serialize_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return serialize_user(user)


@api.get("/auth/verify-email/{token}")
async def verify_email(token: str):
    user = await db.users.find_one({"email_verify_token": token})
    if not user:
        raise HTTPException(400, "Invalid or expired token")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"email_verified": True}, "$unset": {"email_verify_token": ""}},
    )
    return {"ok": True, "message": "Email verified"}


@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # always success (no user enumeration)
    if user:
        token = secrets.token_urlsafe(24)
        await db.password_resets.insert_one(
            {
                "user_id": user["_id"],
                "token": token,
                "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
                "used": False,
            }
        )
        link = f"{FRONTEND_URL}/reset-password/{token}"
        send_email(
            email,
            "Reset your SavyCampusDeals password",
            f"""
            <!doctype html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="color-scheme" content="dark">
                <meta name="supported-color-schemes" content="dark">
                <title>Reset Your Password</title>
              </head>
              <body style="margin:0; padding:0; width:100%; background-color:#05060a; color:#f7f8fb; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; margin:0; padding:0; background-color:#05060a;">
                  <tr>
                    <td align="center" style="padding:32px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:640px; border-collapse:separate;">
                        <tr>
                          <td style="padding:0 0 18px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td align="left" style="vertical-align:middle;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td align="center" style="width:42px; height:42px; border-radius:14px; background:#ffffff; color:#05060a; font-size:19px; line-height:42px; font-weight:800; text-align:center;">S</td>
                                      <td style="padding-left:12px; color:#ffffff; font-size:17px; line-height:24px; font-weight:700; letter-spacing:0;">SavyCampusDeals</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background-color:#0d0f17; border:1px solid #242837; border-radius:24px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,0.42);">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding:1px; background:linear-gradient(135deg, rgba(255,255,255,0.36), rgba(118,140,255,0.24), rgba(31,35,48,0));">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0d0f17; border-radius:23px;">
                                    <tr>
                                      <td style="padding:44px 40px 18px 40px;">
                                        <div style="display:inline-block; padding:7px 11px; border:1px solid #2b3144; border-radius:999px; background-color:#151925; color:#aab3c7; font-size:12px; line-height:16px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;">Secure account action</div>
                                        <h1 style="margin:20px 0 0 0; color:#ffffff; font-size:34px; line-height:40px; font-weight:750; letter-spacing:0;">Reset Your Password</h1>
                                        <p style="margin:16px 0 0 0; color:#c8cedb; font-size:16px; line-height:26px; font-weight:400;">We received a request to reset the password for your SavyCampusDeals account. Use the button below to choose a new password and get back to discovering student deals.</p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td align="left" style="padding:18px 40px 28px 40px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                          <tr>
                                            <td align="center" style="border-radius:14px; background:#ffffff; box-shadow:0 14px 30px rgba(255,255,255,0.12);">
                                              <a href="{link}" style="display:inline-block; padding:15px 24px; color:#07080c; font-size:15px; line-height:20px; font-weight:750; text-decoration:none; border-radius:14px;">Reset Password</a>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding:0 40px 30px 40px;">
                                        <p style="margin:0 0 10px 0; color:#8d96aa; font-size:13px; line-height:20px;">If the button does not work, copy and paste this link into your browser:</p>
                                        <p style="margin:0; padding:14px 16px; background-color:#080a10; border:1px solid #22283a; border-radius:14px; color:#aeb7c9; font-size:13px; line-height:20px; word-break:break-all;">
                                          <a href="{link}" style="color:#d9e1ff; text-decoration:underline; word-break:break-all;">{link}</a>
                                        </p>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="padding:0 40px 40px 40px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#121722; border:1px solid #293247; border-radius:18px;">
                                          <tr>
                                            <td style="padding:18px 18px 18px 18px;">
                                              <p style="margin:0 0 8px 0; color:#ffffff; font-size:14px; line-height:20px; font-weight:700;">A quick security note</p>
                                              <p style="margin:0; color:#aeb7c9; font-size:14px; line-height:22px;">This link expires in 1 hour. If you did not request this password reset, you can safely ignore this email.</p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:24px 12px 0 12px;">
                            <p style="margin:0; color:#8f98aa; font-size:13px; line-height:20px; font-weight:700;">SavyCampusDeals</p>
                            <p style="margin:6px 0 0 0; color:#6f788a; font-size:12px; line-height:19px;">Support: <a href="mailto:{FROM_EMAIL}" style="color:#aeb7c9; text-decoration:none;">{FROM_EMAIL}</a></p>
                            <p style="margin:6px 0 0 0; color:#596173; font-size:12px; line-height:19px;">&copy; {datetime.now().year} SavyCampusDeals. All rights reserved.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """,
        )
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset(body: ResetIn):
    validate_password(body.password)
    doc = await db.password_resets.find_one({"token": body.token, "used": False})
    if not doc or _aware(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired token")
    await db.users.update_one(
        {"_id": doc["user_id"]},
        {"$set": {"password_hash": hash_password(body.password)}},
    )
    await db.password_resets.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


# -----------------------------
# Profile
# -----------------------------
@api.patch("/profile")
async def update_profile(body: ProfileUpdateIn, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(fresh)


# -----------------------------
# Verification
# -----------------------------
@api.post("/verification/submit")
async def submit_verification(
    body: VerificationSubmitIn, user=Depends(get_verified_user)
):
    if user.get("verification_status") == "approved":
        raise HTTPException(400, "Already verified")
    if not body.student_id_number.strip():
        raise HTTPException(400, "Student ID / Roll Number is required")

    student_id_number = body.student_id_number.strip()
    student_id_normalized = normalize_student_id(student_id_number)
    # Match legacy submissions too, which predate the normalized key. The
    # database index below then makes this race-safe for every new submission.
    legacy_pattern = "^" + r"\s*".join(re.escape(char) for char in student_id_normalized) + "$"
    existing_id = await db.verifications.find_one(
        {
            "$or": [
                {"student_id_normalized": student_id_normalized},
                {"student_id_number": {"$regex": legacy_pattern, "$options": "i"}},
            ]
        },
        {"_id": 1},
    )
    if existing_id:
        raise HTTPException(
            409,
            "This Student ID / Roll Number has already been used for verification.",
        )

    trusted_email = is_approved_college_email(user["email"])
    if not trusted_email and (
        not is_image_data_uri(body.college_id_image)
        or not is_image_data_uri(body.selfie_image)
    ):
        raise HTTPException(
            400,
            "Upload valid college ID card and selfie images for manual review.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user["_id"],
        "college_id_image": body.college_id_image,
        "selfie_image": body.selfie_image,
        "college_name": body.college_name,
        "course": body.course,
        "year": body.year,
        "student_id_number": student_id_number,
        "student_id_normalized": student_id_normalized,
        "method": "college_email" if trusted_email else "document_review",
        "status": "approved" if trusted_email else "pending",
        "submitted_at": now,
        "reviewed_at": now if trusted_email else None,
        "reviewer_note": "Auto-approved via approved college email domain" if trusted_email else "",
    }
    try:
        await db.verifications.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            409,
            "This Student ID / Roll Number has already been used for verification.",
        )

    user_updates = {
        "verification_status": "approved" if trusted_email else "pending",
        "verification_submitted_at": now,
        "college": body.college_name,
        "course": body.course,
        "year": body.year,
    }
    update: dict = {"$set": user_updates}
    if trusted_email:
        user_updates.update({
            "student_number": user.get("student_number") or gen_student_number(),
            "verification_expiry": now + timedelta(days=365),
        })
        update["$inc"] = {"reward_points": 200}
    await db.users.update_one({"_id": user["_id"]}, update)

    if not trusted_email:
        send_email(
            user["email"],
            "Student Verification Submitted",
            verification_email_html(
                "Your verification is under review",
                "We received your college ID, selfie, and academic details. Our team will review them and email you once a decision is made.",
                "Check verification status",
                "/dashboard",
            ),
        )

    fresh = await db.users.find_one({"_id": user["_id"]})
    return {
        "ok": True,
        "verification_method": "college_email" if trusted_email else "document_review",
        "user": serialize_user(fresh),
    }


async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


@api.get("/admin/verifications")
async def list_verifications(status: Optional[str] = None, admin=Depends(get_admin_user)):
    query = {"status": status} if status else {}
    docs = await db.verifications.find(query).sort("submitted_at", -1).to_list(200)
    result = []
    for doc in docs:
        student = await db.users.find_one({"_id": doc["user_id"]})
        result.append({
            "id": str(doc["_id"]),
            "status": doc.get("status", "pending"),
            "method": doc.get("method", "document_review"),
            "college_name": doc.get("college_name", ""),
            "course": doc.get("course", ""),
            "year": doc.get("year", ""),
            "student_id_number": doc.get("student_id_number", ""),
            "college_id_image": doc.get("college_id_image", ""),
            "selfie_image": doc.get("selfie_image", ""),
            "student_email": student.get("email", "") if student else "",
            "student_name": student.get("name", "") if student else "",
            "submitted_at": doc.get("submitted_at"),
            "reviewer_note": doc.get("reviewer_note", ""),
        })
    return result


@api.patch("/admin/verifications/{verification_id}")
async def review_verification(
    verification_id: str, body: VerificationReviewIn, admin=Depends(get_admin_user)
):
    if body.status not in {"approved", "rejected"}:
        raise HTTPException(400, "Verification status must be approved or rejected")
    try:
        verification_oid = ObjectId(verification_id)
    except Exception:
        raise HTTPException(404, "Verification not found")
    verification = await db.verifications.find_one({"_id": verification_oid})
    if not verification:
        raise HTTPException(404, "Verification not found")
    student = await db.users.find_one({"_id": verification["user_id"]})
    if not student:
        raise HTTPException(404, "Student not found")

    now = datetime.now(timezone.utc)
    await db.verifications.update_one(
        {"_id": verification_oid},
        {"$set": {
            "status": body.status,
            "reviewed_at": now,
            "reviewer_note": body.reviewer_note or "",
            "reviewed_by": admin["_id"],
        }},
    )
    user_updates = {"verification_status": body.status}
    update: dict = {"$set": user_updates}
    if body.status == "approved":
        user_updates.update({
            "student_number": student.get("student_number") or gen_student_number(),
            "verification_expiry": now + timedelta(days=365),
        })
        if student.get("verification_status") != "approved":
            update["$inc"] = {"reward_points": 200}
    await db.users.update_one({"_id": student["_id"]}, update)

    if verification.get("status") != body.status:
        if body.status == "approved":
            send_email(
                student["email"],
                "You're now a verified student!",
                verification_email_html(
                    "You're verified!",
                    "Your verification was successful. Your student account is now verified and eligible for student discounts.",
                    "View your student card",
                    "/card",
                ),
            )
        else:
            send_email(
                student["email"],
                "Additional Information Required",
                verification_email_html(
                    "Additional information required",
                    "We could not complete your verification. Please upload clearer, valid college ID and selfie documents, then submit your verification again.",
                    "Resubmit verification",
                    "/verify",
                ),
            )
    fresh = await db.users.find_one({"_id": student["_id"]})
    return {"ok": True, "user": serialize_user(fresh)}


def _admin_datetime(value):
    return value.isoformat() if value else None


def serialize_admin_user(user: dict) -> dict:
    """A deliberately limited user representation for the admin list endpoints."""
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "college": user.get("college", ""),
        "course": user.get("course", ""),
        "year": user.get("year", ""),
        "verification_status": user.get("verification_status", "not_submitted"),
        "verification_submitted_at": _admin_datetime(user.get("verification_submitted_at")),
        "verification_reviewed_at": _admin_datetime(user.get("verification_reviewed_at")),
        "verification_rejection_reason": user.get("verification_rejection_reason", ""),
        "created_at": _admin_datetime(user.get("created_at")),
    }


def serialize_admin_verification(doc: dict, include_images: bool = False) -> dict:
    result = {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "status": doc.get("status", "pending"),
        "college_name": doc.get("college_name", ""),
        "course": doc.get("course", ""),
        "year": doc.get("year", ""),
        "student_id_number": doc.get("student_id_number", ""),
        "submitted_at": _admin_datetime(doc.get("submitted_at")),
        "reviewed_at": _admin_datetime(doc.get("reviewed_at")),
        "reviewer_note": doc.get("reviewer_note", ""),
        "rejection_reason": doc.get("rejection_reason", ""),
        "has_college_id_image": bool(doc.get("college_id_image")),
        "has_selfie_image": bool(doc.get("selfie_image")),
    }
    if include_images:
        # These are existing Base64 data URIs. Keep them out of lists so the
        # dashboard remains responsive; send them only for an opened profile.
        result["college_id_image"] = doc.get("college_id_image", "")
        result["selfie_image"] = doc.get("selfie_image", "")
        result["selfie_with_id"] = doc.get("selfie_image", "")
    return result


async def _review_pending_verification(
    verification_id: str, status: str, rejection_reason: str, admin: dict
) -> dict:
    """Atomically review one pending document verification and notify the student."""
    try:
        verification_oid = ObjectId(verification_id)
    except Exception:
        raise HTTPException(404, "Verification request not found")

    verification = await db.verifications.find_one(
        {"_id": verification_oid, "status": "pending"}
    )
    if not verification:
        existing = await db.verifications.find_one({"_id": verification_oid})
        if not existing:
            raise HTTPException(404, "Verification request not found")
        raise HTTPException(409, "This verification request has already been reviewed")

    student = await db.users.find_one({"_id": verification["user_id"]})
    if not student:
        raise HTTPException(404, "Student not found")

    now = datetime.now(timezone.utc)
    note = rejection_reason.strip() if status == "rejected" else ""
    review = await db.verifications.update_one(
        {"_id": verification_oid, "status": "pending"},
        {
            "$set": {
                "status": status,
                "reviewed_at": now,
                "reviewed_by": admin["_id"],
                "reviewer_note": note,
                "rejection_reason": note,
            }
        },
    )
    if not review.matched_count:
        raise HTTPException(409, "This verification request has already been reviewed")

    user_updates = {
        "verification_status": status,
        "verification_reviewed_at": now,
        "verified_by": str(admin["_id"]),
        "verification_rejection_reason": note,
    }
    update: dict = {"$set": user_updates}
    if status == "approved":
        user_updates.update(
            {
                "student_number": student.get("student_number") or gen_student_number(),
                "verification_expiry": now + timedelta(days=365),
            }
        )
        if student.get("verification_status") != "approved":
            update["$inc"] = {"reward_points": 200}
    await db.users.update_one({"_id": student["_id"]}, update)

    if status == "approved":
        email_result = send_email(
            student["email"],
            "You're now a verified student!",
            verification_email_html(
                "You're verified!",
                "Your verification was successful. Your student account is now verified and eligible for student discounts.",
                "View your student card",
                "/card",
            ),
        )
    else:
        reason_line = f" Reason: {html.escape(note)}." if note else ""
        email_result = send_email(
            student["email"],
            "Additional Information Required",
            verification_email_html(
                "Additional information required",
                "We could not complete your verification. Please upload clearer, valid college ID and selfie documents, then submit your verification again."
                + reason_line,
                "Resubmit verification",
                "/verify",
            ),
        )

    fresh = await db.users.find_one({"_id": student["_id"]})
    return {
        "ok": True,
        "user": serialize_admin_user(fresh),
        "email_sent": email_result["ok"],
        "email_error": email_result["error"],
    }


@api.get("/admin/dashboard")
async def admin_dashboard(admin=Depends(get_admin_user)):
    """Summary data for the admin home. Counts use the source collections only."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    student_query = {"role": {"$ne": "admin"}}
    total_users, verified_students, pending, rejected, today_signups, brands = await asyncio.gather(
        db.users.count_documents(student_query),
        db.users.count_documents({**student_query, "verification_status": "approved"}),
        db.verifications.count_documents({"status": "pending"}),
        db.verifications.count_documents({"status": "rejected"}),
        db.users.count_documents({**student_query, "created_at": {"$gte": today}}),
        db.offers.distinct("brand"),
    )
    return {
        "total_users": total_users,
        "verified_students": verified_students,
        "pending_verifications": pending,
        "rejected_verifications": rejected,
        "today_signups": today_signups,
        "total_brands": len(brands),
    }


@api.get("/admin/users")
async def admin_users(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(get_admin_user),
):
    if status and status not in {"approved", "pending", "rejected", "not_submitted"}:
        raise HTTPException(400, "Invalid verification status")
    query: dict = {"role": {"$ne": "admin"}}
    if status:
        query["verification_status"] = status
    if q and q.strip():
        pattern = re.escape(q.strip())
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
            {"college": {"$regex": pattern, "$options": "i"}},
        ]
    total = await db.users.count_documents(query)
    cursor = db.users.find(query).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
    users = [serialize_admin_user(user) async for user in cursor]
    return {"items": users, "page": page, "page_size": page_size, "total": total}


@api.get("/admin/pending-verifications")
async def admin_pending_verifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(get_admin_user),
):
    query = {"status": "pending"}
    total = await db.users.count_documents(
        {"role": {"$ne": "admin"}, "verification_status": "pending"}
    )
    cursor = db.verifications.find(query).sort("submitted_at", -1).skip((page - 1) * page_size).limit(page_size)
    docs = [doc async for doc in cursor]
    student_ids = [doc["user_id"] for doc in docs]
    students = {
        student["_id"]: student
        async for student in db.users.find(
            {"_id": {"$in": student_ids}, "verification_status": "pending"}
        )
    }
    items = []
    for doc in docs:
        student = students.get(doc["user_id"])
        if student:
            item = serialize_admin_verification(doc)
            item.update({"name": student.get("name", ""), "email": student.get("email", "")})
            items.append(item)
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@api.get("/admin/user/{user_id}")
async def admin_user_detail(user_id: str, admin=Depends(get_admin_user)):
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(404, "User not found")
    user = await db.users.find_one({"_id": user_oid, "role": {"$ne": "admin"}})
    if not user:
        raise HTTPException(404, "User not found")
    verification_docs = await db.verifications.find({"user_id": user_oid}).sort("submitted_at", -1).to_list(25)
    return {
        "user": serialize_admin_user(user),
        "verifications": [serialize_admin_verification(doc, include_images=True) for doc in verification_docs],
    }


@api.post("/admin/approve-verification")
async def admin_approve_verification(
    body: AdminVerificationDecisionIn, admin=Depends(get_admin_user)
):
    return await _review_pending_verification(body.verification_id, "approved", "", admin)


@api.post("/admin/reject-verification")
async def admin_reject_verification(
    body: AdminVerificationDecisionIn, admin=Depends(get_admin_user)
):
    reason = (body.rejection_reason or "").strip()
    if not reason:
        raise HTTPException(400, "A rejection reason is required")
    return await _review_pending_verification(body.verification_id, "rejected", reason, admin)


@api.get("/verification/status")
async def verification_status(user=Depends(get_current_user)):
    latest = await db.verifications.find_one(
        {"user_id": user["_id"]}, sort=[("submitted_at", -1)]
    )
    return {
        "status": serialize_user(user)["verification_status"],
        "student_number": user.get("student_number", ""),
        "expiry": (
            user.get("verification_expiry").isoformat()
            if user.get("verification_expiry")
            else None
        ),
        "last_submission": latest.get("submitted_at").isoformat() if latest else None,
    }


# -----------------------------
# Digital Student Card
# -----------------------------
@api.get("/student-card")
async def student_card(user=Depends(get_current_user)):
    if user.get("verification_status") != "approved":
        raise HTTPException(403, "You must be verified to access your student card")
    # Encode as URL so any phone camera scanning the QR opens our /scan page directly.
    payload = f"{FRONTEND_URL}/scan?s={user.get('student_number','')}"
    qr = generate_qr_data_uri(payload)
    return {
        "name": user.get("name", ""),
        "college": user.get("college", ""),
        "course": user.get("course", ""),
        "year": user.get("year", ""),
        "student_number": user.get("student_number", ""),
        "email": user.get("email", ""),
        "avatar_url": user.get("avatar_url", ""),
        "expiry": (
            user.get("verification_expiry").isoformat()
            if user.get("verification_expiry")
            else None
        ),
        "qr_data_uri": qr,
    }


# -----------------------------
# Offers
# -----------------------------
def serialize_offer(o: dict, saved_ids: set = None) -> dict:
    saved_ids = saved_ids or set()
    outlet_id = o.get("outlet_id")
    return {
        "id": str(o["_id"]),
        "title": o["title"],
        "brand": o["brand"],
        "brand_logo": o.get("brand_logo", ""),
        "brand_url": o.get("brand_url", ""),
        "category": o["category"],
        "description": o["description"],
        "discount": o["discount"],
        "image_url": o.get("image_url", ""),
        "terms": o.get("terms", ""),
        "validity": o.get("validity", ""),
        "featured": o.get("featured", False),
        "trending": o.get("trending", False),
        "location": o.get("location", "Pan India"),
        "claims_count": o.get("claims_count", 0),
        "saved": str(o["_id"]) in saved_ids,
        "outlet_id": str(outlet_id) if outlet_id else None,
        "redemption_policy": o.get("redemption_policy", ""),
        "created_at": o.get("created_at").isoformat() if o.get("created_at") else None,
    }


def serialize_outlet(o: dict, offer_count: int = 0) -> dict:
    return {
        "id": str(o["_id"]),
        "name": o["name"],
        "tagline": o.get("tagline", ""),
        "cuisine": o.get("cuisine", ""),
        "city": o.get("city", ""),
        "address": o.get("address", ""),
        "lat": o.get("lat"),
        "lng": o.get("lng"),
        "image_url": o.get("image_url", ""),
        "logo_url": o.get("logo_url", ""),
        "cover_url": o.get("cover_url", ""),
        "phone": o.get("phone", ""),
        "hours": o.get("hours", ""),
        "rating": o.get("rating", 4.5),
        "offer_count": offer_count,
    }


@api.get("/offers")
async def list_offers(
    q: Optional[str] = None,
    category: Optional[str] = None,
    sort: str = "featured",
    request: Request = None,
):
    query: dict = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category and category != "all":
        query["category"] = category

    cursor = db.offers.find(query)
    if sort == "trending":
        cursor = cursor.sort([("trending", -1), ("claims_count", -1)])
    elif sort == "latest":
        cursor = cursor.sort([("created_at", -1)])
    else:
        cursor = cursor.sort([("featured", -1), ("claims_count", -1)])

    offers = await cursor.to_list(200)

    saved_ids: set = set()
    # attempt to enrich with 'saved' if logged in
    try:
        if request:
            user = await get_current_user(request)
            saved = await db.saved_offers.find({"user_id": user["_id"]}).to_list(500)
            saved_ids = {str(s["offer_id"]) for s in saved}
    except Exception:
        pass

    return [serialize_offer(o, saved_ids) for o in offers]


@api.get("/offers/categories")
async def list_categories():
    cats = await db.offers.distinct("category")
    counts = []
    for c in cats:
        n = await db.offers.count_documents({"category": c})
        counts.append({"name": c, "count": n})
    return counts


@api.get("/offers/{offer_id}")
async def get_offer(offer_id: str, request: Request):
    try:
        o = await db.offers.find_one({"_id": ObjectId(offer_id)})
    except Exception:
        raise HTTPException(404, "Offer not found")
    if not o:
        raise HTTPException(404, "Offer not found")
    saved_ids: set = set()
    try:
        user = await get_current_user(request)
        saved = await db.saved_offers.find_one(
            {"user_id": user["_id"], "offer_id": o["_id"]}
        )
        if saved:
            saved_ids.add(offer_id)
    except Exception:
        pass
    return serialize_offer(o, saved_ids)


@api.post("/offers/{offer_id}/save")
async def toggle_save(offer_id: str, user=Depends(get_current_user)):
    oid = ObjectId(offer_id)
    existing = await db.saved_offers.find_one({"user_id": user["_id"], "offer_id": oid})
    if existing:
        await db.saved_offers.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    await db.saved_offers.insert_one(
        {
            "user_id": user["_id"],
            "offer_id": oid,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"saved": True}


@api.get("/saved")
async def list_saved(user=Depends(get_current_user)):
    saved = await db.saved_offers.find({"user_id": user["_id"]}).to_list(200)
    ids = [s["offer_id"] for s in saved]
    if not ids:
        return []
    offers = await db.offers.find({"_id": {"$in": ids}}).to_list(200)
    id_set = {str(i) for i in ids}
    return [serialize_offer(o, id_set) for o in offers]


# -----------------------------
# Coupons
# -----------------------------
def serialize_coupon(c: dict, offer: dict = None) -> dict:
    return {
        "id": str(c["_id"]),
        "code": c["code"],
        "offer_id": str(c["offer_id"]),
        "offer_title": (offer or {}).get("title", ""),
        "brand": (offer or {}).get("brand", ""),
        "brand_logo": (offer or {}).get("brand_logo", ""),
        "discount": (offer or {}).get("discount", ""),
        "image_url": (offer or {}).get("image_url", ""),
        "qr_data_uri": c.get("qr_data_uri", ""),
        "status": c["status"],
        "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
        "expires_at": c["expires_at"].isoformat() if c.get("expires_at") else None,
        "redeemed_at": c["redeemed_at"].isoformat() if c.get("redeemed_at") else None,
    }


@api.post("/offers/{offer_id}/claim")
async def claim_offer(offer_id: str, user=Depends(get_verified_user)):
    if user.get("verification_status") != "approved":
        raise HTTPException(403, "Get verified to claim offers")
    try:
        oid = ObjectId(offer_id)
    except Exception:
        raise HTTPException(404, "Offer not found")
    offer = await db.offers.find_one({"_id": oid})
    if not offer:
        raise HTTPException(404, "Offer not found")

    now = datetime.now(timezone.utc)

    # Prevent duplicate active coupons for the same offer. An expiry is also
    # applied here so an unscanned, stale coupon cannot block a fresh claim.
    existing = await db.coupons.find_one(
        {"user_id": user["_id"], "offer_id": oid, "status": "active"}
    )
    if existing:
        if existing.get("expires_at") and _aware(existing["expires_at"]) < now:
            await db.coupons.update_one(
                {"_id": existing["_id"], "status": "active"},
                {"$set": {"status": "expired"}},
            )
        else:
            return serialize_coupon(existing, offer)

    # Apply the policy configured on this specific outlet offer. Every issued
    # QR still keeps the same 30-day expiry below.
    outlet_oid = offer.get("outlet_id")
    if outlet_oid:
        policy = get_redemption_policy(offer)
        if policy == "daily":
            day_start, day_end = india_day_bounds(now)
            redeemed_today = await db.coupons.find_one(
                {
                    "user_id": user["_id"],
                    "outlet_id": outlet_oid,
                    "status": "redeemed",
                    "redeemed_at": {"$gte": day_start, "$lt": day_end},
                }
            )
            if redeemed_today:
                raise HTTPException(
                    409,
                    "You've already redeemed today's deal at this outlet. Please come back tomorrow.",
                )
        elif policy == "monthly":
            month_start, month_end = india_month_bounds(now)
            redeemed_this_month = await db.coupons.find_one(
                {
                    "user_id": user["_id"],
                    "offer_id": oid,
                    "status": "redeemed",
                    "redeemed_at": {"$gte": month_start, "$lt": month_end},
                }
            )
            if redeemed_this_month:
                raise HTTPException(
                    409,
                    "You've already redeemed this monthly deal. Please come back next month.",
                )
        elif policy == "once":
            redeemed_once = await db.coupons.find_one(
                {"user_id": user["_id"], "offer_id": oid, "status": "redeemed"}
            )
            if redeemed_once:
                raise HTTPException(409, "This one-time offer has already been redeemed.")
        elif policy == "new_offer":
            last_redeemed = await db.coupons.find_one(
                {"user_id": user["_id"], "outlet_id": outlet_oid, "status": "redeemed"},
                sort=[("redeemed_at", -1)],
            )
            if last_redeemed:
                last_offer = await db.offers.find_one({"_id": last_redeemed["offer_id"]})
                last_created = last_offer.get("created_at") if last_offer else None
                this_created = offer.get("created_at")
                if last_created and this_created and this_created <= last_created:
                    raise HTTPException(
                        409,
                        "You've already redeemed a deal at this outlet. Wait for a new deal to be posted here.",
                    )

    code = f"SCD-{secrets.token_hex(4).upper()}"
    expires = now + timedelta(days=30)
    # Encode as a URL so any phone camera opens the /scan page directly.
    payload = f"{FRONTEND_URL}/scan?c={code}"
    qr = generate_qr_data_uri(payload)
    doc = {
        "user_id": user["_id"],
        "offer_id": oid,
        "outlet_id": outlet_oid,
        "code": code,
        "qr_data_uri": qr,
        "status": "active",  # active | redeemed | expired
        "created_at": now,
        "expires_at": expires,
        "redeemed_at": None,
    }
    res = await db.coupons.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.offers.update_one({"_id": oid}, {"$inc": {"claims_count": 1}})
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"reward_points": 10}})

    send_email(
        user["email"],
        f"Your {offer['brand']} coupon is ready",
        f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#0a0a0f;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your student deal is ready to use.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;padding:0;background-color:#0a0a0f;">
      <tr>
        <td align="center" style="padding:28px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
            <tr>
              <td style="padding:0 8px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:34px;height:34px;border-radius:10px;background-color:#7c3aed;text-align:center;font-size:18px;line-height:34px;">S</td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:16px;line-height:20px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;">SavyCampusDeals</div>
                      <div style="font-size:11px;line-height:16px;color:#a1a1aa;">Exclusive student deals</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 30px;border:1px solid #312e4b;border-radius:24px 24px 0 0;background-color:#171425;background-image:linear-gradient(135deg,#171425 0%,#1d1740 58%,#102d38 100%);">
                <div style="display:inline-block;padding:6px 10px;border:1px solid #514b75;border-radius:999px;background-color:#292343;color:#c4b5fd;font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;">Student deal unlocked</div>
                <h1 style="margin:18px 0 10px;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-1px;color:#ffffff;">&#127881; Your Coupon is Ready!</h1>
                <p style="margin:0;font-size:16px;line-height:24px;color:#d4d4dc;">Nice! Your student discount has been unlocked. Less spending. More living. &#128156;</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 30px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #4b4670;border-radius:20px;background-color:#11111a;">
                  <tr>
                    <td style="padding:24px 22px 12px;">
                      <div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#a78bfa;">{offer['brand']}</div>
                      <div style="padding-top:7px;font-size:20px;line-height:27px;font-weight:700;letter-spacing:-0.35px;color:#ffffff;">{offer['title']}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 22px 20px;">
                      <div style="padding:17px 14px;border:1px dashed #7669ae;border-radius:14px;background-color:#1d1930;text-align:center;">
                        <div style="font-size:11px;line-height:15px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;color:#b8b2d7;">Your coupon code</div>
                        <div style="padding-top:8px;font-family:'Courier New',Courier,monospace;font-size:25px;line-height:30px;font-weight:700;letter-spacing:1.5px;color:#ffffff;word-break:break-all;">{code}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 22px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                        <tr>
                          <td style="font-size:13px;line-height:19px;color:#a1a1aa;">Valid until</td>
                          <td align="right" style="font-size:13px;line-height:19px;font-weight:700;color:#e9e7ff;">{expires.strftime('%B %d, %Y')}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 26px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:18px;background-color:#0e2028;">
                  <tr>
                    <td style="padding:20px 18px;">
                      <div style="font-size:17px;line-height:23px;font-weight:700;color:#ffffff;">How to redeem</div>
                      <div style="padding-top:10px;font-size:14px;line-height:22px;color:#d1e4e9;">Use your coupon code at checkout, or show this email to the outlet team when you redeem in person. If asked, let them scan the QR code below.</div>
                    </td>
                    <td align="center" valign="middle" style="width:112px;padding:18px 18px 18px 0;">
                      <div style="padding:8px;border-radius:13px;background-color:#ffffff;line-height:0;">
                        <img src="cid:coupon-qr" width="88" height="88" alt="Coupon QR code" style="display:block;width:88px;height:88px;border:0;outline:none;text-decoration:none;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 30px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #514b75;border-radius:16px;background-color:#211d35;">
                  <tr>
                    <td style="padding:17px 18px;">
                      <div style="font-size:13px;line-height:19px;font-weight:700;color:#f5f3ff;">A quick note before you go</div>
                      <div style="padding-top:5px;font-size:12px;line-height:19px;color:#c9c4df;">This coupon can only be redeemed once. Keep this email until it has been used, and only show the QR code to outlet staff during redemption.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:25px 28px 28px;border:1px solid #312e4b;border-top:0;border-radius:0 0 24px 24px;background-color:#12111d;text-align:center;">
                <div style="font-size:14px;line-height:20px;font-weight:700;color:#ffffff;">SavyCampusDeals</div>
                <div style="padding-top:5px;font-size:12px;line-height:18px;color:#a1a1aa;">Helping students save more every day.</div>
                <div style="padding-top:13px;font-size:12px;line-height:18px;color:#777286;">Made with &#10084;&#65039; for students &middot; &copy; 2026 SavyCampusDeals</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>""",
        attachments=[
            {
                "content": qr.split(",", 1)[1],
                "filename": "coupon-qr.png",
                "content_id": "coupon-qr",
            }
        ],
    )
    return serialize_coupon(doc, offer)


@api.get("/coupons")
async def my_coupons(user=Depends(get_current_user)):
    coupons = (
        await db.coupons.find({"user_id": user["_id"]})
        .sort("created_at", -1)
        .to_list(200)
    )
    result = []
    for c in coupons:
        o = await db.offers.find_one({"_id": c["offer_id"]})
        result.append(serialize_coupon(c, o))
    return result


@api.get("/coupons/{coupon_id}")
async def get_coupon(coupon_id: str, user=Depends(get_current_user)):
    c = await db.coupons.find_one({"_id": ObjectId(coupon_id), "user_id": user["_id"]})
    if not c:
        raise HTTPException(404, "Coupon not found")
    o = await db.offers.find_one({"_id": c["offer_id"]})
    return serialize_coupon(c, o)


# -----------------------------
# Dashboard stats
# -----------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    claimed = await db.coupons.count_documents({"user_id": user["_id"]})
    redeemed = await db.coupons.count_documents(
        {"user_id": user["_id"], "status": "redeemed"}
    )
    active = await db.coupons.count_documents(
        {"user_id": user["_id"], "status": "active"}
    )
    saved = await db.saved_offers.count_documents({"user_id": user["_id"]})
    total_offers = await db.offers.count_documents({})
    return {
        "claimed": claimed,
        "redeemed": redeemed,
        "active": active,
        "saved": saved,
        "reward_points": user.get("reward_points", 0),
        "referral_code": user.get("referral_code", ""),
        "verification_status": user.get("verification_status", "unverified"),
        "total_offers": total_offers,
    }


# -----------------------------
# Outlets (local restaurants/cafes)
# -----------------------------
@api.get("/outlets")
async def list_outlets(city: Optional[str] = None, q: Optional[str] = None):
    query: dict = {}
    if city and city != "all":
        query["city"] = city
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"cuisine": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
        ]
    outlets = await db.outlets.find(query).to_list(200)
    result = []
    for o in outlets:
        count = await db.offers.count_documents({"outlet_id": o["_id"]})
        result.append(serialize_outlet(o, count))
    return result


@api.get("/outlets/cities")
async def list_outlet_cities():
    return sorted(await db.outlets.distinct("city"))


@api.get("/outlets/{outlet_id}")
async def get_outlet(outlet_id: str, request: Request):
    try:
        oid = ObjectId(outlet_id)
    except Exception:
        raise HTTPException(404, "Outlet not found")
    outlet = await db.outlets.find_one({"_id": oid})
    if not outlet:
        raise HTTPException(404, "Outlet not found")

    offers = await db.offers.find({"outlet_id": oid}).sort("created_at", -1).to_list(50)

    saved_ids: set = set()
    already_redeemed_outlet = False
    outlet_claim_message = ""
    offer_claim_states: dict = {}
    try:
        user = await get_current_user(request)
        saved = await db.saved_offers.find({"user_id": user["_id"]}).to_list(500)
        saved_ids = {str(s["offer_id"]) for s in saved}
        redeemed_coupons = await db.coupons.find(
            {"user_id": user["_id"], "outlet_id": oid, "status": "redeemed"}
        ).sort("redeemed_at", -1).to_list(500)
        day_start, day_end = india_day_bounds()
        month_start, month_end = india_month_bounds()
        last_redeemed = redeemed_coupons[0] if redeemed_coupons else None
        last_offer = (
            await db.offers.find_one({"_id": last_redeemed["offer_id"]})
            if last_redeemed
            else None
        )

        for offer in offers:
            policy = get_redemption_policy(offer)
            blocked = False
            message = ""
            if policy == "daily":
                blocked = any(
                    coupon.get("redeemed_at")
                    and day_start <= _aware(coupon["redeemed_at"]) < day_end
                    for coupon in redeemed_coupons
                )
                message = "You've already redeemed today's deal here. Please come back tomorrow."
            elif policy == "monthly":
                blocked = any(
                    coupon.get("offer_id") == offer["_id"]
                    and coupon.get("redeemed_at")
                    and month_start <= _aware(coupon["redeemed_at"]) < month_end
                    for coupon in redeemed_coupons
                )
                message = "You've already redeemed this monthly deal. Please come back next month."
            elif policy == "once":
                blocked = any(
                    coupon.get("offer_id") == offer["_id"] for coupon in redeemed_coupons
                )
                message = "This one-time offer has already been redeemed."
            elif policy == "new_offer" and last_redeemed:
                last_created = _aware(last_offer.get("created_at")) if last_offer else None
                this_created = _aware(offer.get("created_at"))
                blocked = bool(last_created and this_created and this_created <= last_created)
                message = "You've already redeemed a deal here. You can claim a fresh one once this outlet posts a newer deal."

            offer_claim_states[str(offer["_id"])] = {
                "claim_blocked": blocked,
                "claim_message": message if blocked else "",
            }

        blocked_messages = [
            state["claim_message"]
            for state in offer_claim_states.values()
            if state["claim_blocked"]
        ]
        already_redeemed_outlet = bool(blocked_messages)
        if blocked_messages:
            outlet_claim_message = blocked_messages[0]
    except Exception:
        pass

    serialized_offers = []
    for offer in offers:
        serialized = serialize_offer(offer, saved_ids)
        serialized.update(
            offer_claim_states.get(
                str(offer["_id"]), {"claim_blocked": False, "claim_message": ""}
            )
        )
        serialized_offers.append(serialized)

    return {
        **serialize_outlet(outlet, len(offers)),
        "offers": serialized_offers,
        "already_redeemed_here": already_redeemed_outlet,
        "claim_message": outlet_claim_message,
    }


# -----------------------------
# Restaurant Scanner APIs
# -----------------------------
class ScanIn(BaseModel):
    payload: str


def _parse_qr_payload(raw: str) -> dict:
    """Parse QR string. Supports:
       - URL formats: https://.../scan?c=CODE  or  ?s=STUDENT_NUM  or  ?p=RAW
       - SCD|student_number|user_id|email  (student card, legacy)
       - COUPON|code|user_id|offer_id      (coupon, legacy)
       - raw coupon code like SCD-XXXXXXXX
       - raw student number like SCD-2026-XXXXXX
    """
    raw = (raw or "").strip()
    if not raw:
        return {"kind": "unknown"}

    # URL formats produced by QR generation
    if raw.startswith("http://") or raw.startswith("https://"):
        try:
            from urllib.parse import urlparse, parse_qs
            u = urlparse(raw)
            qs = parse_qs(u.query)
            if "c" in qs:
                raw = qs["c"][0].strip()
            elif "s" in qs:
                raw = qs["s"][0].strip()
            elif "p" in qs:
                raw = qs["p"][0].strip()
        except Exception:
            pass

    parts = raw.split("|")
    if len(parts) >= 4 and parts[0] == "SCD":
        return {
            "kind": "student",
            "student_number": parts[1],
            "user_id": parts[2],
            "email": parts[3],
        }
    if len(parts) >= 4 and parts[0] == "COUPON":
        return {
            "kind": "coupon",
            "code": parts[1],
            "user_id": parts[2],
            "offer_id": parts[3],
        }
    if raw.upper().startswith("SCD-") and len(raw) >= 8:
        # Student numbers look like SCD-2026-XXXXXX ; coupon codes like SCD-XXXXXXXX
        segs = raw.split("-")
        if len(segs) == 3:
            return {"kind": "student", "student_number": raw}
        return {"kind": "coupon", "code": raw}
    return {"kind": "unknown"}


@api.post("/scan/lookup")
async def scan_lookup(body: ScanIn):
    """Public endpoint used by restaurant staff. Parses QR + returns student/coupon info."""
    parsed = _parse_qr_payload(body.payload)

    if parsed["kind"] == "student":
        user = None
        if parsed.get("user_id"):
            try:
                user = await db.users.find_one({"_id": ObjectId(parsed["user_id"])})
            except Exception:
                user = None
        if not user and parsed.get("student_number"):
            user = await db.users.find_one({"student_number": parsed["student_number"]})
        if not user:
            raise HTTPException(404, "Student not found")
        approved = user.get("verification_status") == "approved"
        expiry = user.get("verification_expiry")
        return {
            "kind": "student",
            "verified": approved,
            "name": user.get("name", ""),
            "college": user.get("college", ""),
            "course": user.get("course", ""),
            "year": user.get("year", ""),
            "student_number": user.get("student_number", ""),
            "email": user.get("email", ""),
            "expiry": expiry.isoformat() if expiry else None,
            "expired": bool(expiry and _aware(expiry) < datetime.now(timezone.utc)),
        }

    if parsed["kind"] == "coupon":
        c = None
        if parsed.get("code"):
            c = await db.coupons.find_one({"code": parsed["code"]})
        if not c:
            raise HTTPException(404, "Coupon not found")
        offer = await db.offers.find_one({"_id": c["offer_id"]})
        user = await db.users.find_one({"_id": c["user_id"]})
        student_expiry = (user or {}).get("verification_expiry")
        return {
            "kind": "coupon",
            "code": c["code"],
            "status": c["status"],
            "expired": bool(
                c.get("expires_at")
                and _aware(c["expires_at"]) < datetime.now(timezone.utc)
            ),
            "offer_title": (offer or {}).get("title", ""),
            "brand": (offer or {}).get("brand", ""),
            "discount": (offer or {}).get("discount", ""),
            "outlet_id": (
                str(offer.get("outlet_id"))
                if offer and offer.get("outlet_id")
                else None
            ),
            # Student info surfaced prominently so restaurant staff can trust the claim
            "student_name": (user or {}).get("name", ""),
            "student_number": (user or {}).get("student_number", ""),
            "student_email": (user or {}).get("email", ""),
            "student_college": (user or {}).get("college", ""),
            "student_course": (user or {}).get("course", ""),
            "student_year": (user or {}).get("year", ""),
            "student_avatar_url": (user or {}).get("avatar_url", ""),
            "student_verified": (user or {}).get("verification_status") == "approved",
            "student_expiry": student_expiry.isoformat() if student_expiry else None,
            "student_expiry_expired": bool(
                student_expiry and _aware(student_expiry) < datetime.now(timezone.utc)
            ),
            "redeemed_at": (
                c["redeemed_at"].isoformat() if c.get("redeemed_at") else None
            ),
        }

    raise HTTPException(400, "Unrecognised QR code")


@api.post("/scan/redeem")
async def scan_redeem(body: ScanIn):
    """Restaurant marks a coupon as redeemed."""
    parsed = _parse_qr_payload(body.payload)
    if parsed["kind"] != "coupon":
        raise HTTPException(400, "Not a coupon QR")
    code = parsed.get("code")
    if not code:
        raise HTTPException(400, "Invalid coupon")
    c = await db.coupons.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Coupon not found")
    if c["status"] == "redeemed":
        raise HTTPException(409, "Coupon already redeemed")
    if c.get("expires_at") and _aware(c["expires_at"]) < datetime.now(timezone.utc):
        await db.coupons.update_one({"_id": c["_id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(410, "Coupon has expired")

    user = await db.users.find_one({"_id": c["user_id"]})
    if not user or user.get("verification_status") != "approved":
        raise HTTPException(403, "Student not verified")

    now = datetime.now(timezone.utc)
    offer = await db.offers.find_one({"_id": c["offer_id"]})
    if c.get("outlet_id") and offer:
        policy = get_redemption_policy(offer)
        if policy == "daily":
            day_start, day_end = india_day_bounds(now)
            already_redeemed = await db.coupons.find_one(
                {
                    "user_id": c["user_id"],
                    "outlet_id": c["outlet_id"],
                    "status": "redeemed",
                    "redeemed_at": {"$gte": day_start, "$lt": day_end},
                    "_id": {"$ne": c["_id"]},
                }
            )
            if already_redeemed:
                raise HTTPException(409, "This student has already redeemed today's deal at this outlet.")
            try:
                await db.outlet_daily_redemptions.insert_one(
                    {
                        "user_id": c["user_id"],
                        "outlet_id": c["outlet_id"],
                        "day": day_start,
                        "coupon_id": c["_id"],
                        "created_at": now,
                    }
                )
            except DuplicateKeyError:
                raise HTTPException(409, "This student has already redeemed today's deal at this outlet.")
        elif policy == "monthly":
            month_start, month_end = india_month_bounds(now)
            already_redeemed = await db.coupons.find_one(
                {
                    "user_id": c["user_id"],
                    "offer_id": c["offer_id"],
                    "status": "redeemed",
                    "redeemed_at": {"$gte": month_start, "$lt": month_end},
                    "_id": {"$ne": c["_id"]},
                }
            )
            if already_redeemed:
                raise HTTPException(409, "This student has already redeemed this month's deal.")
            try:
                await db.offer_monthly_redemptions.insert_one(
                    {
                        "user_id": c["user_id"],
                        "offer_id": c["offer_id"],
                        "month": month_start,
                        "coupon_id": c["_id"],
                        "created_at": now,
                    }
                )
            except DuplicateKeyError:
                raise HTTPException(409, "This student has already redeemed this month's deal.")
        elif policy == "once":
            already_redeemed = await db.coupons.find_one(
                {
                    "user_id": c["user_id"],
                    "offer_id": c["offer_id"],
                    "status": "redeemed",
                    "_id": {"$ne": c["_id"]},
                }
            )
            if already_redeemed:
                raise HTTPException(409, "This one-time offer has already been redeemed.")
            try:
                await db.offer_once_redemptions.insert_one(
                    {
                        "user_id": c["user_id"],
                        "offer_id": c["offer_id"],
                        "coupon_id": c["_id"],
                        "created_at": now,
                    }
                )
            except DuplicateKeyError:
                raise HTTPException(409, "This one-time offer has already been redeemed.")

    redeemed = await db.coupons.update_one(
        {"_id": c["_id"], "status": "active"},
        {"$set": {"status": "redeemed", "redeemed_at": now}},
    )
    if not redeemed.matched_count:
        raise HTTPException(409, "Coupon already redeemed")
    return {
        "ok": True,
        "code": c["code"],
        "redeemed_at": now.isoformat(),
        "offer_title": (offer or {}).get("title", ""),
        "discount": (offer or {}).get("discount", ""),
        "brand": (offer or {}).get("brand", ""),
        "student_name": user.get("name", ""),
        "student_number": user.get("student_number", ""),
    }


# -----------------------------
# Seed data — REAL Indian student deals (July 2026)
# -----------------------------
SEED_OFFERS = [
    {
        "title": "Premium Student — ₹59/month (50% OFF)",
        "brand": "Spotify",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg",
        "brand_url": "https://www.spotify.com/in-en/student/",
        "category": "Entertainment",
        "description": "Ad-free tunes for every all-nighter. Unlimited skips, offline downloads, hi-fi audio. Verified via SheerID.",
        "discount": "50% OFF",
        "image_url": "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=1200",
        "terms": "New Premium users only. Verified through SheerID once every 12 months (max 4 years).",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Digital",
        "claims_count": 5610,
    },
    {
        "title": "YouTube Premium Student — ₹79/month",
        "brand": "YouTube",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg",
        "brand_url": "https://www.youtube.com/premium/student",
        "category": "Entertainment",
        "description": "Ad-free YouTube + YouTube Music Premium + offline downloads. Save ~40% vs the regular plan.",
        "discount": "40% OFF",
        "image_url": "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200",
        "terms": "SheerID verification required. Reverify every 12 months.",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Digital",
        "claims_count": 4110,
    },
    {
        "title": "Apple Music Student — ₹49/month",
        "brand": "Apple Music",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Apple_Music_icon.svg",
        "brand_url": "https://music.apple.com/in/student",
        "category": "Entertainment",
        "description": "50% off Apple Music. Includes free Apple TV+ subscription. Verified via UNiDAYS.",
        "discount": "50% OFF",
        "image_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200",
        "terms": "Available up to 48 months while enrolled. UNiDAYS verification.",
        "validity": "Ongoing",
        "featured": False,
        "trending": True,
        "location": "Digital",
        "claims_count": 2140,
    },
    {
        "title": "MacBook & iPad — Education Pricing",
        "brand": "Apple",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
        "brand_url": "https://www.apple.com/in-edu/store",
        "category": "Tech",
        "description": "Up to ₹15,000 off MacBooks + ₹5,000 off iPads with free AirPods eligibility on select devices.",
        "discount": "UP TO 10% OFF",
        "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200",
        "terms": "Apple Education Store verifies with your college email or ID. One device per year.",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Online",
        "claims_count": 2780,
    },
    {
        "title": "Notion for Students — FREE Plus Plan",
        "brand": "Notion",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png",
        "brand_url": "https://www.notion.so/students",
        "category": "Education",
        "description": "Unlimited pages, AI-assist add-on eligible, unlimited uploads. Free while you're a student.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1611175694989-4870fafa4494?w=1200",
        "terms": "Verify with college email through Notion Students page. Reverify annually.",
        "validity": "Ongoing",
        "featured": True,
        "trending": False,
        "location": "Digital",
        "claims_count": 3220,
    },
    {
        "title": "GitHub Student Developer Pack — FREE",
        "brand": "GitHub",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg",
        "brand_url": "https://education.github.com/pack",
        "category": "Tech",
        "description": "GitHub Pro + $200 DigitalOcean credit + free domains (.me/.tech) + JetBrains IDEs + Copilot access.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1200",
        "terms": "Requires a valid student email or ID scan. Renews as long as you're enrolled.",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Digital",
        "claims_count": 6410,
    },
    {
        "title": "Creative Cloud All Apps — Flat 65% OFF",
        "brand": "Adobe",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Adobe_Systems_logo_and_wordmark.svg",
        "brand_url": "https://www.adobe.com/in/creativecloud/buy/students.html",
        "category": "Tech",
        "description": "Photoshop, Illustrator, Premiere Pro, After Effects & 20+ apps. Save up to ₹40,000/yr.",
        "discount": "65% OFF",
        "image_url": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200",
        "terms": "First-year rate ₹1,675/mo, then ₹2,720/mo. SheerID verification.",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Digital",
        "claims_count": 1980,
    },
    {
        "title": "Figma Education — FREE Professional",
        "brand": "Figma",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
        "brand_url": "https://www.figma.com/education/",
        "category": "Tech",
        "description": "Unlimited files, dev mode, plugins & libraries. Same features as the paid Pro plan.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1613909207039-6b173b755cc1?w=1200",
        "terms": "Verify via Figma Education form. Renewable annually.",
        "validity": "Ongoing",
        "featured": False,
        "trending": True,
        "location": "Digital",
        "claims_count": 1130,
    },
    {
        "title": "Canva for Campus — FREE Pro",
        "brand": "Canva",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/0/08/Canva_icon_2021.svg",
        "brand_url": "https://www.canva.com/education/",
        "category": "Tech",
        "description": "Free Pro for students at partner colleges. 100k+ templates, AI Magic Write, brand kits.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1200",
        "terms": "Available only if your college is a Canva for Campus partner. Free otherwise via edu email.",
        "validity": "Ongoing",
        "featured": False,
        "trending": True,
        "location": "Digital",
        "claims_count": 2410,
    },
    {
        "title": "Prime Student — ₹49/month or ₹399/year",
        "brand": "Amazon Prime",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_2024.svg",
        "brand_url": "https://www.amazon.in/amazonprime",
        "category": "Entertainment",
        "description": "6-month free trial + fast delivery + Prime Video + Kindle Prime Reading. 50% off vs standard.",
        "discount": "50% OFF",
        "image_url": "https://images.unsplash.com/photo-1620913166829-19b4c0d5715f?w=1200",
        "terms": "SheerID student verification. Renew annually.",
        "validity": "Ongoing",
        "featured": False,
        "trending": True,
        "location": "Pan India",
        "claims_count": 3760,
    },
    {
        "title": "Swiggy One Lite Student — ₹1 for 3 months",
        "brand": "Swiggy",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/1/12/Swiggy_logo.svg",
        "brand_url": "https://www.swiggy.com/student",
        "category": "Food & Drink",
        "description": "Free deliveries + flat ₹200 off on orders ₹699+ + 20% off Dineout bills. Save up to ₹1,800.",
        "discount": "₹1 / 3 MONTHS",
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200",
        "terms": "18–25 yrs, students in 200+ cities. Verify college email or ID in Swiggy app → Student Rewards.",
        "validity": "Live now",
        "featured": True,
        "trending": True,
        "location": "Pan India",
        "claims_count": 8210,
    },
    {
        "title": "Zomato Gold Flash Sale — ₹1 / 3 Months",
        "brand": "Zomato",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png",
        "brand_url": "https://www.zomato.com/gold",
        "category": "Food & Drink",
        "description": "3 months of Gold: free delivery ₹199+, 1+1 dine-in, 30–50% off partner restaurants.",
        "discount": "₹1 / 3 MONTHS",
        "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200",
        "terms": "Limited-period flash sale in the Zomato app → Gold section.",
        "validity": "Limited-time",
        "featured": True,
        "trending": True,
        "location": "Pan India",
        "claims_count": 6520,
    },
    {
        "title": "Coursera Plus — 50% OFF Annual",
        "brand": "Coursera",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Coursera_logo.svg",
        "brand_url": "https://www.coursera.org/courseraplus",
        "category": "Education",
        "description": "Unlimited access to 7,000+ courses, Professional Certificates & Specializations. Great for portfolio building.",
        "discount": "50% OFF",
        "image_url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200",
        "terms": "Verify via UNiDAYS. Applies to annual plan only.",
        "validity": "Ongoing",
        "featured": False,
        "trending": False,
        "location": "Digital",
        "claims_count": 1560,
    },
    {
        "title": "Microsoft 365 Education — FREE",
        "brand": "Microsoft",
        "brand_logo": "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg",
        "brand_url": "https://www.microsoft.com/en-in/education/products/office",
        "category": "Education",
        "description": "Word, Excel, PowerPoint, OneNote, Teams + 1 TB OneDrive — 100% free with a college email.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1573167243872-43c6433b9d40?w=1200",
        "terms": "Valid EDU email required. Renewed while enrolled.",
        "validity": "Ongoing",
        "featured": False,
        "trending": False,
        "location": "Digital",
        "claims_count": 2830,
    },
]


SEED_VERSION = "v3-json-migrations"


async def seed_offers():
    # Force re-seed when SEED_VERSION changes
    meta = await db.seed_meta.find_one({"key": "offers"})
    if meta and meta.get("version") == SEED_VERSION:
        return
    # Delete non-outlet offers (brand deals) and their coupons
    old_ids = [o["_id"] async for o in db.offers.find({"outlet_id": None}, {"_id": 1})]
    if old_ids:
        await db.coupons.delete_many({"offer_id": {"$in": old_ids}})
        await db.saved_offers.delete_many({"offer_id": {"$in": old_ids}})
        await db.offers.delete_many({"_id": {"$in": old_ids}})
    now = datetime.now(timezone.utc)
    # docs = [{**o, "created_at": now, "outlet_id": None} for o in SEED_OFFERS]
    offers = load_data("brand_offers.json")
    docs = [
        {
            **offer,
            "claims_count": 0,
            "created_at": now,
            "outlet_id": None,
        }
        for offer in offers
    ]

    await db.offers.insert_many(docs)
    await db.seed_meta.update_one(
        {"key": "offers"},
        {"$set": {"version": SEED_VERSION, "updated_at": now}},
        upsert=True,
    )
    logger.info(f"Seeded {len(docs)} REAL brand offers ({SEED_VERSION})")


SEED_OUTLETS = [
    {
        "name": "Roastery & Co.",
        "tagline": "Third-wave coffee + fresh bakes",
        "cuisine": "Cafe • Bakery",
        "city": "Mumbai",
        "address": "Bandra Linking Road, Mumbai 400050",
        "lat": 19.0680,
        "lng": 72.8365,
        "image_url": "https://images.pexels.com/photos/34482998/pexels-photo-34482998.jpeg",
        "cover_url": "https://images.pexels.com/photos/34482998/pexels-photo-34482998.jpeg",
        "logo_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
        "phone": "+91 98200 12345",
        "hours": "8am – 11pm",
        "rating": 4.7,
        "offers": [
            {
                "title": "Buy 1 Get 1 on Cold Brews",
                "discount": "BOGO",
                "description": "Every cold brew comes with a friend, on us. Verified students only.",
                "terms": "In-store only. Cannot combine with other offers.",
                "validity": "Till 31 Dec",
                "featured": True,
                "trending": True,
            },
            {
                "title": "30% OFF Weekend Brunch",
                "discount": "30% OFF",
                "description": "Sat & Sun mornings, hit our brunch spread for 30% less.",
                "terms": "Valid Sat/Sun 9-1pm only.",
                "validity": "Weekends",
            },
        ],
    },
    {
        "name": "Momo Mafia",
        "tagline": "Steamed. Fried. Iconic.",
        "cuisine": "Asian • Momos",
        "city": "Delhi",
        "address": "Hudson Lane, GTB Nagar, Delhi 110009",
        "lat": 28.7047,
        "lng": 77.2109,
        "image_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=200",
        "phone": "+91 98111 78901",
        "hours": "11am – 12am",
        "rating": 4.5,
        "offers": [
            {
                "title": "Flat ₹100 OFF on Orders ₹299+",
                "discount": "₹100 OFF",
                "description": "Because 10 momos > 8.",
                "terms": "Min order ₹299. Dine-in only.",
                "validity": "Till 15 Jan",
                "trending": True,
            },
        ],
    },
    {
        "name": "The Book Barn",
        "tagline": "Boba tea + study cocoons",
        "cuisine": "Cafe • Boba",
        "city": "Bangalore",
        "address": "Church Street, Bangalore 560001",
        "lat": 12.9754,
        "lng": 77.6084,
        "image_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=200",
        "phone": "+91 80482 76543",
        "hours": "9am – 11pm",
        "rating": 4.8,
        "offers": [
            {
                "title": "Free Boba Upgrade + 20% OFF",
                "discount": "20% OFF",
                "description": "Level up any drink to boba, free. Plus 20% off the bill.",
                "terms": "In-store only.",
                "validity": "Ongoing",
                "featured": True,
            },
        ],
    },
    {
        "name": "Burger Republic",
        "tagline": "Smash burgers, done right",
        "cuisine": "American • Burgers",
        "city": "Mumbai",
        "address": "Powai Central, Mumbai 400076",
        "lat": 19.1176,
        "lng": 72.9060,
        "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200",
        "phone": "+91 96000 44444",
        "hours": "12pm – 1am",
        "rating": 4.6,
        "offers": [
            {
                "title": "Free Fries + Coke on Any Burger",
                "discount": "FREE COMBO",
                "description": "Any burger, we throw in fries + a drink. On the house.",
                "terms": "One combo per student per visit.",
                "validity": "Weekdays only",
                "trending": True,
            },
        ],
    },
    {
        "name": "South Side Idli",
        "tagline": "Filter coffee & fluffy idlis",
        "cuisine": "South Indian",
        "city": "Bangalore",
        "address": "Jayanagar 4th Block, Bangalore 560011",
        "lat": 12.9299,
        "lng": 77.5834,
        "image_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=200",
        "phone": "+91 80999 22221",
        "hours": "6am – 10pm",
        "rating": 4.9,
        "offers": [
            {
                "title": "Unlimited Thali at ₹149",
                "discount": "₹149 THALI",
                "description": "Unlimited South Indian thali for verified students.",
                "terms": "Dine-in only. Lunch (12-3pm).",
                "validity": "Till 28 Feb",
                "featured": True,
            },
        ],
    },
    {
        "name": "Chai Point Studio",
        "tagline": "Cutting chai + maggi combos",
        "cuisine": "Cafe • Snacks",
        "city": "Delhi",
        "address": "Kamla Nagar, Delhi 110007",
        "lat": 28.6864,
        "lng": 77.2072,
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200",
        "phone": "+91 97733 55511",
        "hours": "7am – 11pm",
        "rating": 4.4,
        "offers": [
            {
                "title": "₹99 Maggi + Chai Combo",
                "discount": "₹99 COMBO",
                "description": "The DU tradition: maggi + chai for ninety-nine.",
                "terms": "Dine-in only.",
                "validity": "Ongoing",
            },
        ],
    },
]


async def seed_outlets():
    if await db.outlets.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc)
    for od in SEED_OUTLETS:
        offers = od.pop("offers", [])
        outlet_doc = {**od, "created_at": now}
        res = await db.outlets.insert_one(outlet_doc)
        outlet_id = res.inserted_id
        # attach offers to outlet
        offer_docs = []
        for o in offers:
            offer_docs.append(
                {
                    "title": o["title"],
                    "brand": od["name"],
                    "brand_logo": od.get("logo_url", ""),
                    "category": "Food & Drink",
                    "description": o["description"],
                    "discount": o["discount"],
                    "image_url": od.get("cover_url", od.get("image_url", "")),
                    "terms": o.get("terms", ""),
                    "redemption_policy": o.get("redemption_policy", ""),
                    "validity": o.get("validity", "Ongoing"),
                    "featured": o.get("featured", False),
                    "trending": o.get("trending", False),
                    "location": f"{od['name']} • {od['city']}",
                    "claims_count": 0,
                    "outlet_id": outlet_id,
                    "created_at": now,
                }
            )
        if offer_docs:
            await db.offers.insert_many(offer_docs)
    logger.info(f"Seeded {len(SEED_OUTLETS)} outlets with their offers")


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@savycampusdeals.in")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(
            {
                "email": admin_email,
                "password_hash": hash_password(admin_pass),
                "name": "Admin",
                "role": "admin",
                "email_verified": True,
                "verification_status": "approved",
                "student_number": "SCD-ADMIN",
                "reward_points": 0,
                "referral_code": "ADMIN",
                "created_at": datetime.now(timezone.utc),
            }
        )
        logger.info("Seeded admin user")


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.saved_offers.create_index(
            [("user_id", 1), ("offer_id", 1)], unique=True
        )
        await db.coupons.create_index([("user_id", 1), ("offer_id", 1), ("status", 1)])
        await db.users.create_index([("verification_status", 1), ("created_at", -1)])
        await db.verifications.create_index([("status", 1), ("submitted_at", -1)])
        await db.outlet_daily_redemptions.create_index(
            [("user_id", 1), ("outlet_id", 1), ("day", 1)], unique=True
        )
        await db.offer_monthly_redemptions.create_index(
            [("user_id", 1), ("offer_id", 1), ("month", 1)], unique=True
        )
        await db.offer_once_redemptions.create_index(
            [("user_id", 1), ("offer_id", 1)], unique=True
        )
        await db.verifications.create_index(
            "student_id_normalized",
            unique=True,
            partialFilterExpression={"student_id_normalized": {"$type": "string"}},
        )
        await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Index warn: {e}")
    await seed_admin()
    await seed_offers()
    await seed_outlets()
    # Migrate existing coupons + student QRs from pipe-payload to URL format,
    # so that any phone camera scanning them opens our /scan page directly.
    try:
        old_cursor = db.coupons.find({"status": "active"})
        migrated = 0
        async for c in old_cursor:
            # Regenerate to the URL format if it doesn't already look like a URL
            existing = c.get("qr_data_uri", "")
            # Cheap heuristic: rebuild all active coupon QRs to the new URL format.
            payload = f"{FRONTEND_URL}/scan?c={c['code']}"
            new_qr = generate_qr_data_uri(payload)
            if new_qr != existing:
                await db.coupons.update_one({"_id": c["_id"]}, {"$set": {"qr_data_uri": new_qr}})
                migrated += 1
        if migrated:
            logger.info(f"Migrated {migrated} active coupon QRs to URL format")
    except Exception as e:
        logger.warning(f"QR migration warn: {e}")


@api.get("/health")
async def health():
    return {"ok": True, "service": "savycampusdeals"}


# Mount router + CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
