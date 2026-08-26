from dotenv import load_dotenv
from pathlib import Path
import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import base64
import hashlib
import hmac
import secrets
import logging
import asyncio
import html
import re
import math
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
from pymongo import ReturnDocument
from pymongo.errors import BulkWriteError, DuplicateKeyError
from services.cloudinary_service import (
    CloudinaryUploadError,
    InvalidVerificationImage,
    delete_verification_image,
    delete_verification_images_for_user,
    upload_verification_image,
    validate_verification_image,
)
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
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", FRONTEND_URL).rstrip("/")
EMAIL_CAMPAIGN_RATE_PER_SECOND = max(
    1, min(20, int(os.environ.get("EMAIL_CAMPAIGN_RATE_PER_SECOND", "2")))
)
BRAND_OFFER_DISCLAIMER = (
    "SavvyCampusDeals helps students discover this publicly available offer. "
    "Eligibility, verification, availability and fulfilment are managed by the "
    "brand. SavvyCampusDeals is not affiliated with the brand unless the offer "
    "is marked as a Partner Offer."
)
STUDENT_AVATAR_KEYS = {
    "campus_cat",
    "cosmic_rocket",
    "chill_ghost",
    "study_bird",
    "music_wave",
    "game_mode",
    "green_leaf",
    "lucky_star",
}
# Keep this list deliberately explicit: a domain is trusted only when it appears
# here.  A non-consumer domain alone is never enough to bypass document review.
APPROVED_COLLEGE_DOMAINS = {
    domain.strip().lower()
    for domain in os.environ.get(
        "APPROVED_COLLEGE_DOMAINS", "iitd.ac.in,iitb.ac.in,vit.ac.in,amity.edu,s.amity.edu,kiet.edu,ipec.org.in,its.edu.in,stu.manit.ac.in,ds.study.iitm.ac.in"
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


SAVVY_POINT_TIERS = [
    {
        "key": "campus_starter",
        "name": "Campus Starter",
        "minimum": 0,
        "benefit": "Start stacking rewards every time you use a partner deal.",
        "reward": "Savvy membership and access to student-only partner deals.",
    },
    {
        "key": "deal_hunter",
        "name": "Deal Hunter",
        "minimum": 1000,
        "benefit": "Your first real level reward is ready to enjoy.",
        "reward": "One free cold coffee, iced tea, lemonade, or similar drink.",
    },
    {
        "key": "savvy_insider",
        "name": "Savvy Insider",
        "minimum": 3000,
        "benefit": "A bigger campus treat for a true Savvy regular.",
        "reward": "One free drink, one free pizza, and a voucher worth up to ₹150.",
    },
    {
        "key": "campus_icon",
        "name": "Campus Icon",
        "minimum": 8000,
        "benefit": "You've unlocked the biggest Savvy milestone reward.",
        "reward": "One laptop bag, one water bottle, and a voucher worth up to ₹300.",
    },
]
SAVVY_REDEMPTION_POINTS = 50
SAVVY_REWARD_VALID_DAYS = 30


def savvy_points_balance(user: dict) -> int:
    return int(user.get("savvy_points_balance", user.get("reward_points", 0)) or 0)


def savvy_points_lifetime(user: dict) -> int:
    return int(user.get("savvy_points_lifetime", savvy_points_balance(user)) or 0)


def savvy_tier(lifetime_points: int) -> dict:
    current_index = 0
    for index, tier in enumerate(SAVVY_POINT_TIERS):
        if lifetime_points >= tier["minimum"]:
            current_index = index
        else:
            break
    current = SAVVY_POINT_TIERS[current_index]
    next_tier = (
        SAVVY_POINT_TIERS[current_index + 1]
        if current_index + 1 < len(SAVVY_POINT_TIERS)
        else None
    )
    if next_tier:
        span = next_tier["minimum"] - current["minimum"]
        progress = round(
            min(100, max(0, (lifetime_points - current["minimum"]) / span * 100)),
            1,
        )
        points_to_next = max(0, next_tier["minimum"] - lifetime_points)
    else:
        progress = 100
        points_to_next = 0
    return {
        **current,
        "index": current_index,
        "progress_percent": progress,
        "points_to_next": points_to_next,
        "next_tier": next_tier,
    }


async def ensure_savvy_point_fields(user_id: ObjectId) -> dict:
    """Lazily preserve a legacy reward_points balance before the first new award."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise RuntimeError("Points recipient no longer exists")
    if "savvy_points_balance" not in user or "savvy_points_lifetime" not in user:
        legacy_balance = int(user.get("reward_points", 0) or 0)
        await db.users.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "savvy_points_balance": legacy_balance,
                    "savvy_points_lifetime": legacy_balance,
                    "reward_points": legacy_balance,
                }
            },
        )
        user = {
            **user,
            "savvy_points_balance": legacy_balance,
            "savvy_points_lifetime": legacy_balance,
            "reward_points": legacy_balance,
        }
    return user


def serialize_level_reward(reward: dict) -> dict:
    status = reward.get("status", "active")
    if (
        status == "active"
        and reward.get("expires_at")
        and _aware(reward["expires_at"]) <= datetime.now(timezone.utc)
    ):
        status = "expired"
    return {
        "id": str(reward["_id"]),
        "tier_key": reward.get("tier_key", ""),
        "tier_name": reward.get("tier_name", ""),
        "reward_title": reward.get("reward_title", ""),
        "code": reward.get("code", ""),
        "qr_data_uri": reward.get("qr_data_uri", ""),
        "status": status,
        "unlocked_at": reward.get("unlocked_at").isoformat()
        if reward.get("unlocked_at")
        else None,
        "expires_at": reward.get("expires_at").isoformat()
        if reward.get("expires_at")
        else None,
        "redeemed_at": reward.get("redeemed_at").isoformat()
        if reward.get("redeemed_at")
        else None,
        "redeemed_outlet_id": str(reward["redeemed_outlet_id"])
        if reward.get("redeemed_outlet_id")
        else None,
    }


def level_reward_email_html(user: dict, tier: dict, reward: dict) -> str:
    first_name = html.escape(user.get("name", "Savvy member").strip().split(" ")[0])
    reward_title = html.escape(tier["reward"])
    expiry = _aware(reward["expires_at"]).astimezone(INDIA_TIMEZONE).strftime(
        "%d %b %Y"
    )
    dashboard_url = f"{FRONTEND_URL.rstrip('/')}/dashboard"
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#07060b;color:#fff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-radius:28px;overflow:hidden;background:#13101d;border:1px solid #45366f;">
    <tr><td style="padding:34px 30px;background:linear-gradient(135deg,#6d28d9,#c026d3 55%,#f59e0b);">
      <div style="font-size:12px;font-weight:800;letter-spacing:2.4px;text-transform:uppercase;color:#fff7d6;">Savvy level unlocked ✦</div>
      <h1 style="margin:12px 0 0;font-size:38px;line-height:1.05;letter-spacing:-1.5px;">Big move, {first_name}!</h1>
      <p style="margin:12px 0 0;font-size:18px;line-height:1.5;color:#f5eefe;">You just reached <strong>{html.escape(tier['name'])}</strong>.</p>
    </td></tr>
    <tr><td style="padding:28px 30px 8px;">
      <div style="border-radius:22px;background:#201933;border:1px solid #58437f;padding:23px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#d8b4fe;">Your reward</div>
        <div style="padding-top:10px;font-size:22px;line-height:1.35;font-weight:800;color:#fff;">{reward_title}</div>
      </div>
    </td></tr>
    <tr><td align="center" style="padding:22px 30px 8px;">
      <div style="display:inline-block;padding:13px;border-radius:20px;background:#fff;line-height:0;"><img src="cid:level-reward-qr" width="190" height="190" alt="Savvy reward QR code" style="display:block;border:0;" /></div>
      <div style="padding-top:14px;font-size:16px;font-weight:800;letter-spacing:1px;color:#fff;">{html.escape(reward['code'])}</div>
      <div style="padding-top:7px;font-size:13px;color:#b8b1c7;">Valid until {expiry} · One-time use</div>
    </td></tr>
    <tr><td style="padding:24px 30px 34px;text-align:center;">
      <p style="margin:0;color:#c9c3d4;font-size:14px;line-height:1.6;">Show this QR to the team at a participating Savvy partner cafe. The reward is marked used after they approve it.</p>
      <a href="{dashboard_url}" style="display:inline-block;margin-top:22px;border-radius:999px;background:#fff;color:#111;padding:13px 23px;font-size:14px;font-weight:800;text-decoration:none;">Open my reward</a>
      <div style="padding-top:24px;font-size:12px;color:#746d80;">SavvyCampusDeals · made for student wins</div>
    </td></tr>
  </table>
</td></tr></table></body></html>"""


async def ensure_level_rewards(user_id: ObjectId) -> list[dict]:
    """Issue every earned non-starter tier reward exactly once."""
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return []
    if effective_verification_status(user) != "approved":
        return await db.savvy_level_rewards.find({"user_id": user_id}).sort(
            "threshold", 1
        ).to_list(len(SAVVY_POINT_TIERS) - 1)
    lifetime = savvy_points_lifetime(user)
    for tier in SAVVY_POINT_TIERS[1:]:
        if lifetime < tier["minimum"]:
            continue
        now = datetime.now(timezone.utc)
        code = f"SVR-{secrets.token_hex(5).upper()}"
        payload = f"{FRONTEND_URL.rstrip('/')}/scan?r={code}"
        qr = generate_qr_data_uri(payload)
        reward = {
            "_id": ObjectId(),
            "user_id": user_id,
            "tier_key": tier["key"],
            "tier_name": tier["name"],
            "threshold": tier["minimum"],
            "reward_title": tier["reward"],
            "code": code,
            "qr_data_uri": qr,
            "status": "active",
            "unlocked_at": now,
            "expires_at": now + timedelta(days=SAVVY_REWARD_VALID_DAYS),
            "redeemed_at": None,
        }
        try:
            await db.savvy_level_rewards.insert_one(reward)
        except DuplicateKeyError:
            continue
        send_email(
            user["email"],
            f"{tier['name']} unlocked — your Savvy reward is here ✨",
            level_reward_email_html(user, tier, reward),
            attachments=[
                {
                    "content": qr.split(",", 1)[1],
                    "filename": f"{tier['key']}-reward-qr.png",
                    "content_id": "level-reward-qr",
                }
            ],
        )
    return await db.savvy_level_rewards.find({"user_id": user_id}).sort(
        "threshold", 1
    ).to_list(len(SAVVY_POINT_TIERS) - 1)


async def award_savvy_points(
    user_id: ObjectId,
    amount: int,
    event_type: str,
    source_id: str,
    title: str,
    description: str,
) -> bool:
    """Award an earning event once and keep balance/lifetime totals in sync."""
    if amount <= 0:
        raise ValueError("Savvy Points awards must be positive")
    await ensure_savvy_point_fields(user_id)
    event_key = f"{event_type}:{source_id}:{user_id}"
    now = datetime.now(timezone.utc)
    try:
        await db.savvy_points_transactions.insert_one(
            {
                "user_id": user_id,
                "amount": amount,
                "event_type": event_type,
                "source_id": source_id,
                "event_key": event_key,
                "title": title,
                "description": description,
                "status": "pending",
                "created_at": now,
            }
        )
    except DuplicateKeyError:
        pass
    result = await db.users.update_one(
        {"_id": user_id, "processed_savvy_point_events": {"$ne": event_key}},
        {
            "$inc": {
                "savvy_points_balance": amount,
                "savvy_points_lifetime": amount,
                # Kept in sync during the compatibility window for older clients.
                "reward_points": amount,
            },
            "$addToSet": {"processed_savvy_point_events": event_key},
        },
    )
    await db.savvy_points_transactions.update_one(
        {"event_key": event_key},
        {"$set": {"status": "earned", "processed_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count:
        try:
            await ensure_level_rewards(user_id)
        except Exception:
            logger.exception("Could not issue Savvy level reward for user %s", user_id)
    return bool(result.matched_count)


async def complete_pending_referral(referred_user_id: ObjectId) -> bool:
    """Release both 100-point bonuses once the referred student is verified."""
    referral = await db.referrals.find_one({"referred_id": referred_user_id})
    if not referral:
        return False
    if referral.get("status") == "awarded" or referral.get("points_awarded", 0) > 0:
        if referral.get("status") != "awarded":
            await db.referrals.update_one(
                {"_id": referral["_id"]}, {"$set": {"status": "awarded"}}
            )
        return False

    referral_id = str(referral["_id"])
    referred = await db.users.find_one({"_id": referred_user_id})
    if not referred or effective_verification_status(referred) != "approved":
        return False
    referrer = await db.users.find_one({"_id": referral["referrer_id"]})
    if not referrer:
        return False

    first_name = referred.get("name", "A friend").strip().split(" ")[0]
    await award_savvy_points(
        referrer["_id"],
        100,
        "referral",
        f"{referral_id}:referrer",
        "Referral verified",
        f"{first_name} verified their student account.",
    )
    await award_savvy_points(
        referred_user_id,
        100,
        "referral",
        f"{referral_id}:referred",
        "Referral welcome bonus",
        "You joined with a friend's referral code and got verified.",
    )
    now = datetime.now(timezone.utc)
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {
            "$set": {
                "status": "awarded",
                "points_awarded": 100,
                "referred_points_awarded": 100,
                "qualified_at": now,
            }
        },
    )
    send_email(
        referrer["email"],
        "You just earned 100 Savvy Points",
        f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
        <h1 style="font-family:Outfit,sans-serif;font-weight:800">+100 Savvy Points</h1>
        <p>{html.escape(first_name)} verified their student account. Your referral reward is now in your Savvy balance.</p>
        </div>""",
    )
    return True


def serialize_user(u: dict) -> dict:
    verification_status = effective_verification_status(u)
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
        "avatar_key": u.get("avatar_key", ""),
        "email_verified": u.get("email_verified", False),
        "verification_status": verification_status,
        "verification_method": "college_email"
        if is_approved_college_email(u["email"])
        else "document_review",
        "student_number": u.get("student_number", ""),
        "verification_expiry": u.get("verification_expiry"),
        "reverification_email_verified": has_current_reverification_email(u),
        "savvy_points_balance": savvy_points_balance(u),
        "savvy_points_lifetime": savvy_points_lifetime(u),
        "reward_points": savvy_points_balance(u),
        "referral_code": u.get("referral_code", ""),
        "outlet_id": str(u["outlet_id"]) if u.get("outlet_id") else None,
        "active": u.get("active", True),
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
    if user.get("role") in {"outlet_partner", "event_staff"} and not user.get("active", True):
        raise HTTPException(403, "This outlet partner account is disabled")
    user = await expire_verification_if_needed(user)
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


def verification_has_expired(
    user: dict, now: Optional[datetime] = None
) -> bool:
    expiry = user.get("verification_expiry")
    return bool(
        expiry
        and _aware(expiry) < (now or datetime.now(timezone.utc))
    )


def effective_verification_status(user: dict) -> str:
    status = user.get("verification_status", "not_submitted")
    if status == "unverified":
        return "not_submitted"
    if status == "approved" and verification_has_expired(user):
        return "expired"
    return status


def has_current_reverification_email(user: dict) -> bool:
    verified_at = user.get("reverification_email_verified_at")
    expiry = user.get("verification_expiry")
    return bool(
        effective_verification_status(user) == "expired"
        and verified_at
        and expiry
        and _aware(verified_at) > _aware(expiry)
    )


async def expire_verification_if_needed(user: dict) -> dict:
    if (
        user.get("role", "student") == "student"
        and user.get("verification_status") == "approved"
        and verification_has_expired(user)
    ):
        await db.users.update_one(
            {"_id": user["_id"], "verification_status": "approved"},
            {
                "$set": {
                    "verification_status": "expired",
                    "verification_expired_at": datetime.now(timezone.utc),
                }
            },
        )
        user = {**user, "verification_status": "expired"}
    return user


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


def coupon_expiry_for_offer(
    offer: dict, now: Optional[datetime] = None
) -> datetime:
    """Keep a coupon inside the redemption window configured for its offer."""
    now = now or datetime.now(timezone.utc)
    policy = get_redemption_policy(offer)
    if policy == "daily":
        return india_day_bounds(now)[1]
    if policy == "monthly":
        return india_month_bounds(now)[1]
    return now + timedelta(days=30)


def distance_km(
    origin_lat: float, origin_lng: float, target_lat: float, target_lng: float
) -> float:
    """Return the great-circle distance between two latitude/longitude points."""
    radius_km = 6371.0088
    lat_1, lat_2 = math.radians(origin_lat), math.radians(target_lat)
    delta_lat = math.radians(target_lat - origin_lat)
    delta_lng = math.radians(target_lng - origin_lng)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_1) * math.cos(lat_2) * math.sin(delta_lng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))


DEV_OTP_FALLBACK = os.environ.get("DEV_OTP_FALLBACK", "true").lower() == "true"


def send_email(to: str, subject: str, html: str, attachments=None) -> dict:
    """Returns {ok: bool, error: str|None}."""
    if not RESEND_API_KEY:
        logger.warning(f"[Email skipped: no key] To={to}")
        return {"ok": False, "error": "no_api_key"}
    try:
        params = {
            "from": f"SavvyCampus <{FROM_EMAIL}>",
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


def is_valid_student_id(value: str) -> bool:
    """Keep ID formats flexible while rejecting email addresses used by mistake."""
    student_id = value.strip()
    return bool(student_id) and "@" not in student_id and not re.fullmatch(
        r"[^\s@]+@[^\s@]+\.[^\s@]+", student_id
    )


def verification_email_html(
    heading: str, body: str, cta_label: str = "Open SavvyCampusDeals", cta_path: str = "/dashboard"
) -> str:
    href = f"{FRONTEND_URL.rstrip('/')}{cta_path}"
    return f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
    <h1 style="font-family:Outfit,Arial,sans-serif;font-weight:800">{heading}</h1>
    <p style="color:#d4d4dc;line-height:1.6">{body}</p>
    <a href="{href}" style="display:inline-block;margin-top:20px;background:#ffffff;color:#111111;border-radius:999px;padding:12px 20px;font-weight:700;text-decoration:none">{cta_label}</a>
    </div>"""


def welcome_email_first_name(user: dict) -> str:
    clean_name = re.sub(r"[\r\n]+", " ", user.get("name") or "").strip()
    return (clean_name.split()[0] if clean_name else "student")[:40]


def welcome_email_html(user: dict) -> str:
    """Render the one-time welcome email sent after signup email verification."""
    first_name = html.escape(welcome_email_first_name(user))
    verify_url = f"{FRONTEND_URL.rstrip('/')}/verify"
    terms_url = f"{FRONTEND_URL.rstrip('/')}/terms"
    privacy_url = f"{FRONTEND_URL.rstrip('/')}/privacy"
    support_url = f"{FRONTEND_URL.rstrip('/')}/support"
    return f"""<!doctype html>
<html lang="en">
  <body style="margin:0;background:#050505;color:#ffffff;font-family:Manrope,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Your Savvy account is ready. Start unlocking student-only deals and perks.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #27272a;border-radius:28px;overflow:hidden;background:#0b0b0e;">
          <tr><td style="padding:36px 38px 18px;background:#11111a;">
            <div style="font-size:12px;letter-spacing:2.4px;color:#a5b4fc;font-weight:800;">SAVVY CAMPUS</div>
            <h1 style="margin:20px 0 12px;font-family:Outfit,Arial,sans-serif;font-size:42px;line-height:1.05;letter-spacing:-1.2px;">You&rsquo;re in, {first_name}.<br />No gatekeeping. ✨</h1>
            <p style="margin:0;color:#c4c4cc;font-size:16px;line-height:1.7;">Your student budget just got a glow-up. Savvy puts online perks, nearby deals and members-only savings in one place.</p>
          </td></tr>
          <tr><td style="padding:12px 38px 34px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:10px 0 24px;border:1px solid #3730a3;border-radius:18px;background:#17172a;">
              <tr><td style="padding:20px;">
                <div style="font-size:12px;letter-spacing:1.6px;color:#a5b4fc;font-weight:800;">WELCOME DROP</div>
                <div style="margin-top:6px;font-family:Outfit,Arial,sans-serif;font-size:25px;font-weight:800;">100 Savvy Points are already yours</div>
                <div style="margin-top:6px;color:#a1a1aa;font-size:14px;line-height:1.6;">Complete student verification next to unlock even more points and verified-only offers.</div>
              </td></tr>
            </table>
            <div style="font-family:Outfit,Arial,sans-serif;font-size:20px;font-weight:800;margin-bottom:14px;">Here&rsquo;s the vibe</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="color:#d4d4d8;font-size:15px;line-height:1.65;">
              <tr><td width="28" valign="top" style="color:#818cf8;">01</td><td style="padding-bottom:12px;"><strong style="color:#fff;">Verify your student status</strong><br />Get your digital student pass and unlock verified-only perks.</td></tr>
              <tr><td width="28" valign="top" style="color:#818cf8;">02</td><td style="padding-bottom:12px;"><strong style="color:#fff;">Find deals worth the screenshot</strong><br />Browse brand offers and nearby campus favourites.</td></tr>
              <tr><td width="28" valign="top" style="color:#818cf8;">03</td><td><strong style="color:#fff;">Save, claim, repeat</strong><br />Keep coupons and favourites together. Low-key organised, high-key useful.</td></tr>
            </table>
            <a href="{verify_url}" style="display:block;margin-top:28px;padding:15px 22px;border-radius:999px;background:#ffffff;color:#09090b;text-decoration:none;text-align:center;font-weight:800;">Unlock my student perks →</a>
            <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.6;">Need a hand? We&rsquo;ve got you. Visit <a href="{support_url}" style="color:#a5b4fc;">Savvy Support</a> to reach our team.</p>
          </td></tr>
          <tr><td style="padding:22px 38px;border-top:1px solid #27272a;color:#71717a;font-size:11px;line-height:1.7;">
            You received this transactional email because you created and verified a Savvy Campus account.<br />
            <a href="{terms_url}" style="color:#a1a1aa;">Terms</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="{privacy_url}" style="color:#a1a1aa;">Privacy</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="{support_url}" style="color:#a1a1aa;">Support</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def account_deleted_email_html(user: dict) -> str:
    """Render the final transactional email after permanent account deletion."""
    first_name = html.escape(welcome_email_first_name(user))
    homepage_url = FRONTEND_URL.rstrip("/")
    support_url = f"{homepage_url}/support"
    return f"""<!doctype html>
<html lang="en">
  <body style="margin:0;background:#050505;color:#ffffff;font-family:Manrope,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Your Savvy Campus account has been permanently deleted.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #27272a;border-radius:28px;overflow:hidden;background:#0b0b0e;">
          <tr><td style="padding:38px 38px 22px;background:linear-gradient(145deg,#17172a,#111116);">
            <div style="font-size:12px;letter-spacing:2.4px;color:#a5b4fc;font-weight:800;">SAVVY CAMPUS</div>
            <h1 style="margin:20px 0 12px;font-family:Outfit,Arial,sans-serif;font-size:40px;line-height:1.08;letter-spacing:-1px;">We&rsquo;re sad to see you go, {first_name}.</h1>
            <p style="margin:0;color:#c4c4cc;font-size:16px;line-height:1.7;">Your Savvy account has been permanently deleted, along with its associated account data and verification images.</p>
          </td></tr>
          <tr><td style="padding:26px 38px 34px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #312e81;border-radius:18px;background:#151524;">
              <tr><td style="padding:20px;color:#d4d4d8;font-size:14px;line-height:1.7;">
                You will no longer be able to sign in with this account. If you ever want to discover student deals with us again, you&rsquo;re always welcome to create a new account.
              </td></tr>
            </table>
            <a href="{homepage_url}" style="display:block;margin-top:24px;padding:14px 20px;border-radius:999px;background:#ffffff;color:#09090b;text-decoration:none;text-align:center;font-weight:800;">Visit Savvy Campus</a>
            <p style="margin:22px 0 0;color:#71717a;font-size:13px;line-height:1.6;">Didn&rsquo;t request this deletion or need help? Contact us through <a href="{support_url}" style="color:#a5b4fc;">Savvy Support</a>.</p>
          </td></tr>
          <tr><td style="padding:20px 38px;border-top:1px solid #27272a;color:#71717a;font-size:11px;line-height:1.7;">
            This is the final transactional email for your deleted Savvy Campus account. No action is required.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


async def send_welcome_email_once(user: dict) -> dict:
    """Claim and send a signup welcome email once, without blocking verification."""
    if not user.get("welcome_email_eligible") or user.get("welcome_email_sent_at"):
        return {"ok": True, "skipped": True, "error": None}

    now = datetime.now(timezone.utc)
    claimed = await db.users.find_one_and_update(
        {
            "_id": user["_id"],
            "welcome_email_eligible": True,
            "welcome_email_sent_at": {"$exists": False},
            "welcome_email_sending_at": {"$exists": False},
        },
        {
            "$set": {"welcome_email_sending_at": now},
            "$inc": {"welcome_email_attempts": 1},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        return {"ok": True, "skipped": True, "error": None}

    first_name = welcome_email_first_name(claimed)
    result = send_email(
        claimed["email"],
        f"You’re in, {first_name} — welcome to Savvy ✨",
        welcome_email_html(claimed),
    )
    if result["ok"]:
        await db.users.update_one(
            {"_id": claimed["_id"], "welcome_email_sending_at": now},
            {
                "$set": {"welcome_email_sent_at": datetime.now(timezone.utc)},
                "$unset": {
                    "welcome_email_sending_at": "",
                    "welcome_email_last_error": "",
                },
            },
        )
    else:
        await db.users.update_one(
            {"_id": claimed["_id"], "welcome_email_sending_at": now},
            {
                "$set": {"welcome_email_last_error": result["error"]},
                "$unset": {"welcome_email_sending_at": ""},
            },
        )
    return {**result, "skipped": False}


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


def create_public_pass_token(user: dict) -> str:
    """Create a compact signed token without exposing student details."""
    user_id = user.get("_id")
    if not isinstance(user_id, ObjectId):
        raise ValueError("A valid student ID is required")
    encoded_id = base64.urlsafe_b64encode(user_id.binary).decode().rstrip("=")
    signature = hmac.new(
        JWT_SECRET.encode(),
        f"student-pass:{encoded_id}".encode(),
        hashlib.sha256,
    ).digest()[:16]
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{encoded_id}.{encoded_signature}"


def decode_public_pass_token(token: str) -> ObjectId:
    """Validate a public pass token and return its bound user ID."""
    try:
        encoded_id, encoded_signature = token.split(".", 1)
        expected_signature = hmac.new(
            JWT_SECRET.encode(),
            f"student-pass:{encoded_id}".encode(),
            hashlib.sha256,
        ).digest()[:16]
        supplied_signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if (
            base64.urlsafe_b64encode(supplied_signature).decode().rstrip("=")
            != encoded_signature
        ):
            raise ValueError
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise ValueError
        raw_id = base64.urlsafe_b64decode(
            encoded_id + "=" * (-len(encoded_id) % 4)
        )
        if base64.urlsafe_b64encode(raw_id).decode().rstrip("=") != encoded_id:
            raise ValueError
        if len(raw_id) != 12:
            raise ValueError
        return ObjectId(raw_id)
    except Exception:
        raise HTTPException(404, "Student pass not found") from None


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
    avatar_key: Optional[str] = None


class DeleteAccountIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    confirmation: str = Field(min_length=1, max_length=20)


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


class AdminPartnerCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    outlet_id: str = Field(min_length=24, max_length=24)


class AdminPartnerStatusIn(BaseModel):
    active: bool


class FreshersCampaignUpdateIn(BaseModel):
    opens_at: Optional[datetime] = None
    closes_at: Optional[datetime] = None
    verification_deadline: Optional[datetime] = None
    manual_status: Optional[str] = Field(default=None, max_length=20)
    gog_offer: Optional[str] = Field(default=None, max_length=500)
    gog_discount_offer: Optional[str] = Field(default=None, max_length=500)
    s_cafe_offer: Optional[str] = Field(default=None, max_length=500)
    big_bite_offer: Optional[str] = Field(default=None, max_length=1000)
    pickup_location: Optional[str] = Field(default=None, max_length=500)
    goodies_description: Optional[str] = Field(default=None, max_length=300)
    rewards_enabled: Optional[bool] = None


class FreshersStaffCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class FreshersScanIn(BaseModel):
    payload: str = Field(min_length=4, max_length=1000)


class AdminAnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=2, max_length=600)
    category: str = Field(default="new", max_length=20)
    audience: str = Field(default="students", max_length=20)
    priority: int = Field(default=1, ge=0, le=2)
    cta_label: Optional[str] = Field(default="", max_length=40)
    cta_url: Optional[str] = Field(default="", max_length=300)
    image_url: Optional[str] = Field(default="", max_length=1000)
    starts_at: Optional[datetime] = None
    published: bool = False


class AdminEmailCampaignIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    subject: str = Field(min_length=2, max_length=150)
    preview_text: Optional[str] = Field(default="", max_length=180)
    heading: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=2, max_length=2000)
    eyebrow: Optional[str] = Field(default="SAVVY CAMPUS UPDATE", max_length=60)
    cta_label: Optional[str] = Field(default="", max_length=40)
    cta_url: Optional[str] = Field(default="", max_length=300)
    image_url: Optional[str] = Field(default="", max_length=1000)
    audience: str = Field(default="approved_students", max_length=40)
    scheduled_at: Optional[datetime] = None
    background_color: str = Field(default="#050706", max_length=7)
    card_color: str = Field(default="#083f46", max_length=7)
    accent_color: str = Field(default="#2dd4bf", max_length=7)
    text_color: str = Field(default="#ffffff", max_length=7)
    muted_color: str = Field(default="#c7dedb", max_length=7)
    button_text_color: str = Field(default="#042f2e", max_length=7)
    corner_style: str = Field(default="rounded", max_length=20)


class AdminEmailCampaignTestIn(BaseModel):
    email: EmailStr


class AdminEmailCampaignLaunchIn(BaseModel):
    recipient_count: int = Field(ge=0)
    confirmation: str = Field(min_length=4, max_length=20)


class OtpVerifyIn(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class OtpResendIn(BaseModel):
    email: EmailStr


class EmailChangeIn(BaseModel):
    email: EmailStr


# -----------------------------
# KIET Freshers 2026 campaign
# -----------------------------
FRESHERS_CAMPAIGN_SLUG = "kiet-freshers-2026"
FRESHERS_DOMAIN = "kiet.edu"
FRESHERS_COUPON_LIMIT = 200
FRESHERS_GOODIES_LIMIT = 400
FRESHERS_VALIDITY_DAYS = 7
FRESHERS_GRACE_MINUTES = 10
_freshers_worker_task: Optional[asyncio.Task] = None


def freshers_campaign_status(campaign: dict, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    manual = campaign.get("manual_status", "scheduled")
    if manual in {"paused", "closed"}:
        return manual
    if now < _aware(campaign["opens_at"]):
        return "scheduled"
    if now <= _aware(campaign["closes_at"]):
        return "live"
    if now <= _aware(campaign["grace_ends_at"]):
        return "grace"
    return "closed"


async def get_freshers_campaign() -> Optional[dict]:
    collection = getattr(db, "freshers_campaigns", None)
    if collection is None:
        return None
    return await collection.find_one({"slug": FRESHERS_CAMPAIGN_SLUG})


def freshers_tier(position: int) -> str:
    if position <= FRESHERS_COUPON_LIMIT:
        return "cafe_and_goodies"
    if position <= FRESHERS_GOODIES_LIMIT:
        return "goodies"
    return "waitlist"


def freshers_cafe(position: int) -> Optional[str]:
    if position > FRESHERS_COUPON_LIMIT:
        return None
    if position <= 50:
        return "big_bite"
    # Continue alternating GOG/S Cafe for every remaining coupon position.
    return "gog" if position % 2 else "s_cafe"


def _freshers_code(prefix: str) -> str:
    return f"{prefix}-{secrets.token_urlsafe(12).replace('_', '').replace('-', '').upper()}"


async def enroll_freshers_student(user: dict) -> Optional[dict]:
    """Reserve a race-safe campaign position after signup OTP verification."""
    campaign = await get_freshers_campaign()
    if not campaign or freshers_campaign_status(campaign) not in {"live", "grace"}:
        return None
    now = datetime.now(timezone.utc)
    created_at = _aware(user.get("created_at"))
    email_domain = user.get("email", "").rsplit("@", 1)[-1].lower()
    if (
        email_domain != FRESHERS_DOMAIN
        or not created_at
        or created_at < _aware(campaign["opens_at"])
        or created_at > _aware(campaign["closes_at"])
        or now > _aware(campaign["grace_ends_at"])
    ):
        return None
    existing = await db.freshers_participants.find_one(
        {"campaign_id": campaign["_id"], "user_id": user["_id"]}
    )
    if existing:
        return existing

    # The unique user index makes retries idempotent. A rare failed insert may
    # leave a harmless position gap, but can never over-allocate a reward slot.
    sequenced = await db.freshers_campaigns.find_one_and_update(
        {"_id": campaign["_id"], "manual_status": {"$ne": "paused"}},
        {"$inc": {"next_position": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not sequenced:
        return None
    position = int(sequenced.get("next_position", 0))
    participant = {
        "campaign_id": campaign["_id"],
        "user_id": user["_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "position": position,
        "reward_slot": position if position <= FRESHERS_GOODIES_LIMIT else None,
        "tier": freshers_tier(position),
        "cafe": freshers_cafe(position),
        "status": "reserved" if position <= FRESHERS_GOODIES_LIMIT else "waitlisted",
        "otp_verified_at": now,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.freshers_participants.insert_one(participant)
        participant["_id"] = result.inserted_id
    except DuplicateKeyError:
        return await db.freshers_participants.find_one(
            {"campaign_id": campaign["_id"], "user_id": user["_id"]}
        )
    await db.freshers_email_jobs.update_one(
        {"participant_id": participant["_id"], "kind": "reservation"},
        {
            "$setOnInsert": {
                "participant_id": participant["_id"],
                "kind": "reservation",
                "status": "pending",
                "deliver_at": now + timedelta(minutes=5),
                "created_at": now,
                "attempts": 0,
            }
        },
        upsert=True,
    )
    return participant


async def _freshers_outlet(cafe: str) -> Optional[dict]:
    pattern = {
        "gog": r"^GOG Cafe",
        "s_cafe": r"^S Cafe$",
        "big_bite": r"^The Big Bite Co\.$",
    }.get(cafe, r"a^")
    return await db.outlets.find_one({"name": {"$regex": pattern, "$options": "i"}})


def _freshers_offer(cafe: str, campaign: dict, position: Optional[int] = None) -> str:
    if cafe == "big_bite":
        return campaign.get("big_bite_offer", "")
    if cafe == "gog":
        # GOG positions are the odd reward slots from 51 through 199. The first
        # 30 such students occupy slots 51–109; the other 45 occupy 111–199.
        if position is not None and position >= 111:
            return campaign.get(
                "gog_discount_offer",
                "15% off on a purchase of ₹350 at GOG Cafe & Bakers.",
            )
        return campaign.get("gog_offer", "")
    return campaign.get("s_cafe_offer", "")


async def unlock_freshers_reward(user: dict) -> Optional[dict]:
    """Issue passes once a reserved KIET student completes full verification."""
    if effective_verification_status(user) != "approved":
        return None
    campaign = await get_freshers_campaign()
    participants = getattr(db, "freshers_participants", None)
    if not campaign or participants is None:
        return None
    participant = await participants.find_one(
        {"campaign_id": campaign["_id"], "user_id": user["_id"]}
    )
    if not participant:
        return None
    if not campaign.get("rewards_enabled", False):
        await db.freshers_participants.update_one(
            {"_id": participant["_id"]},
            {"$set": {"full_verification_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
        )
        return await db.freshers_participants.find_one({"_id": participant["_id"]})
    if participant.get("status") == "waitlisted":
        await db.freshers_participants.update_one(
            {"_id": participant["_id"], "status": "waitlisted"},
            {"$set": {"full_verification_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}},
        )
        return await db.freshers_participants.find_one({"_id": participant["_id"]})
    if participant.get("status") not in {"reserved", "promoted"}:
        return participant
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=FRESHERS_VALIDITY_DAYS)
    goodies_code = participant.get("goodies_code") or _freshers_code("KFG")
    cafe_code = participant.get("cafe_code")
    outlet = None
    if participant.get("tier") == "cafe_and_goodies":
        cafe_code = cafe_code or _freshers_code("KFC")
        outlet = await _freshers_outlet(participant["cafe"])
    updates = {
        "status": "unlocked",
        "full_verification_at": now,
        "passes_issued_at": now,
        "expires_at": expires_at,
        "goodies_code": goodies_code,
        "goodies_qr_data_uri": generate_qr_data_uri(
            f"{FRONTEND_URL.rstrip('/')}/event-staff/scan?g={goodies_code}"
        ),
        "goodies_status": "active",
        "updated_at": now,
    }
    if cafe_code:
        updates.update(
            {
                "cafe_code": cafe_code,
                "cafe_qr_data_uri": generate_qr_data_uri(
                    f"{FRONTEND_URL.rstrip('/')}/scan?f={cafe_code}"
                ),
                "cafe_status": "active",
                "cafe_outlet_id": outlet.get("_id") if outlet else None,
                "cafe_name": "GOG Cafe & Bakers" if participant["cafe"] == "gog" else outlet.get("name", "") if outlet else (
                    "The Big Bite Co." if participant["cafe"] == "big_bite"
                    else "S Cafe"
                ),
                "cafe_address": outlet.get("address", "") if outlet else "",
                "cafe_offer": _freshers_offer(
                    participant["cafe"],
                    campaign,
                    participant.get("reward_slot") or participant.get("position"),
                ),
            }
        )
    await db.freshers_participants.update_one(
        {"_id": participant["_id"], "status": {"$in": ["reserved", "promoted"]}},
        {"$set": updates},
    )
    fresh = await db.freshers_participants.find_one({"_id": participant["_id"]})
    await db.freshers_email_jobs.update_one(
        {"participant_id": participant["_id"], "kind": "reward"},
        {
            "$setOnInsert": {
                "participant_id": participant["_id"],
                "kind": "reward",
                "status": "pending",
                "deliver_at": max(
                    now,
                    _aware(participant.get("otp_verified_at")) + timedelta(minutes=5),
                ),
                "created_at": now,
                "attempts": 0,
            }
        },
        upsert=True,
    )
    return fresh


def serialize_freshers_participant(participant: dict, campaign: dict) -> dict:
    cafe_name = participant.get("cafe_name") or (
        "The Big Bite Co." if participant.get("cafe") == "big_bite"
        else "GOG Cafe & Bakers" if participant.get("cafe") == "gog"
        else "S Cafe"
    )
    offer = participant.get("cafe_offer") or (
        _freshers_offer(
            participant.get("cafe"),
            campaign,
            participant.get("reward_slot") or participant.get("position"),
        )
    )
    return {
        "id": str(participant["_id"]),
        "position": participant.get("position"),
        "reward_slot": participant.get("reward_slot"),
        "tier": participant.get("tier"),
        "status": participant.get("status"),
        "cafe": participant.get("cafe"),
        "cafe_name": cafe_name if participant.get("cafe") else None,
        "cafe_address": participant.get("cafe_address", "") if participant.get("cafe") else None,
        "offer": offer if participant.get("cafe") else None,
        "goodies_description": campaign.get("goodies_description", "Savvy stickers and pamphlet"),
        "rewards_enabled": campaign.get("rewards_enabled", False),
        "pickup_location": campaign.get("pickup_location", ""),
        "expires_at": _admin_datetime(participant.get("expires_at")),
        "goodies_code": participant.get("goodies_code"),
        "goodies_qr_data_uri": participant.get("goodies_qr_data_uri", ""),
        "goodies_status": participant.get("goodies_status"),
        "goodies_collected_at": _admin_datetime(participant.get("goodies_collected_at")),
        "cafe_code": participant.get("cafe_code"),
        "cafe_qr_data_uri": participant.get("cafe_qr_data_uri", ""),
        "cafe_status": participant.get("cafe_status"),
        "cafe_redeemed_at": _admin_datetime(participant.get("cafe_redeemed_at")),
    }


def freshers_email_html(participant: dict, campaign: dict, *, reservation: bool) -> str:
    first_name = html.escape((participant.get("name") or "Student").split()[0])
    position = participant.get("position")
    if reservation and participant.get("status") == "waitlisted":
        heading = "You’re on the Freshers rewards waitlist"
        body = "Your KIET registration is confirmed. Complete student verification and we’ll automatically notify you if an earlier reward reservation opens up."
        qr_block = ""
    elif reservation and participant.get("status") != "unlocked":
        heading = f"Reward position #{position} is reserved"
        body = (
            "Your verification is complete and your reward is secured. Your QR passes are being prepared and will appear in your Savvy account shortly."
            if participant.get("full_verification_at")
            else "Complete the full Savvy student-verification flow to unlock your event passes. Your reservation is currently held for you."
        )
        qr_block = ""
    elif participant.get("status") == "missed":
        heading = "Welcome to Savvy — you just missed the first 400"
        body = "The limited KIET Freshers rewards have now been claimed, but your Savvy account is ready for student deals across campus."
        qr_block = ""
    else:
        heading = f"Congratulations — you registered at #{position}"
        body = "Your KIET Freshers reward is unlocked. Keep these passes private and show each one only to the correct staff member."
        blocks = []
        if participant.get("cafe_code"):
            cafe_name = participant.get("cafe_name") or (
                "The Big Bite Co." if participant.get("cafe") == "big_bite"
                else "GOG Cafe & Bakers" if participant.get("cafe") == "gog"
                else "S Cafe"
            )
            offer = participant.get("cafe_offer") or (
                _freshers_offer(
                    participant.get("cafe"),
                    campaign,
                    participant.get("reward_slot") or participant.get("position"),
                )
            )
            cafe_address = participant.get("cafe_address", "")
            address_line = (
                f'<p style="color:#52525b"><b>Address:</b> {html.escape(cafe_address)}</p>'
                if cafe_address
                else ""
            )
            blocks.append(f'<div style="margin-top:22px;padding:20px;background:#fff;color:#111;border-radius:18px;text-align:center"><b>{html.escape(cafe_name)} coupon</b><p>{html.escape(offer)}</p>{address_line}<img src="cid:freshers-cafe-qr" width="190" alt="Cafe coupon QR" /><p style="font-family:monospace">{html.escape(participant["cafe_code"])}</p></div>')
        pickup = campaign.get("pickup_location") or "Pickup details will be shared in your Savvy account."
        blocks.append(f'<div style="margin-top:22px;padding:20px;background:#fff;color:#111;border-radius:18px;text-align:center"><b>Goodies pickup pass</b><p>{html.escape(campaign.get("goodies_description", "Savvy stickers and pamphlet"))}</p><p style="color:#52525b">{html.escape(pickup)}</p><img src="cid:freshers-goodies-qr" width="190" alt="Goodies pickup QR" /><p style="font-family:monospace">{html.escape(participant["goodies_code"])}</p></div>')
        qr_block = "".join(blocks)
    expiry = _aware(participant.get("expires_at"))
    expiry_text = expiry.astimezone(INDIA_TIMEZONE).strftime("%d %B %Y, %I:%M %p IST") if expiry else ""
    return f'''<!doctype html><html><body style="margin:0;background:#050505;color:#fff;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:36px 18px"><div style="padding:32px;border:1px solid #4f46e5;border-radius:24px;background:#111126"><div style="color:#a5b4fc;font-size:12px;letter-spacing:2px">KIET FRESHERS 2026</div><h1>{heading}</h1><p>Hey {first_name},</p><p style="color:#d4d4d8;line-height:1.7">{body}</p>{qr_block}{f'<p style="margin-top:20px;color:#a1a1aa">Both passes expire on {expiry_text} and can be used once.</p>' if expiry_text else ''}<a href="{FRONTEND_URL.rstrip('/')}/freshers-reward" style="display:inline-block;margin-top:22px;padding:13px 20px;background:#a5b4fc;color:#111;border-radius:999px;text-decoration:none;font-weight:bold">View in Savvy</a></div></div></body></html>'''


async def _send_freshers_job(job: dict) -> None:
    participant = await db.freshers_participants.find_one({"_id": job["participant_id"]})
    campaign = await get_freshers_campaign()
    if not participant or not campaign:
        outcome = {"ok": False, "error": "campaign_record_missing"}
    else:
        reservation = job["kind"] == "reservation"
        # Avoid a weaker reservation email after the reward has already unlocked.
        if reservation and (
            participant.get("reward_email_sent_at")
            or participant.get("status") == "unlocked"
        ):
            outcome = {"ok": True, "error": None}
        else:
            attachments = []
            if not reservation and participant.get("goodies_qr_data_uri"):
                attachments.append({"content": participant["goodies_qr_data_uri"].split(",", 1)[1], "filename": "goodies-pass.png", "content_id": "freshers-goodies-qr"})
            if not reservation and participant.get("cafe_qr_data_uri"):
                attachments.append({"content": participant["cafe_qr_data_uri"].split(",", 1)[1], "filename": "cafe-coupon.png", "content_id": "freshers-cafe-qr"})
            subject = f"KIET Freshers: your position is #{participant.get('position')}"
            outcome = await asyncio.to_thread(send_email, participant["email"], subject, freshers_email_html(participant, campaign, reservation=reservation), attachments)
    now = datetime.now(timezone.utc)
    await db.freshers_email_jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {"status": "sent" if outcome["ok"] else "failed", "sent_at": now if outcome["ok"] else None, "error": outcome.get("error") or ""}, "$inc": {"attempts": 1}},
    )
    if participant and outcome["ok"]:
        field = "reservation_email_sent_at" if job["kind"] == "reservation" else "reward_email_sent_at"
        await db.freshers_participants.update_one({"_id": participant["_id"]}, {"$set": {field: now}})


async def _queue_freshers_outcome(participant_id: ObjectId, kind: str = "reward") -> None:
    now = datetime.now(timezone.utc)
    await db.freshers_email_jobs.update_one(
        {"participant_id": participant_id, "kind": kind},
        {"$setOnInsert": {"participant_id": participant_id, "kind": kind, "status": "pending", "deliver_at": now, "created_at": now, "attempts": 0}},
        upsert=True,
    )


async def finalize_freshers_waitlist() -> None:
    campaign = await get_freshers_campaign()
    now = datetime.now(timezone.utc)
    verification_deadline = _aware(campaign.get("verification_deadline")) if campaign else None
    if (
        not campaign
        or campaign.get("finalized_at")
        or not verification_deadline
        or now <= verification_deadline
    ):
        return
    locked = await db.freshers_campaigns.update_one(
        {"_id": campaign["_id"], "finalized_at": {"$exists": False}, "finalizing_at": {"$exists": False}},
        {"$set": {"finalizing_at": now}},
    )
    if not locked.matched_count:
        return
    base = {"campaign_id": campaign["_id"]}
    expired = await db.freshers_participants.find(
        {**base, "reward_slot": {"$lte": FRESHERS_GOODIES_LIMIT}, "status": "reserved"}
    ).sort("reward_slot", 1).to_list(FRESHERS_GOODIES_LIMIT)
    vacant_slots = [item["reward_slot"] for item in expired]
    for item in expired:
        await db.freshers_participants.update_one(
            {"_id": item["_id"], "status": "reserved"},
            {"$set": {"status": "missed", "reward_slot": None, "tier": "missed", "updated_at": now}},
        )
        await _queue_freshers_outcome(item["_id"])
    waitlisted = await db.freshers_participants.find(
        {**base, "status": "waitlisted", "full_verification_at": {"$exists": True}}
    ).sort("position", 1).to_list(len(vacant_slots))
    for participant, slot in zip(waitlisted, vacant_slots):
        await db.freshers_participants.update_one(
            {"_id": participant["_id"], "status": "waitlisted"},
            {"$set": {"status": "promoted", "reward_slot": slot, "tier": freshers_tier(slot), "cafe": freshers_cafe(slot), "promoted_at": now, "updated_at": now}},
        )
        user = await db.users.find_one({"_id": participant["user_id"]})
        if user:
            await unlock_freshers_reward(user)
    remaining = await db.freshers_participants.find({**base, "status": "waitlisted"}, {"_id": 1}).to_list(None)
    if remaining:
        ids = [item["_id"] for item in remaining]
        await db.freshers_participants.update_many(
            {"_id": {"$in": ids}, "status": "waitlisted"},
            {"$set": {"status": "missed", "tier": "missed", "updated_at": now}},
        )
        for participant_id in ids:
            await _queue_freshers_outcome(participant_id)
    await db.freshers_campaigns.update_one(
        {"_id": campaign["_id"], "finalizing_at": now},
        {"$set": {"finalized_at": datetime.now(timezone.utc)}, "$unset": {"finalizing_at": ""}},
    )


async def _freshers_job_worker() -> None:
    while True:
        try:
            await finalize_freshers_waitlist()
            now = datetime.now(timezone.utc)
            job = await db.freshers_email_jobs.find_one_and_update(
                {"status": {"$in": ["pending", "failed"]}, "deliver_at": {"$lte": now}, "attempts": {"$lt": 4}},
                {"$set": {"status": "sending", "attempted_at": now}},
                sort=[("deliver_at", 1)],
                return_document=ReturnDocument.AFTER,
            )
            if job:
                await _send_freshers_job(job)
                continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Freshers campaign worker failed")
        await asyncio.sleep(10)


# -----------------------------
# Auth Routes
# -----------------------------
async def issue_email_otp(
    user: dict,
    *,
    purpose: str,
    subject: str = "Your SavvyCampusDeals verification code",
) -> tuple[dict, str]:
    now = datetime.now(timezone.utc)
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.update_many(
        {"user_id": user["_id"], "used": False},
        {"$set": {"used": True}},
    )
    await db.otp_codes.insert_one(
        {
            "user_id": user["_id"],
            "email": user["email"],
            "otp": otp,
            "purpose": purpose,
            "attempts": 0,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now,
        }
    )
    email_result = send_email(
        user["email"],
        subject,
        f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
        <p>Enter this code to verify your email:</p>
        <div style="margin:16px 0;padding:20px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.4);border-radius:16px;text-align:center">
          <div style="font-family:monospace;font-size:40px;letter-spacing:12px;font-weight:800;color:#a5b4fc">{otp}</div>
        </div>
        <p style="color:#71717A;font-size:12px">Expires in 10 minutes.</p>
        </div>""",
    )
    logger.info(
        "OTP issued for user %s (purpose: %s, email delivery: %s)",
        user["_id"],
        purpose,
        email_result["ok"],
    )
    return email_result, otp


def otp_response(email_result: dict, otp: str, **extra) -> dict:
    response = {"ok": True, "email_sent": email_result["ok"], **extra}
    if DEV_OTP_FALLBACK and not email_result["ok"]:
        response["dev_otp"] = otp
        response["email_error"] = email_result["error"]
    return response


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
        "avatar_key": "",
        "email_verified": False,
        "welcome_email_eligible": True,
        "welcome_email_attempts": 0,
        "email_verify_token": verify_token,
        "verification_status": "not_submitted",
        "student_number": "",
        "verification_expiry": None,
        "savvy_points_balance": welcome_points,
        "savvy_points_lifetime": welcome_points,
        "reward_points": welcome_points,
        "referral_code": gen_ref_code(body.name),
        "referred_by": ref_code_raw if referrer else "",
        "referrer_id": referrer["_id"] if referrer else None,
        "created_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    await db.savvy_points_transactions.insert_one(
        {
            "user_id": result.inserted_id,
            "amount": welcome_points,
            "event_type": "welcome",
            "source_id": str(result.inserted_id),
            "event_key": f"welcome:{result.inserted_id}:{result.inserted_id}",
            "title": "Welcome to Savvy",
            "description": "Your first Savvy Points are ready. Get verified to earn more.",
            "status": "earned",
            "created_at": now,
        }
    )

    # Record the relationship now; both bonuses unlock after student verification.
    if referrer:
        await db.referrals.insert_one(
            {
                "referrer_id": referrer["_id"],
                "referrer_email": referrer["email"],
                "referred_id": result.inserted_id,
                "referred_email": email,
                "status": "pending",
                "points_awarded": 0,
                "referred_points_awarded": 0,
                "reward_points_each": 100,
                "qualified_at": None,
                "created_at": now,
            }
        )

    # Generate and send OTP (6-digit)
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.insert_one(
        {
            "user_id": result.inserted_id,
            "email": email,
            "otp": otp,
            "purpose": "signup",
            "attempts": 0,
            "expires_at": now + timedelta(minutes=10),
            "used": False,
            "created_at": now,
        }
    )
    email_result = send_email(
        email,
        "Your SavvyCampusDeals verification code",
        f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
        <h1 style="font-family:Outfit,sans-serif;font-weight:800">Welcome, {body.name}!</h1>
        <p style="color:#a1a1aa">Enter this 6-digit code on the site to verify your email — expires in 10 minutes.</p>
        <div style="margin:24px 0;padding:20px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.4);border-radius:16px;text-align:center">
          <div style="font-family:'JetBrains Mono',monospace;font-size:40px;letter-spacing:12px;font-weight:800;color:#a5b4fc">{otp}</div>
        </div>
        <p style="color:#71717A;font-size:12px">If you didn't create an account, ignore this email.</p>
        </div>""",
    )
    logger.info(
        "Signup OTP issued for user %s (email delivery: %s)",
        result.inserted_id,
        email_result["ok"],
    )

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
    purpose = (
        "reverification"
        if effective_verification_status(user) == "expired"
        else "signup"
    )
    email_result, otp = await issue_email_otp(user, purpose=purpose)
    return otp_response(email_result, otp)


@api.post("/auth/start-reverification")
async def start_reverification(user=Depends(get_current_user)):
    if user.get("role", "student") != "student":
        raise HTTPException(403, "Student account required")
    if effective_verification_status(user) != "expired":
        raise HTTPException(409, "Student verification is not expired")

    now = datetime.now(timezone.utc)
    started_at = user.get("reverification_started_at")
    if (
        started_at
        and (now - _aware(started_at)).total_seconds() < 60
    ):
        raise HTTPException(
            429,
            "Please wait a minute before requesting another code.",
        )
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "email_verified": False,
                "reverification_started_at": now,
            },
            "$unset": {"reverification_email_verified_at": ""},
        },
    )
    pending_user = {
        **user,
        "email_verified": False,
        "reverification_started_at": now,
    }
    pending_user.pop("reverification_email_verified_at", None)
    try:
        email_result, otp = await issue_email_otp(
            pending_user,
            purpose="reverification",
            subject="Renew your SavvyCampusDeals student verification",
        )
    except Exception:
        await db.users.update_one(
            {"_id": user["_id"], "reverification_started_at": now},
            {
                "$set": {"email_verified": True},
                "$unset": {"reverification_started_at": ""},
            },
        )
        raise HTTPException(
            503,
            "Renewal could not be started. Please try again.",
        ) from None
    return otp_response(
        email_result,
        otp,
        user=serialize_user(pending_user),
    )


@api.post("/auth/change-email")
async def change_pending_email(
    body: EmailChangeIn,
    response: Response,
    user=Depends(get_current_user),
):
    if user.get("role", "student") != "student":
        raise HTTPException(403, "Student account required")
    if user.get("email_verified"):
        raise HTTPException(
            409,
            "Email can only be changed while email verification is pending.",
        )

    new_email = body.email.lower().strip()
    old_email = user["email"]
    now = datetime.now(timezone.utc)
    changed_at = user.get("email_changed_at")
    if changed_at and (now - _aware(changed_at)).total_seconds() < 60:
        raise HTTPException(
            429,
            "Please wait a minute before changing the email again.",
        )
    if new_email == old_email:
        raise HTTPException(400, "Enter a different email address")
    if await db.users.find_one({"email": new_email}, {"_id": 1}):
        raise HTTPException(409, "Email already registered")

    try:
        update_result = await db.users.update_one(
            {"_id": user["_id"], "email": old_email},
            {
                "$set": {
                    "email": new_email,
                    "email_verified": False,
                    "email_changed_at": now,
                },
                "$unset": {"email_verify_token": ""},
            },
        )
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered") from None
    if not update_result.matched_count:
        raise HTTPException(409, "Email changed in another session. Refresh and retry.")

    changed_user = {**user, "email": new_email, "email_verified": False}
    purpose = (
        "reverification"
        if effective_verification_status(changed_user) == "expired"
        else "signup"
    )
    try:
        email_result, otp = await issue_email_otp(
            changed_user,
            purpose=purpose,
        )
    except Exception:
        await db.users.update_one(
            {"_id": user["_id"], "email": new_email},
            {"$set": {"email": old_email}},
        )
        raise HTTPException(
            503,
            "Email could not be changed. Please try again.",
        ) from None

    token = create_access_token(str(user["_id"]), new_email, "student")
    set_auth_cookie(response, token)
    return otp_response(
        email_result,
        otp,
        user=serialize_user(changed_user),
        token=token,
    )


@api.post("/auth/verify-otp")
async def verify_otp(body: OtpVerifyIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "No account with that email")
    if user.get("email_verified"):
        welcome_result = await send_welcome_email_once(user)
        freshers_entry = await enroll_freshers_student(user)
        return {
            "ok": True,
            "already_verified": True,
            "user": serialize_user(user),
            "welcome_email_sent": welcome_result["ok"],
            "freshers_position": freshers_entry.get("position") if freshers_entry else None,
        }
    doc = await db.otp_codes.find_one(
        {"user_id": user["_id"], "used": False},
        sort=[("created_at", -1)],
    )
    if not doc:
        raise HTTPException(400, "Invalid code")
    if _aware(doc["expires_at"]) < datetime.now(timezone.utc):
        await db.otp_codes.update_one(
            {"_id": doc["_id"]},
            {"$set": {"used": True}},
        )
        raise HTTPException(400, "Code has expired. Request a new one.")
    if not secrets.compare_digest(str(doc.get("otp", "")), body.otp):
        attempts = int(doc.get("attempts", 0)) + 1
        update = {"$inc": {"attempts": 1}}
        if attempts >= 5:
            update["$set"] = {"used": True}
        await db.otp_codes.update_one({"_id": doc["_id"]}, update)
        if attempts >= 5:
            raise HTTPException(
                429,
                "Too many incorrect attempts. Request a new code.",
            )
        raise HTTPException(400, "Invalid code")
    await db.otp_codes.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    user_updates = {"email_verified": True}
    if effective_verification_status(user) == "expired":
        user_updates["reverification_email_verified_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": user_updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    welcome_result = (
        await send_welcome_email_once(fresh)
        if doc.get("purpose", "signup") == "signup"
        else {"ok": True, "skipped": True, "error": None}
    )
    freshers_entry = (
        await enroll_freshers_student(fresh)
        if doc.get("purpose", "signup") == "signup"
        else None
    )
    return {
        "ok": True,
        "user": serialize_user(fresh),
        "welcome_email_sent": welcome_result["ok"],
        "freshers_position": freshers_entry.get("position") if freshers_entry else None,
    }


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    user = await expire_verification_if_needed(user)
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
    fresh = await db.users.find_one({"_id": user["_id"]})
    await enroll_freshers_student(fresh)
    welcome_result = await send_welcome_email_once(fresh)
    return {
        "ok": True,
        "message": "Email verified",
        "welcome_email_sent": welcome_result["ok"],
    }


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
            "Reset your SavvyCampusDeals password",
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
                                      <td style="padding-left:12px; color:#ffffff; font-size:17px; line-height:24px; font-weight:700; letter-spacing:0;">SavvyCampusDeals</td>
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
                                        <p style="margin:16px 0 0 0; color:#c8cedb; font-size:16px; line-height:26px; font-weight:400;">We received a request to reset the password for your SavvyCampusDeals account. Use the button below to choose a new password and get back to discovering student deals.</p>
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
                            <p style="margin:0; color:#8f98aa; font-size:13px; line-height:20px; font-weight:700;">SavvyCampusDeals</p>
                            <p style="margin:6px 0 0 0; color:#6f788a; font-size:12px; line-height:19px;">Support: <a href="mailto:{FROM_EMAIL}" style="color:#aeb7c9; text-decoration:none;">{FROM_EMAIL}</a></p>
                            <p style="margin:6px 0 0 0; color:#596173; font-size:12px; line-height:19px;">&copy; {datetime.now().year} SavvyCampusDeals. All rights reserved.</p>
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
    if updates.get("avatar_url"):
        raise HTTPException(400, "Custom avatar images are not supported")
    if "avatar_key" in updates and updates["avatar_key"] not in {
        "",
        *STUDENT_AVATAR_KEYS,
    }:
        raise HTTPException(400, "Choose one of the available avatars")
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(fresh)


@api.delete("/account")
async def delete_account(
    body: DeleteAccountIn,
    response: Response,
    user=Depends(get_current_user),
):
    """Permanently remove a student and all records owned by that account."""
    if user.get("role", "student") != "student":
        raise HTTPException(403, "Only student accounts can be deleted here")
    if body.confirmation.strip().upper() != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm account deletion")
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Incorrect password")

    user_id = user["_id"]
    verifications = await db.verifications.find(
        {"user_id": user_id},
        {
            "college_id_image": 1,
            "selfie_image": 1,
            "college_id_image_public_id": 1,
            "selfie_image_public_id": 1,
        },
    ).to_list(None)
    has_cloudinary_assets = any(
        verification.get("college_id_image_public_id")
        or verification.get("selfie_image_public_id")
        or "res.cloudinary.com" in verification.get("college_id_image", "")
        or "res.cloudinary.com" in verification.get("selfie_image", "")
        for verification in verifications
    )
    if has_cloudinary_assets:
        cloudinary_deleted = await asyncio.to_thread(
            delete_verification_images_for_user,
            str(user_id),
        )
        if not cloudinary_deleted:
            raise HTTPException(
                503,
                "We could not securely remove your verification images. Your account was not deleted; please try again.",
            )

    owned_collections = (
        db.verifications,
        db.saved_offers,
        db.coupons,
        db.brand_offer_claims,
        db.savvy_points_transactions,
        db.savvy_level_rewards,
        db.announcement_receipts,
        db.email_campaign_recipients,
        db.outlet_daily_redemptions,
        db.offer_monthly_redemptions,
        db.offer_once_redemptions,
        db.otp_codes,
        db.password_resets,
    )

    async def purge_database_records(session):
        for collection in owned_collections:
            await collection.delete_many({"user_id": user_id}, session=session)
        await db.referrals.delete_many(
            {
                "$or": [
                    {"referrer_id": user_id},
                    {"referred_id": user_id},
                ]
            },
            session=session,
        )
        await db.users.update_many(
            {"referrer_id": user_id},
            {"$unset": {"referrer_id": ""}},
            session=session,
        )
        await db.users.delete_one({"_id": user_id}, session=session)

    try:
        async with await client.start_session() as session:
            await session.with_transaction(purge_database_records)
    except Exception:
        logger.exception("Account data deletion failed for user %s", user_id)
        raise HTTPException(
            503,
            "Account deletion could not be completed. Your database records were kept; please try again.",
        ) from None

    response.delete_cookie("access_token", path="/")
    try:
        email_result = await asyncio.to_thread(
            send_email,
            user["email"],
            f"We’re sad to see you go, {welcome_email_first_name(user)} 💜",
            account_deleted_email_html(user),
        )
    except Exception:
        logger.exception(
            "Account deletion confirmation email failed for user %s", user_id
        )
        email_result = {"ok": False, "error": "unexpected_delivery_error"}
    if not email_result["ok"]:
        logger.warning(
            "Account deletion confirmation email could not be delivered for user %s: %s",
            user_id,
            email_result.get("error"),
        )
    return {"ok": True}


# -----------------------------
# Verification
# -----------------------------
@api.post("/verification/submit")
async def submit_verification(
    body: VerificationSubmitIn, user=Depends(get_verified_user)
):
    current_status = effective_verification_status(user)
    renewing = current_status == "expired"
    if current_status == "approved":
        raise HTTPException(400, "Already verified")
    if renewing and not has_current_reverification_email(user):
        raise HTTPException(
            403,
            "Verify your email again before renewing student verification.",
        )
    if not body.student_id_number.strip():
        raise HTTPException(400, "Student ID / Roll Number is required")
    if not is_valid_student_id(body.student_id_number):
        raise HTTPException(
            400,
            "Enter your Student ID / Roll Number, not your email address.",
        )

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
        }
    )
    if existing_id and existing_id.get("user_id") != user["_id"]:
        raise HTTPException(
            409,
            "This Student ID / Roll Number has already been used for verification.",
        )
    reusable_verification = (
        existing_id
        if existing_id
        and existing_id.get("user_id") == user["_id"]
        and current_status in {"expired", "rejected"}
        else None
    )
    if existing_id and reusable_verification is None:
        raise HTTPException(
            409,
            "A verification request already exists for this Student ID.",
        )

    trusted_email = is_approved_college_email(user["email"])
    college_name = body.college_name.strip()
    uploaded_images: list[dict[str, str]] = []
    college_id_image = (
        reusable_verification.get("college_id_image", "")
        if reusable_verification and trusted_email
        else body.college_id_image
    )
    selfie_image = (
        reusable_verification.get("selfie_image", "")
        if reusable_verification and trusted_email
        else body.selfie_image
    )
    if not trusted_email:
        try:
            # Validate every required image before making the first external upload.
            validate_verification_image(body.college_id_image)
            validate_verification_image(body.selfie_image)
        except InvalidVerificationImage as exc:
            raise HTTPException(400, str(exc)) from None

        try:
            college_upload = await asyncio.to_thread(
                upload_verification_image,
                body.college_id_image,
                asset_type="college-id",
                user_identifier=str(user["_id"]),
            )
            uploaded_images.append(college_upload)
            selfie_upload = await asyncio.to_thread(
                upload_verification_image,
                body.selfie_image,
                asset_type="selfie-with-id",
                user_identifier=str(user["_id"]),
            )
            uploaded_images.append(selfie_upload)
        except (CloudinaryUploadError, RuntimeError):
            await _cleanup_verification_uploads(uploaded_images)
            raise HTTPException(
                503,
                "Verification image upload is temporarily unavailable. Please try again.",
            ) from None

        college_id_image = college_upload["secure_url"]
        selfie_image = selfie_upload["secure_url"]

    now = datetime.now(timezone.utc)
    doc = {
        "_id": reusable_verification["_id"] if reusable_verification else ObjectId(),
        "user_id": user["_id"],
        "college_id_image": college_id_image,
        "selfie_image": selfie_image,
        "college_name": college_name,
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
    if not trusted_email:
        doc.update({
            "college_id_image_public_id": college_upload["public_id"],
            "selfie_image_public_id": selfie_upload["public_id"],
        })
    try:
        if reusable_verification:
            verification_result = await db.verifications.update_one(
                {
                    "_id": reusable_verification["_id"],
                    "user_id": user["_id"],
                    "status": reusable_verification.get("status"),
                    "submitted_at": reusable_verification.get("submitted_at"),
                },
                {
                    "$set": {
                        key: value
                        for key, value in doc.items()
                        if key != "_id"
                    },
                    "$unset": {
                        "reviewed_by": "",
                        "rejection_reason": "",
                    },
                    "$push": {
                        "review_history": {
                            "status": reusable_verification.get("status", ""),
                            "method": reusable_verification.get("method", ""),
                            "submitted_at": reusable_verification.get("submitted_at"),
                            "reviewed_at": reusable_verification.get("reviewed_at"),
                            "reviewer_note": reusable_verification.get(
                                "reviewer_note", ""
                            ),
                            "archived_at": now,
                        }
                    },
                },
            )
            if not verification_result.matched_count:
                raise RuntimeError("Verification request no longer exists")
        else:
            await db.verifications.insert_one(doc)
    except DuplicateKeyError:
        await _cleanup_verification_uploads(uploaded_images)
        raise HTTPException(
            409,
            "This Student ID / Roll Number has already been used for verification.",
        )
    except Exception:
        await _cleanup_verification_uploads(uploaded_images)
        raise HTTPException(
            503,
            "Verification could not be saved. Please try again.",
        ) from None

    user_updates = {
        "verification_status": "approved" if trusted_email else "pending",
        "verification_submitted_at": now,
        "college": college_name,
        "course": body.course,
        "year": body.year,
    }
    update: dict = {"$set": user_updates}
    first_verification_reward = trusted_email and not user.get("verification_expiry")
    if trusted_email:
        user_updates.update({
            "student_number": user.get("student_number") or gen_student_number(),
            "verification_expiry": now + timedelta(days=365),
        })
    try:
        user_result = await db.users.update_one({"_id": user["_id"]}, update)
        if not user_result.matched_count:
            raise RuntimeError("Verification user no longer exists")
    except Exception:
        try:
            if reusable_verification:
                await db.verifications.replace_one(
                    {"_id": reusable_verification["_id"]},
                    reusable_verification,
                )
            else:
                await db.verifications.delete_one({"_id": doc["_id"]})
        except Exception:
            logger.warning(
                "Verification document rollback could not be completed"
            )
        await _cleanup_verification_uploads(uploaded_images)
        raise HTTPException(
            503,
            "Verification could not be saved. Please try again.",
        ) from None

    if first_verification_reward:
        await award_savvy_points(
            user["_id"],
            200,
            "verification",
            str(user["_id"]),
            "Student status verified",
            "Your verified student bonus is unlocked.",
        )
        await complete_pending_referral(user["_id"])

    if reusable_verification and not trusted_email:
        await _cleanup_verification_uploads(
            [
                {
                    "public_id": reusable_verification.get(
                        "college_id_image_public_id", ""
                    )
                },
                {
                    "public_id": reusable_verification.get(
                        "selfie_image_public_id", ""
                    )
                },
            ]
        )

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
    freshers_reward = await unlock_freshers_reward(fresh) if trusted_email else None
    return {
        "ok": True,
        "verification_method": "college_email" if trusted_email else "document_review",
        "user": serialize_user(fresh),
        "freshers_reward_unlocked": bool(
            freshers_reward and freshers_reward.get("status") == "unlocked"
        ),
    }


async def _cleanup_verification_uploads(
    uploaded_images: list[dict[str, str]],
) -> None:
    if not uploaded_images:
        return
    results = await asyncio.gather(
        *[
            asyncio.to_thread(
                delete_verification_image,
                image.get("public_id", ""),
            )
            for image in uploaded_images
        ],
        return_exceptions=True,
    )
    if any(
        isinstance(result, Exception) or result is False
        for result in results
    ):
        logger.warning(
            "One or more verification image cleanup attempts could not be completed"
        )


async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


async def get_scanner_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "outlet_partner"}:
        raise HTTPException(403, "Outlet partner access required")
    if user.get("role") == "outlet_partner" and not user.get("outlet_id"):
        raise HTTPException(403, "This partner account is not assigned to an outlet")
    if user.get("role") == "outlet_partner" and not await db.outlets.find_one(
        {"_id": user["outlet_id"]}, {"_id": 1}
    ):
        raise HTTPException(403, "The assigned outlet is no longer available")
    return user


async def get_event_staff_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "event_staff"}:
        raise HTTPException(403, "Event staff access required")
    if user.get("role") == "event_staff" and user.get("campaign_slug") != FRESHERS_CAMPAIGN_SLUG:
        raise HTTPException(403, "This staff account is not assigned to this event")
    return user


def ensure_scanner_coupon_access(scanner: dict, coupon: dict) -> None:
    """Prevent an outlet partner from inspecting or redeeming another outlet's QR."""
    if scanner.get("role") == "admin":
        return
    coupon_outlet_id = coupon.get("outlet_id")
    if not coupon_outlet_id:
        raise HTTPException(403, "This coupon is not assigned to an outlet")
    if coupon_outlet_id != scanner.get("outlet_id"):
        raise HTTPException(403, "This coupon belongs to another outlet")


@api.get("/partner/profile")
async def partner_profile(scanner=Depends(get_scanner_user)):
    outlet = None
    if scanner.get("outlet_id"):
        outlet = await db.outlets.find_one({"_id": scanner["outlet_id"]})
    return {
        "name": scanner.get("name", ""),
        "email": scanner.get("email", ""),
        "role": scanner.get("role", ""),
        "outlet": serialize_outlet(outlet) if outlet else None,
    }


def serialize_admin_partner(partner: Optional[dict]) -> Optional[dict]:
    if not partner:
        return None
    return {
        "id": str(partner["_id"]),
        "name": partner.get("name", ""),
        "email": partner.get("email", ""),
        "active": partner.get("active", True),
        "created_at": _admin_datetime(partner.get("created_at")),
    }


@api.get("/admin/partners")
async def admin_partners(admin=Depends(get_admin_user)):
    outlets = await db.outlets.find({}).sort("name", 1).to_list(500)
    partners = await db.users.find({"role": "outlet_partner"}).to_list(500)
    partner_by_outlet = {
        partner.get("outlet_id"): partner
        for partner in partners
        if partner.get("outlet_id")
    }
    return {
        "items": [
            {
                "outlet": serialize_outlet(outlet),
                "partner": serialize_admin_partner(partner_by_outlet.get(outlet["_id"])),
            }
            for outlet in outlets
        ]
    }


@api.post("/admin/partners")
async def admin_create_partner(
    body: AdminPartnerCreateIn, admin=Depends(get_admin_user)
):
    validate_password(body.password)
    try:
        outlet_oid = ObjectId(body.outlet_id)
    except Exception:
        raise HTTPException(404, "Outlet not found")
    outlet = await db.outlets.find_one({"_id": outlet_oid})
    if not outlet:
        raise HTTPException(404, "Outlet not found")
    if await db.users.find_one({"role": "outlet_partner", "outlet_id": outlet_oid}):
        raise HTTPException(409, "This outlet already has a partner account")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    now = datetime.now(timezone.utc)
    partner = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": "outlet_partner",
        "outlet_id": outlet_oid,
        "active": True,
        "email_verified": True,
        "verification_status": "approved",
        "reward_points": 0,
        "referral_code": "",
        "created_by": admin["_id"],
        "created_at": now,
    }
    try:
        result = await db.users.insert_one(partner)
    except DuplicateKeyError:
        raise HTTPException(409, "The email or outlet already has a partner account")
    partner["_id"] = result.inserted_id
    return {
        "outlet": serialize_outlet(outlet),
        "partner": serialize_admin_partner(partner),
    }


@api.patch("/admin/partners/{partner_id}/status")
async def admin_set_partner_status(
    partner_id: str,
    body: AdminPartnerStatusIn,
    admin=Depends(get_admin_user),
):
    try:
        partner_oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(404, "Partner account not found")
    result = await db.users.update_one(
        {"_id": partner_oid, "role": "outlet_partner"},
        {"$set": {"active": body.active, "updated_at": datetime.now(timezone.utc)}},
    )
    if not result.matched_count:
        raise HTTPException(404, "Partner account not found")
    partner = await db.users.find_one({"_id": partner_oid})
    return {"partner": serialize_admin_partner(partner)}


@api.get("/freshers/reward")
async def my_freshers_reward(user=Depends(get_current_user)):
    campaign = await get_freshers_campaign()
    if not campaign:
        raise HTTPException(404, "Freshers campaign not found")
    participant = await db.freshers_participants.find_one(
        {"campaign_id": campaign["_id"], "user_id": user["_id"]}
    )
    if not participant:
        raise HTTPException(404, "You are not registered for this campaign")
    return {
        "campaign": {
            "name": campaign.get("name", "KIET Freshers 2026"),
            "status": freshers_campaign_status(campaign),
            "closes_at": _admin_datetime(campaign.get("closes_at")),
        },
        "reward": serialize_freshers_participant(participant, campaign),
    }


def _freshers_admin_campaign(campaign: dict) -> dict:
    return {
        "id": str(campaign["_id"]),
        "slug": campaign["slug"],
        "name": campaign.get("name", "KIET Freshers 2026"),
        "status": freshers_campaign_status(campaign),
        "manual_status": campaign.get("manual_status", "scheduled"),
        "opens_at": _admin_datetime(campaign.get("opens_at")),
        "closes_at": _admin_datetime(campaign.get("closes_at")),
        "grace_ends_at": _admin_datetime(campaign.get("grace_ends_at")),
        "verification_deadline": _admin_datetime(campaign.get("verification_deadline")),
        "allowed_domain": FRESHERS_DOMAIN,
        "coupon_limit": FRESHERS_COUPON_LIMIT,
        "goodies_limit": FRESHERS_GOODIES_LIMIT,
        "validity_days": FRESHERS_VALIDITY_DAYS,
        "gog_offer": campaign.get("gog_offer", ""),
        "gog_discount_offer": campaign.get(
            "gog_discount_offer",
            "15% off on a purchase of ₹350 at GOG Cafe & Bakers.",
        ),
        "s_cafe_offer": campaign.get("s_cafe_offer", ""),
        "big_bite_offer": campaign.get("big_bite_offer", ""),
        "pickup_location": campaign.get("pickup_location", ""),
        "goodies_description": campaign.get("goodies_description", "Savvy stickers and pamphlet"),
        "rewards_enabled": campaign.get("rewards_enabled", False),
    }


@api.get("/admin/freshers-campaign")
async def admin_freshers_campaign(admin=Depends(get_admin_user)):
    campaign = await get_freshers_campaign()
    if not campaign:
        raise HTTPException(404, "Freshers campaign not found")
    base = {"campaign_id": campaign["_id"]}
    (
        total,
        reserved,
        waitlisted,
        unlocked,
        goodies_collected,
        cafe_redeemed,
        email_pending,
        email_sent,
        email_failed,
        duplicate_scans,
    ) = await asyncio.gather(
        db.freshers_participants.count_documents(base),
        db.freshers_participants.count_documents({**base, "reward_slot": {"$lte": FRESHERS_GOODIES_LIMIT}}),
        db.freshers_participants.count_documents({**base, "tier": "waitlist"}),
        db.freshers_participants.count_documents({**base, "status": "unlocked"}),
        db.freshers_participants.count_documents({**base, "goodies_status": "collected"}),
        db.freshers_participants.count_documents({**base, "cafe_status": "redeemed"}),
        db.freshers_email_jobs.count_documents({"status": {"$in": ["pending", "sending"]}}),
        db.freshers_email_jobs.count_documents({"status": "sent"}),
        db.freshers_email_jobs.count_documents({"status": "failed"}),
        db.freshers_scan_events.count_documents({**base, "result": "duplicate"}),
    )
    recent_docs = await db.freshers_participants.find(base).sort("updated_at", -1).to_list(40)
    activity_docs = await db.freshers_scan_events.find(base).sort("created_at", -1).to_list(30)
    activity_participants = await db.freshers_participants.find(
        {"_id": {"$in": list({item["participant_id"] for item in activity_docs})}}
    ).to_list(30) if activity_docs else []
    activity_staff = await db.users.find(
        {"_id": {"$in": list({item["staff_id"] for item in activity_docs})}},
        {"name": 1},
    ).to_list(30) if activity_docs else []
    activity_participant_by_id = {item["_id"]: item for item in activity_participants}
    activity_staff_by_id = {item["_id"]: item for item in activity_staff}
    staff_docs = await db.users.find(
        {"role": "event_staff", "campaign_slug": FRESHERS_CAMPAIGN_SLUG},
        {"password_hash": 0},
    ).sort("name", 1).to_list(20)
    return {
        "campaign": _freshers_admin_campaign(campaign),
        "stats": {
            "registrations": total,
            "reward_reservations": min(reserved, FRESHERS_GOODIES_LIMIT),
            "coupon_reservations": await db.freshers_participants.count_documents(
                {**base, "reward_slot": {"$lte": FRESHERS_COUPON_LIMIT}}
            ),
            "waitlisted": waitlisted,
            "unlocked": unlocked,
            "goodies_collected": goodies_collected,
            "goodies_remaining": max(0, FRESHERS_GOODIES_LIMIT - goodies_collected),
            "cafe_redeemed": cafe_redeemed,
            "email_pending": email_pending,
            "email_sent": email_sent,
            "email_failures": email_failed,
            "duplicate_scans": duplicate_scans,
        },
        "recent": [
            {
                **serialize_freshers_participant(item, campaign),
                "name": item.get("name", ""),
                "email": item.get("email", ""),
                "updated_at": _admin_datetime(item.get("updated_at")),
            }
            for item in recent_docs
        ],
        "activity": [
            {
                "id": str(item["_id"]),
                "kind": item.get("kind", ""),
                "result": item.get("result", ""),
                "created_at": _admin_datetime(item.get("created_at")),
                "student_name": activity_participant_by_id.get(item.get("participant_id"), {}).get("name", ""),
                "position": activity_participant_by_id.get(item.get("participant_id"), {}).get("position"),
                "staff_name": activity_staff_by_id.get(item.get("staff_id"), {}).get("name", ""),
            }
            for item in activity_docs
        ],
        "staff": [
            {
                "id": str(item["_id"]),
                "name": item.get("name", ""),
                "email": item.get("email", ""),
                "active": item.get("active", True),
                "last_active_at": _admin_datetime(item.get("last_active_at")),
                "collections": await db.freshers_participants.count_documents({"goodies_collected_by": item["_id"]}),
            }
            for item in staff_docs
        ],
    }


@api.patch("/admin/freshers-campaign")
async def admin_update_freshers_campaign(
    body: FreshersCampaignUpdateIn, admin=Depends(get_admin_user)
):
    campaign = await get_freshers_campaign()
    if not campaign:
        raise HTTPException(404, "Freshers campaign not found")
    values = body.model_dump(exclude_none=True)
    manual = values.get("manual_status")
    if manual and manual not in {"scheduled", "paused", "closed"}:
        raise HTTPException(400, "Invalid campaign status")
    opens_at = _aware(values.get("opens_at") or campaign["opens_at"])
    closes_at = _aware(values.get("closes_at") or campaign["closes_at"])
    if closes_at <= opens_at:
        raise HTTPException(400, "Campaign closing time must be after opening time")
    values["opens_at"] = opens_at
    values["closes_at"] = closes_at
    values["grace_ends_at"] = closes_at + timedelta(minutes=FRESHERS_GRACE_MINUTES)
    if values.get("verification_deadline"):
        values["verification_deadline"] = _aware(values["verification_deadline"])
        if values["verification_deadline"] < values["grace_ends_at"]:
            raise HTTPException(400, "Verification deadline cannot be before the OTP grace period ends")
    values["updated_at"] = datetime.now(timezone.utc)
    values["updated_by"] = admin["_id"]
    await db.freshers_campaigns.update_one({"_id": campaign["_id"]}, {"$set": values})
    fresh = await get_freshers_campaign()
    if values.get("rewards_enabled"):
        ready = await db.freshers_participants.find(
            {
                "campaign_id": campaign["_id"],
                "status": {"$in": ["reserved", "promoted"]},
                "full_verification_at": {"$exists": True},
            },
            {"user_id": 1},
        ).to_list(FRESHERS_GOODIES_LIMIT)
        for participant in ready:
            user = await db.users.find_one({"_id": participant["user_id"]})
            if user:
                await unlock_freshers_reward(user)
        fresh = await get_freshers_campaign()
    return {"campaign": _freshers_admin_campaign(fresh)}


@api.post("/admin/freshers-campaign/retry-failed-emails")
async def admin_retry_freshers_emails(admin=Depends(get_admin_user)):
    now = datetime.now(timezone.utc)
    result = await db.freshers_email_jobs.update_many(
        {"status": "failed"},
        {"$set": {"status": "pending", "deliver_at": now, "error": "", "attempts": 0, "retried_by": admin["_id"], "retried_at": now}},
    )
    return {"ok": True, "queued": result.modified_count}


@api.post("/admin/freshers-campaign/staff")
async def admin_create_freshers_staff(
    body: FreshersStaffCreateIn, admin=Depends(get_admin_user)
):
    validate_password(body.password)
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    now = datetime.now(timezone.utc)
    staff = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": "event_staff",
        "campaign_slug": FRESHERS_CAMPAIGN_SLUG,
        "active": True,
        "email_verified": True,
        "verification_status": "approved",
        "created_by": admin["_id"],
        "created_at": now,
    }
    result = await db.users.insert_one(staff)
    return {"id": str(result.inserted_id), "name": staff["name"], "email": email, "active": True}


@api.post("/admin/freshers-campaign/bootstrap-staff")
async def admin_bootstrap_freshers_staff(admin=Depends(get_admin_user)):
    roster = [
        ("Palak Gupta", "palak.gupta.kiet26@staff.savvycampusdeals.com"),
        ("Sahil Gupta", "sahil.gupta.kiet26@staff.savvycampusdeals.com"),
        ("Aditya Dixit", "aditya.dixit.kiet26@staff.savvycampusdeals.com"),
        ("Satwik Srivastava", "satwik.srivastava.kiet26@staff.savvycampusdeals.com"),
    ]
    credentials = []
    now = datetime.now(timezone.utc)
    for name, email in roster:
        if await db.users.find_one({"email": email}, {"_id": 1}):
            continue
        password = f"Kiet!{secrets.randbelow(900000) + 100000}{secrets.token_hex(2)}"
        staff = {
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "role": "event_staff",
            "campaign_slug": FRESHERS_CAMPAIGN_SLUG,
            "active": True,
            "email_verified": True,
            "verification_status": "approved",
            "created_by": admin["_id"],
            "created_at": now,
        }
        await db.users.insert_one(staff)
        credentials.append({"name": name, "email": email, "password": password})
    if not credentials:
        raise HTTPException(409, "The four event staff accounts already exist; passwords cannot be shown again")
    return {"credentials": credentials}


@api.patch("/admin/freshers-campaign/staff/{staff_id}/status")
async def admin_set_freshers_staff_status(
    staff_id: str, body: AdminPartnerStatusIn, admin=Depends(get_admin_user)
):
    try:
        staff_oid = ObjectId(staff_id)
    except Exception:
        raise HTTPException(404, "Event staff account not found")
    result = await db.users.update_one(
        {"_id": staff_oid, "role": "event_staff", "campaign_slug": FRESHERS_CAMPAIGN_SLUG},
        {"$set": {"active": body.active, "updated_at": datetime.now(timezone.utc)}},
    )
    if not result.matched_count:
        raise HTTPException(404, "Event staff account not found")
    return {"ok": True}


def _freshers_scan_code(payload: str, parameter: str, prefix: str) -> str:
    raw = (payload or "").strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        try:
            from urllib.parse import parse_qs, urlparse
            raw = parse_qs(urlparse(raw).query).get(parameter, [""])[0]
        except Exception:
            raw = ""
    raw = raw.upper()
    if not raw.startswith(prefix + "-"):
        raise HTTPException(400, "This QR is for a different scanner")
    return raw


@api.get("/freshers/staff/profile")
async def freshers_staff_profile(staff=Depends(get_event_staff_user)):
    await db.users.update_one({"_id": staff["_id"]}, {"$set": {"last_active_at": datetime.now(timezone.utc)}})
    return {"name": staff.get("name", ""), "email": staff.get("email", ""), "role": staff.get("role", "")}


@api.post("/freshers/staff/lookup")
async def freshers_staff_lookup(body: FreshersScanIn, staff=Depends(get_event_staff_user)):
    code = _freshers_scan_code(body.payload, "g", "KFG")
    participant = await db.freshers_participants.find_one({"goodies_code": code})
    if not participant:
        raise HTTPException(404, "Goodies pass not found")
    user = await db.users.find_one({"_id": participant["user_id"]})
    campaign = await get_freshers_campaign()
    expired = bool(participant.get("expires_at") and _aware(participant["expires_at"]) <= datetime.now(timezone.utc))
    return {
        "kind": "freshers_goodies",
        "code": code,
        "status": "expired" if expired and participant.get("goodies_status") == "active" else participant.get("goodies_status", "active"),
        "position": participant.get("position"),
        "student_name": (user or {}).get("name", participant.get("name", "")),
        "student_email": (user or {}).get("email", participant.get("email", "")),
        "student_number": (user or {}).get("student_number", ""),
        "student_verified": bool(user and effective_verification_status(user) == "approved"),
        "goodies": campaign.get("goodies_description", "Savvy stickers and pamphlet") if campaign else "Savvy stickers and pamphlet",
        "expires_at": _admin_datetime(participant.get("expires_at")),
        "collected_at": _admin_datetime(participant.get("goodies_collected_at")),
        "collected_by": participant.get("goodies_collected_by_name", ""),
    }


@api.post("/freshers/staff/collect")
async def freshers_staff_collect(body: FreshersScanIn, staff=Depends(get_event_staff_user)):
    code = _freshers_scan_code(body.payload, "g", "KFG")
    participant = await db.freshers_participants.find_one({"goodies_code": code})
    if not participant:
        raise HTTPException(404, "Goodies pass not found")
    campaign = await get_freshers_campaign()
    now = datetime.now(timezone.utc)
    event = {"campaign_id": campaign["_id"], "participant_id": participant["_id"], "staff_id": staff["_id"], "kind": "goodies", "created_at": now}
    if participant.get("goodies_status") == "collected":
        await db.freshers_scan_events.insert_one({**event, "result": "duplicate"})
        raise HTTPException(409, "Goodies were already collected")
    if participant.get("expires_at") and _aware(participant["expires_at"]) <= now:
        raise HTTPException(410, "Goodies pass has expired")
    user = await db.users.find_one({"_id": participant["user_id"]})
    if not user or effective_verification_status(user) != "approved":
        raise HTTPException(403, "Student verification is not active")
    changed = await db.freshers_participants.update_one(
        {"_id": participant["_id"], "goodies_status": "active", "expires_at": {"$gt": now}},
        {"$set": {"goodies_status": "collected", "goodies_collected_at": now, "goodies_collected_by": staff["_id"], "goodies_collected_by_name": staff.get("name", ""), "updated_at": now}},
    )
    if not changed.matched_count:
        await db.freshers_scan_events.insert_one({**event, "result": "duplicate"})
        raise HTTPException(409, "Goodies were already collected")
    await db.freshers_scan_events.insert_one({**event, "result": "collected"})
    return {"ok": True, "student_name": user.get("name", ""), "position": participant.get("position"), "collected_at": now.isoformat(), "approved_by": staff.get("name", "")}


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
    first_verification_reward = (
        body.status == "approved" and not student.get("verification_expiry")
    )
    if body.status == "approved":
        user_updates.update({
            "student_number": student.get("student_number") or gen_student_number(),
            "verification_expiry": now + timedelta(days=365),
        })
    await db.users.update_one({"_id": student["_id"]}, update)
    if first_verification_reward:
        await award_savvy_points(
            student["_id"],
            200,
            "verification",
            str(student["_id"]),
            "Student status verified",
            "Your verified student bonus is unlocked.",
        )
        await complete_pending_referral(student["_id"])

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
        "verification_status": effective_verification_status(user),
        "verification_submitted_at": _admin_datetime(user.get("verification_submitted_at")),
        "verification_reviewed_at": _admin_datetime(user.get("verification_reviewed_at")),
        "verification_rejection_reason": user.get("verification_rejection_reason", ""),
        "savvy_points_balance": savvy_points_balance(user),
        "savvy_points_lifetime": savvy_points_lifetime(user),
        "savvy_tier": savvy_tier(savvy_points_lifetime(user))["name"],
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
        # Values may be legacy Base64 data URIs or new Cloudinary HTTPS URLs.
        # Keep images out of lists and send them only for an opened profile.
        result["college_id_image"] = doc.get("college_id_image", "")
        result["selfie_image"] = doc.get("selfie_image", "")
        result["selfie_with_id"] = doc.get("selfie_image", "")
    return result


ANNOUNCEMENT_CATEGORIES = {"new", "important", "limited"}
ANNOUNCEMENT_AUDIENCES = {"everyone", "students", "partners"}
ANNOUNCEMENT_LIFETIME_DAYS = 5
EMAIL_CAMPAIGN_AUDIENCES = {
    "approved_students",
    "email_verified_students",
    "all_students",
}
EMAIL_CAMPAIGN_CORNER_STYLES = {"soft", "rounded", "pill"}
EMAIL_CAMPAIGN_EDITABLE_STATUSES = {"draft", "cancelled"}
_email_campaign_tasks: set[asyncio.Task] = set()
_running_email_campaigns: set[str] = set()


def _validated_announcement_payload(body: AdminAnnouncementIn) -> dict:
    category = body.category.strip().lower()
    audience = body.audience.strip().lower()
    if category not in ANNOUNCEMENT_CATEGORIES:
        raise HTTPException(400, "Invalid announcement category")
    if audience not in ANNOUNCEMENT_AUDIENCES:
        raise HTTPException(400, "Invalid announcement audience")

    cta_label = (body.cta_label or "").strip()
    cta_url = (body.cta_url or "").strip()
    if bool(cta_label) != bool(cta_url):
        raise HTTPException(400, "CTA label and destination must be provided together")
    if cta_url and not (cta_url.startswith("/") or cta_url.startswith("https://")):
        raise HTTPException(400, "CTA destination must be a site path or HTTPS URL")

    image_url = (body.image_url or "").strip()
    if image_url and not (
        image_url.startswith("https://") or image_url.startswith("data:image/")
    ):
        raise HTTPException(400, "Announcement image must use HTTPS")

    starts_at = _aware(body.starts_at) or datetime.now(timezone.utc)
    return {
        "title": body.title.strip(),
        "message": body.message.strip(),
        "category": category,
        "audience": audience,
        "priority": body.priority,
        "cta_label": cta_label,
        "cta_url": cta_url,
        "image_url": image_url,
        "starts_at": starts_at,
        "expires_at": starts_at + timedelta(days=ANNOUNCEMENT_LIFETIME_DAYS),
        "published": body.published,
    }


def serialize_announcement(
    announcement: dict,
    receipt: Optional[dict] = None,
    stats: Optional[dict] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    starts_at = _aware(announcement.get("starts_at"))
    expires_at = _aware(announcement.get("expires_at"))
    if not announcement.get("published", False):
        status = "draft"
    elif starts_at and starts_at > now:
        status = "scheduled"
    elif expires_at and expires_at <= now:
        status = "expired"
    else:
        status = "active"
    result = {
        "id": str(announcement["_id"]),
        "title": announcement.get("title", ""),
        "message": announcement.get("message", ""),
        "category": announcement.get("category", "new"),
        "audience": announcement.get("audience", "students"),
        "priority": int(announcement.get("priority", 1) or 0),
        "cta_label": announcement.get("cta_label", ""),
        "cta_url": announcement.get("cta_url", ""),
        "image_url": announcement.get("image_url", ""),
        "published": announcement.get("published", False),
        "status": status,
        "starts_at": _admin_datetime(announcement.get("starts_at")),
        "expires_at": _admin_datetime(announcement.get("expires_at")),
        "created_at": _admin_datetime(announcement.get("created_at")),
        "updated_at": _admin_datetime(announcement.get("updated_at")),
    }
    if receipt is not None:
        result.update(
            {
                "seen": bool(receipt.get("seen_at")),
                "seen_at": _admin_datetime(receipt.get("seen_at")),
                "clicked": bool(receipt.get("clicked_at")),
            }
        )
    if stats is not None:
        result["stats"] = stats
    return result


def _announcement_audiences_for(user: dict) -> list[str]:
    if user.get("role") == "student":
        return ["everyone", "students"]
    if user.get("role") == "outlet_partner":
        return ["everyone", "partners"]
    return []


def _campaign_audience_query(audience: str) -> dict:
    query: dict = {
        "role": "student",
        "email": {"$type": "string", "$ne": ""},
        "marketing_email_opt_out": {"$ne": True},
    }
    if audience == "approved_students":
        query.update({"email_verified": True, "verification_status": "approved"})
    elif audience == "email_verified_students":
        query["email_verified"] = True
    elif audience != "all_students":
        raise HTTPException(400, "Invalid email campaign audience")
    return query


def _validate_hex_color(value: str, label: str) -> str:
    color = value.strip().lower()
    if not re.fullmatch(r"#[0-9a-f]{6}", color):
        raise HTTPException(400, f"{label} must be a six-digit hex colour")
    return color


def _validated_email_campaign_payload(body: AdminEmailCampaignIn) -> dict:
    if body.audience not in EMAIL_CAMPAIGN_AUDIENCES:
        raise HTTPException(400, "Invalid email campaign audience")
    if body.corner_style not in EMAIL_CAMPAIGN_CORNER_STYLES:
        raise HTTPException(400, "Invalid email corner style")
    cta_label = (body.cta_label or "").strip()
    cta_url = (body.cta_url or "").strip()
    if bool(cta_label) != bool(cta_url):
        raise HTTPException(400, "CTA label and destination must be provided together")
    if cta_url and not (cta_url.startswith("/") or cta_url.startswith("https://")):
        raise HTTPException(400, "CTA destination must be a site path or HTTPS URL")
    image_url = (body.image_url or "").strip()
    if image_url and not image_url.startswith("https://"):
        raise HTTPException(400, "Campaign artwork must use an HTTPS URL")
    return {
        "name": body.name.strip(),
        "subject": body.subject.strip(),
        "preview_text": (body.preview_text or "").strip(),
        "heading": body.heading.strip(),
        "message": body.message.strip(),
        "eyebrow": (body.eyebrow or "").strip(),
        "cta_label": cta_label,
        "cta_url": cta_url,
        "image_url": image_url,
        "audience": body.audience,
        "scheduled_at": _aware(body.scheduled_at),
        "background_color": _validate_hex_color(body.background_color, "Background colour"),
        "card_color": _validate_hex_color(body.card_color, "Card colour"),
        "accent_color": _validate_hex_color(body.accent_color, "Accent colour"),
        "text_color": _validate_hex_color(body.text_color, "Text colour"),
        "muted_color": _validate_hex_color(body.muted_color, "Muted colour"),
        "button_text_color": _validate_hex_color(body.button_text_color, "Button text colour"),
        "corner_style": body.corner_style,
    }


def _campaign_unsubscribe_token(user_id: ObjectId) -> str:
    encoded_id = base64.urlsafe_b64encode(user_id.binary).decode().rstrip("=")
    signature = hmac.new(
        JWT_SECRET.encode(), f"email-unsubscribe:{encoded_id}".encode(), hashlib.sha256
    ).digest()[:20]
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{encoded_id}.{encoded_signature}"


def _decode_campaign_unsubscribe_token(token: str) -> ObjectId:
    try:
        encoded_id, encoded_signature = token.split(".", 1)
        supplied = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        expected = hmac.new(
            JWT_SECRET.encode(),
            f"email-unsubscribe:{encoded_id}".encode(),
            hashlib.sha256,
        ).digest()[:20]
        if not hmac.compare_digest(expected, supplied):
            raise ValueError
        raw_id = base64.urlsafe_b64decode(encoded_id + "=" * (-len(encoded_id) % 4))
        return ObjectId(raw_id)
    except Exception:
        raise HTTPException(400, "This unsubscribe link is invalid")


def email_campaign_html(
    campaign: dict,
    recipient_name: str = "there",
    unsubscribe_url: str = "",
) -> str:
    """Build portable, inline-styled HTML for both preview and delivery."""
    radius = {"soft": "12px", "rounded": "24px", "pill": "34px"}.get(
        campaign.get("corner_style"), "24px"
    )
    background = campaign.get("background_color", "#050706")
    card = campaign.get("card_color", "#083f46")
    accent = campaign.get("accent_color", "#2dd4bf")
    text = campaign.get("text_color", "#ffffff")
    muted = campaign.get("muted_color", "#c7dedb")
    button_text = campaign.get("button_text_color", "#042f2e")
    preview = html.escape(campaign.get("preview_text", ""))
    image_url = campaign.get("image_url", "")
    image = (
        f'<img src="{html.escape(image_url, quote=True)}" alt="" width="600" '
        f'style="display:block;width:100%;max-height:330px;object-fit:cover;border-radius:{radius};margin:0 0 28px" />'
        if image_url
        else ""
    )
    cta_url = campaign.get("cta_url", "")
    if cta_url.startswith("/"):
        cta_url = f"{FRONTEND_URL.rstrip('/')}{cta_url}"
    cta = (
        f'<a href="{html.escape(cta_url, quote=True)}" style="display:inline-block;background:{accent};'
        f'color:{button_text};padding:14px 22px;border-radius:{radius};font-weight:800;text-decoration:none">'
        f'{html.escape(campaign.get("cta_label", ""))}</a>'
        if cta_url and campaign.get("cta_label")
        else ""
    )
    unsubscribe = (
        f'<a href="{html.escape(unsubscribe_url, quote=True)}" style="color:{muted};text-decoration:underline">Unsubscribe</a>'
        if unsubscribe_url
        else "Email preferences are managed by SavvyCampusDeals."
    )
    safe_message = html.escape(campaign.get("message", "")).replace("\n", "<br />")
    return f"""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;background:{background};font-family:Manrope,Arial,sans-serif;color:{text}">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0">{preview}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{background};padding:32px 14px"><tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:{card};border:1px solid {accent}55;border-radius:{radius};overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.28)">
          <tr><td style="padding:38px 34px 34px">
            <div style="font-size:12px;font-weight:800;letter-spacing:2.4px;color:{accent};text-transform:uppercase">{html.escape(campaign.get("eyebrow", ""))}</div>
            <div style="margin:16px 0 26px;height:3px;width:48px;background:{accent};border-radius:99px"></div>
            {image}
            <div style="font-size:14px;color:{muted};margin-bottom:12px">Hey {html.escape(recipient_name or 'there')},</div>
            <h1 style="margin:0;font-family:Outfit,Arial,sans-serif;font-size:38px;line-height:1.08;letter-spacing:-1px;color:{text}">{html.escape(campaign.get("heading", ""))}</h1>
            <p style="margin:20px 0 0;font-size:16px;line-height:1.75;color:{muted}">{safe_message}</p>
            <div style="margin-top:28px">{cta}</div>
          </td></tr>
          <tr><td style="border-top:1px solid {accent}33;padding:22px 34px;color:{muted};font-size:11px;line-height:1.6">
            Sent by SavvyCampusDeals · Student perks, made better.<br />{unsubscribe}
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>"""


def serialize_email_campaign(campaign: dict) -> dict:
    result = {
        key: campaign.get(key, "")
        for key in (
            "name", "subject", "preview_text", "heading", "message", "eyebrow",
            "cta_label", "cta_url", "image_url", "audience", "background_color",
            "card_color", "accent_color", "text_color", "muted_color",
            "button_text_color", "corner_style", "status", "last_error",
        )
    }
    result.update(
        {
            "id": str(campaign["_id"]),
            "scheduled_at": _admin_datetime(campaign.get("scheduled_at")),
            "created_at": _admin_datetime(campaign.get("created_at")),
            "updated_at": _admin_datetime(campaign.get("updated_at")),
            "started_at": _admin_datetime(campaign.get("started_at")),
            "completed_at": _admin_datetime(campaign.get("completed_at")),
            "stats": campaign.get(
                "stats", {"recipients": 0, "pending": 0, "sent": 0, "failed": 0}
            ),
        }
    )
    return result


def _track_email_campaign_task(task: asyncio.Task):
    _email_campaign_tasks.add(task)
    task.add_done_callback(_email_campaign_tasks.discard)


async def _run_email_campaign(campaign_id: ObjectId):
    campaign_key = str(campaign_id)
    if campaign_key in _running_email_campaigns:
        return
    _running_email_campaigns.add(campaign_key)
    try:
        while True:
            campaign = await db.email_campaigns.find_one({"_id": campaign_id})
            if not campaign or campaign.get("status") not in {"queued", "scheduled", "sending"}:
                return
            scheduled_at = _aware(campaign.get("scheduled_at"))
            now = datetime.now(timezone.utc)
            if scheduled_at and scheduled_at > now:
                await asyncio.sleep(min((scheduled_at - now).total_seconds(), 60))
                continue
            await db.email_campaigns.update_one(
                {"_id": campaign_id, "status": {"$in": ["queued", "scheduled", "sending"]}},
                {"$set": {"status": "sending", "started_at": campaign.get("started_at") or now}},
            )
            receipt = await db.email_campaign_recipients.find_one_and_update(
                {"campaign_id": campaign_id, "status": "pending"},
                {"$set": {"status": "sending", "attempted_at": now}},
                sort=[("created_at", 1)],
                return_document=ReturnDocument.AFTER,
            )
            if not receipt:
                await db.email_campaigns.update_one(
                    {"_id": campaign_id, "status": "sending"},
                    {"$set": {"status": "completed", "completed_at": now, "stats.pending": 0}},
                )
                return
            unsubscribe_url = (
                f"{PUBLIC_API_URL}/api/email/unsubscribe?token="
                f"{_campaign_unsubscribe_token(receipt['user_id'])}"
            )
            rendered = email_campaign_html(
                campaign, receipt.get("name") or "there", unsubscribe_url
            )
            outcome = await asyncio.to_thread(
                send_email, receipt["email"], campaign["subject"], rendered
            )
            final_status = "sent" if outcome["ok"] else "failed"
            await db.email_campaign_recipients.update_one(
                {"_id": receipt["_id"], "status": "sending"},
                {"$set": {"status": final_status, "sent_at": datetime.now(timezone.utc) if outcome["ok"] else None, "error": outcome.get("error") or ""}},
            )
            await db.email_campaigns.update_one(
                {"_id": campaign_id},
                {"$inc": {f"stats.{final_status}": 1, "stats.pending": -1}},
            )
            await asyncio.sleep(1 / EMAIL_CAMPAIGN_RATE_PER_SECOND)
    except Exception as exc:
        logger.exception("Email campaign worker failed")
        await db.email_campaigns.update_one(
            {"_id": campaign_id},
            {"$set": {"status": "paused", "last_error": str(exc), "updated_at": datetime.now(timezone.utc)}},
        )
    finally:
        _running_email_campaigns.discard(campaign_key)


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
    first_verification_reward = status == "approved" and not student.get(
        "verification_expiry"
    )
    if status == "approved":
        user_updates.update(
            {
                "student_number": student.get("student_number") or gen_student_number(),
                "verification_expiry": now + timedelta(days=365),
            }
        )
    await db.users.update_one({"_id": student["_id"]}, update)
    if first_verification_reward:
        await award_savvy_points(
            student["_id"],
            200,
            "verification",
            str(student["_id"]),
            "Student status verified",
            "Your verified student bonus is unlocked.",
        )
        await complete_pending_referral(student["_id"])

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
    student_query = {"role": "student"}
    not_submitted_query = {
        **student_query,
        "verification_status": {
            "$in": ["not_submitted", "unverified", None],
        },
    }
    (
        total_users,
        verified_students,
        not_submitted_students,
        pending,
        rejected,
        today_signups,
        brands,
        partners,
        redeemed,
    ) = await asyncio.gather(
        db.users.count_documents(student_query),
        db.users.count_documents(
            {**student_query, "verification_status": "approved"}
        ),
        db.users.count_documents(not_submitted_query),
        db.verifications.count_documents({"status": "pending"}),
        db.verifications.count_documents({"status": "rejected"}),
        db.users.count_documents(
            {**student_query, "created_at": {"$gte": today}}
        ),
        db.offers.distinct("brand"),
        db.users.count_documents(
            {"role": "outlet_partner", "active": {"$ne": False}}
        ),
        db.coupons.count_documents(
            {"outlet_id": {"$ne": None}, "status": "redeemed"}
        ),
    )
    return {
        "total_users": total_users,
        "verified_students": verified_students,
        "not_submitted_students": not_submitted_students,
        "pending_verifications": pending,
        "rejected_verifications": rejected,
        "today_signups": today_signups,
        "total_brands": len(brands),
        "outlet_partners": partners,
        "outlet_redemptions": redeemed,
    }


@api.get("/announcements")
async def active_announcements(user=Depends(get_current_user)):
    """Return the current five-day announcement collection for this account."""
    audiences = _announcement_audiences_for(user)
    if not audiences:
        return {"items": [], "unread_count": 0, "modal": None}
    now = datetime.now(timezone.utc)
    announcements = await db.announcements.find(
        {
            "published": True,
            "audience": {"$in": audiences},
            "starts_at": {"$lte": now},
            "expires_at": {"$gt": now},
        }
    ).sort([("priority", -1), ("starts_at", -1)]).to_list(50)
    announcement_ids = [item["_id"] for item in announcements]
    receipts = {
        item["announcement_id"]: item
        async for item in db.announcement_receipts.find(
            {
                "user_id": user["_id"],
                "announcement_id": {"$in": announcement_ids},
            }
        )
    }
    delivered_at = datetime.now(timezone.utc)
    for item in announcements:
        if item["_id"] not in receipts:
            await db.announcement_receipts.update_one(
                {"user_id": user["_id"], "announcement_id": item["_id"]},
                {"$setOnInsert": {"delivered_at": delivered_at}},
                upsert=True,
            )
    serialized = [
        serialize_announcement(item, receipts.get(item["_id"], {}))
        for item in announcements
    ]
    unseen = [item for item in serialized if not item["seen"]]
    return {
        "items": serialized,
        "unread_count": len(unseen),
        "modal": unseen[0] if unseen else None,
    }


async def _audience_checked_announcement(announcement_id: str, user: dict) -> dict:
    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(404, "Announcement not found")
    now = datetime.now(timezone.utc)
    announcement = await db.announcements.find_one(
        {
            "_id": announcement_oid,
            "published": True,
            "audience": {"$in": _announcement_audiences_for(user)},
            "starts_at": {"$lte": now},
            "expires_at": {"$gt": now},
        }
    )
    if not announcement:
        raise HTTPException(404, "Announcement not found")
    return announcement


@api.post("/announcements/{announcement_id}/seen")
async def mark_announcement_seen(
    announcement_id: str, user=Depends(get_current_user)
):
    announcement = await _audience_checked_announcement(announcement_id, user)
    now = datetime.now(timezone.utc)
    await db.announcement_receipts.update_one(
        {"user_id": user["_id"], "announcement_id": announcement["_id"]},
        {
            "$setOnInsert": {"delivered_at": now},
            "$set": {"seen_at": now},
        },
        upsert=True,
    )
    return {"ok": True}


@api.post("/announcements/{announcement_id}/click")
async def mark_announcement_clicked(
    announcement_id: str, user=Depends(get_current_user)
):
    announcement = await _audience_checked_announcement(announcement_id, user)
    now = datetime.now(timezone.utc)
    await db.announcement_receipts.update_one(
        {"user_id": user["_id"], "announcement_id": announcement["_id"]},
        {
            "$setOnInsert": {"delivered_at": now},
            "$set": {"seen_at": now, "clicked_at": now},
        },
        upsert=True,
    )
    return {"ok": True}


@api.get("/admin/announcements")
async def admin_announcements(admin=Depends(get_admin_user)):
    announcements = await db.announcements.find({}).sort("created_at", -1).to_list(200)
    items = []
    for announcement in announcements:
        receipt_query = {"announcement_id": announcement["_id"]}
        delivered, seen, clicked = await asyncio.gather(
            db.announcement_receipts.count_documents(receipt_query),
            db.announcement_receipts.count_documents(
                {**receipt_query, "seen_at": {"$ne": None}}
            ),
            db.announcement_receipts.count_documents(
                {**receipt_query, "clicked_at": {"$ne": None}}
            ),
        )
        items.append(
            serialize_announcement(
                announcement,
                stats={"delivered": delivered, "seen": seen, "clicked": clicked},
            )
        )
    return {"items": items, "lifetime_days": ANNOUNCEMENT_LIFETIME_DAYS}


@api.post("/admin/announcements")
async def admin_create_announcement(
    body: AdminAnnouncementIn, admin=Depends(get_admin_user)
):
    now = datetime.now(timezone.utc)
    document = {
        **_validated_announcement_payload(body),
        "created_at": now,
        "updated_at": now,
        "created_by": admin["_id"],
    }
    result = await db.announcements.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_announcement(document, stats={"delivered": 0, "seen": 0, "clicked": 0})


@api.put("/admin/announcements/{announcement_id}")
async def admin_update_announcement(
    announcement_id: str,
    body: AdminAnnouncementIn,
    admin=Depends(get_admin_user),
):
    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(404, "Announcement not found")
    updates = {
        **_validated_announcement_payload(body),
        "updated_at": datetime.now(timezone.utc),
        "updated_by": admin["_id"],
    }
    result = await db.announcements.update_one(
        {"_id": announcement_oid}, {"$set": updates}
    )
    if not result.matched_count:
        raise HTTPException(404, "Announcement not found")
    fresh = await db.announcements.find_one({"_id": announcement_oid})
    return serialize_announcement(fresh)


@api.delete("/admin/announcements/{announcement_id}")
async def admin_delete_announcement(
    announcement_id: str, admin=Depends(get_admin_user)
):
    try:
        announcement_oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(404, "Announcement not found")
    result = await db.announcements.delete_one({"_id": announcement_oid})
    if not result.deleted_count:
        raise HTTPException(404, "Announcement not found")
    await db.announcement_receipts.delete_many({"announcement_id": announcement_oid})
    return {"ok": True}


@api.get("/email/unsubscribe")
async def unsubscribe_from_campaigns(token: str = Query(..., min_length=20, max_length=200)):
    user_id = _decode_campaign_unsubscribe_token(token)
    result = await db.users.update_one(
        {"_id": user_id, "role": "student"},
        {"$set": {"marketing_email_opt_out": True, "marketing_email_opted_out_at": datetime.now(timezone.utc)}},
    )
    heading = "You’re unsubscribed" if result.matched_count else "Preference not found"
    message = (
        "You will no longer receive Savvy product and promotional emails. Essential account and security emails are unaffected."
        if result.matched_count
        else "We could not find an active student preference for this link."
    )
    return Response(
        content=f"""<!doctype html><html><body style="margin:0;background:#050505;color:#fff;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:40px;text-align:center"><div style="font-size:13px;letter-spacing:2px;color:#5eead4">SAVVY CAMPUS</div><h1>{heading}</h1><p style="color:#b4b4bd;line-height:1.7">{message}</p><a href="{html.escape(FRONTEND_URL)}" style="display:inline-block;margin-top:16px;background:#fff;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Back to Savvy</a></main></body></html>""",
        media_type="text/html",
    )


@api.get("/admin/email-campaigns/audience-count")
async def admin_email_campaign_audience_count(
    audience: str = Query("approved_students", max_length=40),
    admin=Depends(get_admin_user),
):
    return {
        "audience": audience,
        "count": await db.users.count_documents(_campaign_audience_query(audience)),
    }


@api.get("/admin/email-campaigns")
async def admin_email_campaigns(admin=Depends(get_admin_user)):
    campaigns = await db.email_campaigns.find({}).sort("created_at", -1).to_list(200)
    return {"items": [serialize_email_campaign(item) for item in campaigns]}


@api.post("/admin/email-campaigns")
async def admin_create_email_campaign(
    body: AdminEmailCampaignIn, admin=Depends(get_admin_user)
):
    now = datetime.now(timezone.utc)
    document = {
        **_validated_email_campaign_payload(body),
        "status": "draft",
        "stats": {"recipients": 0, "pending": 0, "sent": 0, "failed": 0},
        "created_at": now,
        "updated_at": now,
        "created_by": admin["_id"],
    }
    result = await db.email_campaigns.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_email_campaign(document)


@api.put("/admin/email-campaigns/{campaign_id}")
async def admin_update_email_campaign(
    campaign_id: str,
    body: AdminEmailCampaignIn,
    admin=Depends(get_admin_user),
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    campaign = await db.email_campaigns.find_one({"_id": campaign_oid})
    if not campaign:
        raise HTTPException(404, "Email campaign not found")
    if campaign.get("status") not in EMAIL_CAMPAIGN_EDITABLE_STATUSES:
        raise HTTPException(409, "A queued or completed campaign can no longer be edited")
    updates = {
        **_validated_email_campaign_payload(body),
        "status": "draft",
        "updated_at": datetime.now(timezone.utc),
        "updated_by": admin["_id"],
        "last_error": "",
    }
    await db.email_campaigns.update_one({"_id": campaign_oid}, {"$set": updates})
    fresh = await db.email_campaigns.find_one({"_id": campaign_oid})
    return serialize_email_campaign(fresh)


@api.delete("/admin/email-campaigns/{campaign_id}")
async def admin_delete_email_campaign(
    campaign_id: str, admin=Depends(get_admin_user)
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    result = await db.email_campaigns.delete_one(
        {"_id": campaign_oid, "status": {"$in": list(EMAIL_CAMPAIGN_EDITABLE_STATUSES)}}
    )
    if not result.deleted_count:
        raise HTTPException(409, "Only draft or cancelled campaigns can be deleted")
    await db.email_campaign_recipients.delete_many({"campaign_id": campaign_oid})
    return {"ok": True}


@api.post("/admin/email-campaigns/{campaign_id}/test")
async def admin_test_email_campaign(
    campaign_id: str,
    body: AdminEmailCampaignTestIn,
    admin=Depends(get_admin_user),
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    campaign = await db.email_campaigns.find_one({"_id": campaign_oid})
    if not campaign:
        raise HTTPException(404, "Email campaign not found")
    rendered = email_campaign_html(campaign, "Savvy Admin")
    outcome = await asyncio.to_thread(
        send_email, str(body.email), f"[TEST] {campaign['subject']}", rendered
    )
    await db.email_campaigns.update_one(
        {"_id": campaign_oid},
        {"$set": {"last_test_at": datetime.now(timezone.utc), "last_test_email": str(body.email), "last_test_ok": outcome["ok"]}},
    )
    if not outcome["ok"]:
        raise HTTPException(502, f"Test email could not be sent: {outcome.get('error') or 'provider error'}")
    return {"ok": True, "email": str(body.email)}


@api.post("/admin/email-campaigns/{campaign_id}/launch")
async def admin_launch_email_campaign(
    campaign_id: str,
    body: AdminEmailCampaignLaunchIn,
    admin=Depends(get_admin_user),
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    campaign = await db.email_campaigns.find_one({"_id": campaign_oid})
    if not campaign:
        raise HTTPException(404, "Email campaign not found")
    if campaign.get("status") != "draft":
        raise HTTPException(409, "Only a draft campaign can be launched")
    if body.confirmation.strip().upper() != "SEND":
        raise HTTPException(400, "Type SEND to confirm this campaign")
    locked = await db.email_campaigns.update_one(
        {"_id": campaign_oid, "status": "draft"},
        {"$set": {"status": "preparing", "updated_at": datetime.now(timezone.utc)}},
    )
    if not locked.matched_count:
        raise HTTPException(409, "This campaign is already being prepared or sent")
    recipients = await db.users.find(
        _campaign_audience_query(campaign["audience"]),
        {"name": 1, "email": 1},
    ).to_list(None)
    if len(recipients) != body.recipient_count:
        await db.email_campaigns.update_one(
            {"_id": campaign_oid, "status": "preparing"},
            {"$set": {"status": "draft"}},
        )
        raise HTTPException(
            409,
            f"The audience changed. Review the updated recipient count ({len(recipients)}) before sending.",
        )
    if not recipients:
        await db.email_campaigns.update_one(
            {"_id": campaign_oid, "status": "preparing"},
            {"$set": {"status": "draft"}},
        )
        raise HTTPException(400, "This audience currently has no eligible recipients")
    now = datetime.now(timezone.utc)
    await db.email_campaign_recipients.delete_many({"campaign_id": campaign_oid})
    try:
        await db.email_campaign_recipients.insert_many(
            [
                {
                    "campaign_id": campaign_oid,
                    "user_id": user["_id"],
                    "email": user["email"],
                    "name": user.get("name", ""),
                    "status": "pending",
                    "created_at": now,
                }
                for user in recipients
            ],
            ordered=False,
        )
    except BulkWriteError as exc:
        logger.warning(f"Campaign recipient dedupe: {exc.details.get('nInserted', 0)} inserted")
    scheduled_at = _aware(campaign.get("scheduled_at"))
    status = "scheduled" if scheduled_at and scheduled_at > now else "queued"
    changed = await db.email_campaigns.update_one(
        {"_id": campaign_oid, "status": "preparing"},
        {"$set": {"status": status, "launched_at": now, "launched_by": admin["_id"], "stats": {"recipients": len(recipients), "pending": len(recipients), "sent": 0, "failed": 0}}},
    )
    if not changed.matched_count:
        raise HTTPException(409, "This campaign could not be launched")
    _track_email_campaign_task(asyncio.create_task(_run_email_campaign(campaign_oid)))
    fresh = await db.email_campaigns.find_one({"_id": campaign_oid})
    return serialize_email_campaign(fresh)


@api.post("/admin/email-campaigns/{campaign_id}/cancel")
async def admin_cancel_email_campaign(
    campaign_id: str, admin=Depends(get_admin_user)
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    result = await db.email_campaigns.update_one(
        {"_id": campaign_oid, "status": {"$in": ["queued", "scheduled", "sending", "paused"]}},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc), "cancelled_by": admin["_id"]}},
    )
    if not result.matched_count:
        raise HTTPException(409, "This campaign cannot be cancelled")
    cancelled = await db.email_campaign_recipients.update_many(
        {"campaign_id": campaign_oid, "status": "pending"},
        {"$set": {"status": "cancelled"}},
    )
    if cancelled.modified_count:
        await db.email_campaigns.update_one(
            {"_id": campaign_oid},
            {"$inc": {"stats.pending": -cancelled.modified_count}},
        )
    fresh = await db.email_campaigns.find_one({"_id": campaign_oid})
    return serialize_email_campaign(fresh)


@api.post("/admin/email-campaigns/{campaign_id}/resume")
async def admin_resume_email_campaign(
    campaign_id: str, admin=Depends(get_admin_user)
):
    try:
        campaign_oid = ObjectId(campaign_id)
    except Exception:
        raise HTTPException(404, "Email campaign not found")
    result = await db.email_campaigns.update_one(
        {"_id": campaign_oid, "status": "paused"},
        {"$set": {"status": "queued", "last_error": "", "resumed_at": datetime.now(timezone.utc), "resumed_by": admin["_id"]}},
    )
    if not result.matched_count:
        raise HTTPException(409, "Only a paused campaign can be resumed")
    await db.email_campaign_recipients.update_many(
        {"campaign_id": campaign_oid, "status": "sending"},
        {"$set": {"status": "pending"}},
    )
    _track_email_campaign_task(asyncio.create_task(_run_email_campaign(campaign_oid)))
    fresh = await db.email_campaigns.find_one({"_id": campaign_oid})
    return serialize_email_campaign(fresh)


@api.get("/admin/referrals")
async def admin_referrals(
    q: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    admin=Depends(get_admin_user),
):
    """Referral leaderboard and student-level referral history."""
    search_match = None
    if q and q.strip():
        pattern = re.escape(q.strip())
        search_match = {
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"email": {"$regex": pattern, "$options": "i"}},
                {"college": {"$regex": pattern, "$options": "i"}},
                {"referral_code": {"$regex": pattern, "$options": "i"}},
            ]
        }

    leaderboard_pipeline: list[dict] = [
        {"$match": {"referrer_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$referrer_id",
                "fallback_email": {"$first": "$referrer_email"},
                "referral_count": {"$sum": 1},
                "points_awarded": {
                    "$sum": {"$ifNull": ["$points_awarded", 0]}
                },
                "latest_referral": {"$max": "$created_at"},
            }
        },
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "_id",
                "as": "referrer",
            }
        },
        {
            "$unwind": {
                "path": "$referrer",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$project": {
                "_id": 0,
                "referrer_id": "$_id",
                "name": {"$ifNull": ["$referrer.name", "Deleted student"]},
                "email": {
                    "$ifNull": ["$referrer.email", "$fallback_email"]
                },
                "college": {"$ifNull": ["$referrer.college", ""]},
                "referral_code": {
                    "$ifNull": ["$referrer.referral_code", ""]
                },
                "account_exists": {
                    "$ne": [
                        {"$ifNull": ["$referrer._id", None]},
                        None,
                    ]
                },
                "reward_points": {
                    "$ifNull": ["$referrer.reward_points", 0]
                },
                "referral_count": 1,
                "points_awarded": 1,
                "latest_referral": 1,
            }
        },
    ]
    if search_match:
        leaderboard_pipeline.append({"$match": search_match})
    leaderboard_pipeline.extend(
        [
            {
                "$sort": {
                    "referral_count": -1,
                    "latest_referral": -1,
                    "name": 1,
                }
            },
            {
                "$facet": {
                    "metadata": [{"$count": "total"}],
                    "items": [
                        {"$skip": (page - 1) * page_size},
                        {"$limit": page_size},
                    ],
                }
            },
        ]
    )

    (
        leaderboard_rows,
        total_referrals,
        referrer_ids,
        awarded_rows,
        verified_referred,
        top_rows,
    ) = await asyncio.gather(
        db.referrals.aggregate(leaderboard_pipeline).to_list(1),
        db.referrals.count_documents({}),
        db.referrals.distinct("referrer_id", {"referrer_id": {"$ne": None}}),
        db.referrals.aggregate(
            [
                {
                    "$group": {
                        "_id": None,
                        "points": {
                            "$sum": {"$ifNull": ["$points_awarded", 0]}
                        },
                    }
                }
            ]
        ).to_list(1),
        db.users.count_documents(
            {
                "role": "student",
                "referrer_id": {"$ne": None},
                "verification_status": "approved",
            }
        ),
        db.referrals.aggregate(
            [
                {"$match": {"referrer_id": {"$ne": None}}},
                {
                    "$group": {
                        "_id": "$referrer_id",
                        "fallback_email": {"$first": "$referrer_email"},
                        "referral_count": {"$sum": 1},
                    }
                },
                {"$sort": {"referral_count": -1}},
                {"$limit": 1},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "_id",
                        "foreignField": "_id",
                        "as": "referrer",
                    }
                },
                {
                    "$unwind": {
                        "path": "$referrer",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "name": {
                            "$ifNull": [
                                "$referrer.name",
                                "Deleted student",
                            ]
                        },
                        "email": {
                            "$ifNull": [
                                "$referrer.email",
                                "$fallback_email",
                            ]
                        },
                        "referral_count": 1,
                    }
                },
            ]
        ).to_list(1),
    )

    facet = leaderboard_rows[0] if leaderboard_rows else {}
    referrer_rows = facet.get("items", [])
    total_referrers = (
        facet.get("metadata", [{}])[0].get("total", 0)
        if facet.get("metadata")
        else 0
    )
    page_referrer_ids = [
        row["referrer_id"]
        for row in referrer_rows
        if row.get("referrer_id")
    ]

    referrals_by_referrer: dict[ObjectId, dict] = {}
    if page_referrer_ids:
        detail_rows = await db.referrals.aggregate(
            [
                {"$match": {"referrer_id": {"$in": page_referrer_ids}}},
                {"$sort": {"created_at": -1}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "referred_id",
                        "foreignField": "_id",
                        "as": "student",
                    }
                },
                {
                    "$unwind": {
                        "path": "$student",
                        "preserveNullAndEmptyArrays": True,
                    }
                },
                {
                    "$group": {
                        "_id": "$referrer_id",
                        "verified_referrals": {
                            "$sum": {
                                "$cond": [
                                    {
                                        "$eq": [
                                            "$student.verification_status",
                                            "approved",
                                        ]
                                    },
                                    1,
                                    0,
                                ]
                            }
                        },
                        "students": {
                            "$push": {
                                "id": "$referred_id",
                                "account_exists": {
                                    "$ne": [
                                        {
                                            "$ifNull": [
                                                "$student._id",
                                                None,
                                            ]
                                        },
                                        None,
                                    ]
                                },
                                "name": {
                                    "$ifNull": [
                                        "$student.name",
                                        "Deleted student",
                                    ]
                                },
                                "email": {
                                    "$ifNull": [
                                        "$student.email",
                                        "$referred_email",
                                    ]
                                },
                                "college": {
                                    "$ifNull": ["$student.college", ""]
                                },
                                "verification_status": {
                                    "$ifNull": [
                                        "$student.verification_status",
                                        "deleted",
                                    ]
                                },
                                "verification_expiry": (
                                    "$student.verification_expiry"
                                ),
                                "points_awarded": {
                                    "$ifNull": ["$points_awarded", 0]
                                },
                                "joined_at": "$created_at",
                            }
                        },
                    }
                },
                {
                    "$project": {
                        "verified_referrals": 1,
                        "students": {"$slice": ["$students", 50]},
                    }
                },
            ]
        ).to_list(page_size)
        referrals_by_referrer = {row["_id"]: row for row in detail_rows}

    items = []
    for row in referrer_rows:
        detail = referrals_by_referrer.get(row.get("referrer_id"), {})
        students = []
        for student in detail.get("students", []):
            status = student.get("verification_status", "not_submitted")
            if status == "unverified":
                status = "not_submitted"
            if status == "approved" and verification_has_expired(student):
                status = "expired"
            students.append(
                {
                    "id": (
                        str(student["id"])
                        if student.get("id")
                        else None
                    ),
                    "account_exists": student.get(
                        "account_exists",
                        False,
                    ),
                    "name": student.get("name", "Deleted student"),
                    "email": student.get("email", ""),
                    "college": student.get("college", ""),
                    "verification_status": status,
                    "points_awarded": student.get("points_awarded", 0),
                    "joined_at": student.get("joined_at"),
                }
            )
        items.append(
            {
                **row,
                "referrer_id": str(row["referrer_id"]),
                "verified_referrals": detail.get(
                    "verified_referrals",
                    0,
                ),
                "referred_students": students,
                "referrals_shown": len(students),
            }
        )

    return {
        "summary": {
            "total_referrals": total_referrals,
            "active_referrers": len(
                [referrer_id for referrer_id in referrer_ids if referrer_id]
            ),
            "verified_referred": verified_referred,
            "points_awarded": (
                awarded_rows[0].get("points", 0) if awarded_rows else 0
            ),
            "top_referrer": top_rows[0] if top_rows else None,
        },
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total_referrers,
    }


@api.get("/admin/users")
async def admin_users(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(get_admin_user),
):
    if status and status not in {
        "approved",
        "pending",
        "rejected",
        "expired",
        "not_submitted",
    }:
        raise HTTPException(400, "Invalid verification status")
    query: dict = {"role": "student"}
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
        {"role": "student", "verification_status": "pending"}
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
    user = await db.users.find_one({"_id": user_oid, "role": "student"})
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


def _admin_report_date_range(
    date_from: Optional[str], date_to: Optional[str]
) -> tuple[Optional[datetime], Optional[datetime]]:
    try:
        start = (
            datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=INDIA_TIMEZONE)
            if date_from
            else None
        )
        end = (
            datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=INDIA_TIMEZONE)
            + timedelta(days=1)
            if date_to
            else None
        )
    except ValueError:
        raise HTTPException(400, "Dates must use YYYY-MM-DD format")
    if start and end and end <= start:
        raise HTTPException(400, "End date must be on or after start date")
    return (
        start.astimezone(timezone.utc) if start else None,
        end.astimezone(timezone.utc) if end else None,
    )


def _with_date_range(
    query: dict, field: str, start: Optional[datetime], end: Optional[datetime]
) -> dict:
    if start or end:
        bounds = {}
        if start:
            bounds["$gte"] = start
        if end:
            bounds["$lt"] = end
        query[field] = bounds
    return query


async def _coupon_counts_by_outlet(query: dict) -> dict:
    rows = await db.coupons.aggregate(
        [
            {"$match": query},
            {"$group": {"_id": "$outlet_id", "count": {"$sum": 1}}},
        ]
    ).to_list(1000)
    return {row["_id"]: row["count"] for row in rows if row.get("_id")}


def _report_coupon_status(coupon: dict, now: Optional[datetime] = None) -> str:
    """Expose stale active coupons as expired without mutating coupon records."""
    status = coupon.get("status", "active")
    current_time = now or datetime.now(timezone.utc)
    if (
        status == "active"
        and coupon.get("expires_at")
        and _aware(coupon["expires_at"]) <= current_time
    ):
        return "expired"
    return status if status in {"active", "redeemed", "expired"} else "expired"


def _brand_outlet_report_rows(
    outlets: list[dict],
    offers: list[dict],
    coupons: list[dict],
    now: Optional[datetime] = None,
) -> list[dict]:
    """Build report rows from existing records; this never changes source data."""
    current_time = now or datetime.now(timezone.utc)
    entities: dict[tuple[str, str], dict] = {}
    offer_entity: dict[Any, tuple[str, str]] = {}
    offer_by_id = {offer.get("_id"): offer for offer in offers}

    for outlet in outlets:
        key = ("outlet", str(outlet["_id"]))
        entities[key] = {
            "id": str(outlet["_id"]),
            "type": "outlet",
            "name": outlet.get("name", ""),
            "logo_url": outlet.get("logo_url", ""),
            "website": "",
            "address": outlet.get("address", ""),
            "city": outlet.get("city", ""),
            "phone": outlet.get("phone", ""),
            "offer_count": 0,
            "claimed": 0,
            "active": 0,
            "redeemed": 0,
            "expired": 0,
            "unique_students": 0,
            "last_redeemed_at": None,
            "offers": [],
            "recent_activity": [],
            "_students": set(),
            "_offer_rows": {},
        }

    brand_keys: dict[str, tuple[str, str]] = {}
    for offer in offers:
        outlet_id = offer.get("outlet_id")
        if outlet_id:
            key = ("outlet", str(outlet_id))
            if key not in entities:
                continue
        else:
            brand_name = (offer.get("brand") or "Unnamed brand").strip()
            normalized = brand_name.casefold()
            key = brand_keys.get(normalized)
            if not key:
                key = ("brand", brand_name)
                brand_keys[normalized] = key
                entities[key] = {
                    "id": brand_name,
                    "type": "brand",
                    "name": brand_name,
                    "logo_url": offer.get("brand_logo", ""),
                    "website": offer.get("brand_url", ""),
                    "address": "",
                    "city": "",
                    "phone": "",
                    "offer_count": 0,
                    "claimed": 0,
                    "active": 0,
                    "redeemed": 0,
                    "expired": 0,
                    "unique_students": 0,
                    "last_redeemed_at": None,
                    "offers": [],
                    "recent_activity": [],
                    "_students": set(),
                    "_offer_rows": {},
                }
            elif not entities[key]["logo_url"] and offer.get("brand_logo"):
                entities[key]["logo_url"] = offer["brand_logo"]
            if not entities[key]["website"] and offer.get("brand_url"):
                entities[key]["website"] = offer["brand_url"]

        offer_id = offer.get("_id")
        offer_entity[offer_id] = key
        entity = entities[key]
        entity["offer_count"] += 1
        entity["_offer_rows"][offer_id] = {
            "id": str(offer_id),
            "title": offer.get("title", ""),
            "discount": offer.get("discount", ""),
            "claimed": 0,
            "active": 0,
            "redeemed": 0,
            "expired": 0,
            "unique_students": 0,
            "redemption_rate": 0,
            "_students": set(),
        }

    for coupon in coupons:
        offer = offer_by_id.get(coupon.get("offer_id"))
        key = offer_entity.get(coupon.get("offer_id"))
        if not key and coupon.get("outlet_id"):
            key = ("outlet", str(coupon["outlet_id"]))
        if not key or key not in entities:
            continue
        entity = entities[key]
        is_brand_claim = coupon.get("record_type") == "brand_offer_claim"
        status = "claimed" if is_brand_claim else _report_coupon_status(coupon, current_time)
        entity["claimed"] += 1
        if not is_brand_claim:
            entity[status] += 1
        if coupon.get("user_id"):
            entity["_students"].add(coupon["user_id"])
        redeemed_at = coupon.get("redeemed_at")
        if redeemed_at and (
            not entity["last_redeemed_at"]
            or _aware(redeemed_at) > _aware(entity["last_redeemed_at"])
        ):
            entity["last_redeemed_at"] = redeemed_at

        offer_row = entity["_offer_rows"].get(coupon.get("offer_id"))
        if offer_row:
            offer_row["claimed"] += 1
            if not is_brand_claim:
                offer_row[status] += 1
            if coupon.get("user_id"):
                offer_row["_students"].add(coupon["user_id"])
        entity["recent_activity"].append(
            {
                "id": str(coupon.get("_id", "")),
                "code": coupon.get("code", ""),
                "offer_title": (offer or {}).get("title", ""),
                "status": status,
                "claimed_at": _admin_datetime(coupon.get("created_at")),
                "redeemed_at": _admin_datetime(redeemed_at),
            }
        )

    result = []
    for entity in entities.values():
        entity["unique_students"] = len(entity.pop("_students"))
        entity["redemption_rate"] = round(
            (entity["redeemed"] / entity["claimed"] * 100) if entity["claimed"] else 0,
            1,
        )
        offer_rows = list(entity.pop("_offer_rows").values())
        for offer_row in offer_rows:
            offer_row["unique_students"] = len(offer_row.pop("_students"))
            offer_row["redemption_rate"] = round(
                (offer_row["redeemed"] / offer_row["claimed"] * 100)
                if offer_row["claimed"]
                else 0,
                1,
            )
        entity["offers"] = sorted(offer_rows, key=lambda row: row["title"].casefold())
        entity["recent_activity"] = sorted(
            entity["recent_activity"],
            key=lambda row: row.get("claimed_at") or "",
            reverse=True,
        )[:10]
        entity["last_redeemed_at"] = _admin_datetime(entity["last_redeemed_at"])
        result.append(entity)
    return sorted(result, key=lambda row: (row["type"] != "outlet", row["name"].casefold()))


def _csv_cell(value: Any) -> Any:
    """Prevent spreadsheet applications from treating exported text as formulas."""
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


async def _analytics_daily_counts(collection, query: dict, date_field: str) -> dict:
    rows = await collection.aggregate(
        [
            {"$match": query},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": f"${date_field}",
                            "timezone": "Asia/Kolkata",
                        }
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
    ).to_list(400)
    return {row["_id"]: row["count"] for row in rows if row.get("_id")}


def canonical_college_name(value: str) -> str:
    """Group known college aliases for admin analytics without changing stored data."""
    cleaned = re.sub(r"[^a-z0-9&]+", " ", (value or "").casefold()).strip()
    cleaned = re.sub(
        r"\b(?:univeristy|unversity|univercity)\b",
        "university",
        cleaned,
    )
    cleaned = re.sub(r"\s+", " ", cleaned)

    # Keep aliases explicit: broad fuzzy matching can merge different colleges.
    if re.match(r"^a?amity university(?:\s+.*)?$", cleaned):
        return "Amity University"
    if cleaned in {"amity", "amity noida", "aamity"}:
        return "Amity University"

    aliases = {
        "iitd": "Indian Institute of Technology Delhi",
        "iit delhi": "Indian Institute of Technology Delhi",
        "indian institute of technology delhi": "Indian Institute of Technology Delhi",
        "indian institute of technology new delhi": "Indian Institute of Technology Delhi",
        "iitb": "Indian Institute of Technology Bombay",
        "iit bombay": "Indian Institute of Technology Bombay",
        "iit mumbai": "Indian Institute of Technology Bombay",
        "indian institute of technology bombay": "Indian Institute of Technology Bombay",
        "indian institute of technology mumbai": "Indian Institute of Technology Bombay",
        "vit": "Vellore Institute of Technology",
        "vit university": "Vellore Institute of Technology",
        "vit vellore": "Vellore Institute of Technology",
        "vellore institute of technology": "Vellore Institute of Technology",
        "vellore institute of technology vellore": "Vellore Institute of Technology",
        "kiet": "KIET University",
        "kiets": "KIET University",
        "kiet university": "KIET University",
        "kiet deemed to be university": "KIET University",
        "kiet group of institutions": "KIET University",
        "krishna institute of engineering and technology": "KIET University",
        "ipec": "Inderprastha Engineering College",
        "inderprastha engineering college": "Inderprastha Engineering College",
        "inderprastha engineering college ghaziabad": "Inderprastha Engineering College",
        "indraprastha engineering college": "Inderprastha Engineering College",
        "indraprastha engineering college ghaziabad": "Inderprastha Engineering College",
        "its": "Institute of Technology & Science, Ghaziabad",
        "i t s": "Institute of Technology & Science, Ghaziabad",
        "its ghaziabad": "Institute of Technology & Science, Ghaziabad",
        "i t s ghaziabad": "Institute of Technology & Science, Ghaziabad",
        "institute of technology & science": "Institute of Technology & Science, Ghaziabad",
        "institute of technology & science ghaziabad": "Institute of Technology & Science, Ghaziabad",
        "institute of technology and science": "Institute of Technology & Science, Ghaziabad",
        "institute of technology and science ghaziabad": "Institute of Technology & Science, Ghaziabad",
        "its college of pharmacy": "I.T.S College of Pharmacy",
        "i t s college of pharmacy": "I.T.S College of Pharmacy",
        "iitm": "Indian Institute of Technology Madras",
        "iit madras": "Indian Institute of Technology Madras",
        "iit chennai": "Indian Institute of Technology Madras",
        "indian institute of technology madras": "Indian Institute of Technology Madras",
        "indian institute of technology chennai": "Indian Institute of Technology Madras",
        "manit": "Maulana Azad National Institute of Technology",
        "maulana azad national institute of technology": "Maulana Azad National Institute of Technology",
        "maulana azad national institute of technology bhopal": "Maulana Azad National Institute of Technology",
        "motilal nehru college": "Motilal Nehru College",
        "motilal nehru college du": "Motilal Nehru College",
        "motilal nehru college university of delhi": "Motilal Nehru College",
        "rd engineering college": "R.D. Engineering College",
        "r d engineering college": "R.D. Engineering College",
        "rdec": "R.D. Engineering College",
    }
    if cleaned in aliases:
        return aliases[cleaned]
    if re.match(r"^kiet(?:s| university| group of institutions)?(?: ghaziabad)?$", cleaned):
        return "KIET University"
    if re.match(r"^i t s(?: mohan nagar)?(?: ghaziabad)?$", cleaned):
        return "Institute of Technology & Science, Ghaziabad"

    acronyms = {"du", "iiit", "iit", "ipec", "its", "kiet", "manit", "nit", "vit"}
    return " ".join(
        word.upper() if word in acronyms else word.title()
        for word in cleaned.split()
    )


@api.get("/admin/analytics")
async def admin_analytics(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    admin=Depends(get_admin_user),
):
    """Read-only growth, verification, and outlet activity analytics."""
    start, end = _admin_report_date_range(date_from, date_to)
    tomorrow_india = (
        datetime.now(INDIA_TIMEZONE) + timedelta(days=1)
    ).replace(hour=0, minute=0, second=0, microsecond=0)
    if end is None:
        end = tomorrow_india.astimezone(timezone.utc)
    if start is None:
        start = end - timedelta(days=30)
    if end <= start:
        raise HTTPException(400, "End date must be on or after start date")
    if end - start > timedelta(days=366):
        raise HTTPException(400, "Analytics date range cannot exceed 366 days")

    student_query = {"role": "student"}
    registration_query = _with_date_range(
        {**student_query}, "created_at", start, end
    )
    approval_query = _with_date_range(
        {"status": "approved"}, "reviewed_at", start, end
    )
    redemption_query = _with_date_range(
        {
            "outlet_id": {"$ne": None},
            "status": "redeemed",
        },
        "redeemed_at",
        start,
        end,
    )
    issued_query = _with_date_range(
        {"outlet_id": {"$ne": None}}, "created_at", start, end
    )
    redeemed_issued_query = _with_date_range(
        {"outlet_id": {"$ne": None}, "status": "redeemed"},
        "created_at",
        start,
        end,
    )

    (
        total_students,
        verified_students,
        submitted_students,
        period_registrations,
        period_approvals,
        period_redemptions,
        period_issued,
        registration_trend,
        approval_trend,
        redemption_trend,
        college_rows,
        college_missing,
        status_rows,
        user_status_rows,
        issued_by_outlet,
        redeemed_by_outlet,
        outlets,
    ) = await asyncio.gather(
        db.users.count_documents(student_query),
        db.users.count_documents(
            {**student_query, "verification_status": "approved"}
        ),
        db.users.count_documents(
            {
                **student_query,
                "verification_status": {
                    "$nin": ["not_submitted", "unverified", None]
                },
            }
        ),
        db.users.count_documents(registration_query),
        db.verifications.count_documents(approval_query),
        db.coupons.count_documents(redemption_query),
        db.coupons.count_documents(issued_query),
        _analytics_daily_counts(db.users, registration_query, "created_at"),
        _analytics_daily_counts(
            db.verifications, approval_query, "reviewed_at"
        ),
        _analytics_daily_counts(db.coupons, redemption_query, "redeemed_at"),
        db.users.aggregate(
            [
                {"$match": registration_query},
                {
                    "$project": {
                        "college": {
                            "$trim": {"input": {"$ifNull": ["$college", ""]}}
                        }
                    }
                },
                {"$match": {"college": {"$ne": ""}}},
                {
                    "$group": {
                        "_id": {"$toLower": "$college"},
                        "college": {"$first": "$college"},
                        "registrations": {"$sum": 1},
                    }
                },
                {"$sort": {"registrations": -1, "college": 1}},
            ]
        ).to_list(2000),
        db.users.count_documents(
            {
                **registration_query,
                "$or": [
                    {"college": {"$exists": False}},
                    {"college": None},
                    {"college": {"$regex": r"^\s*$"}},
                ],
            }
        ),
        db.coupons.aggregate(
            [
                {"$match": issued_query},
                {
                    "$group": {
                        "_id": {"$ifNull": ["$status", "unknown"]},
                        "count": {"$sum": 1},
                    }
                },
            ]
        ).to_list(10),
        db.users.aggregate(
            [
                {"$match": student_query},
                {
                    "$project": {
                        "status": {
                            "$cond": [
                                {
                                    "$and": [
                                        {
                                            "$eq": [
                                                {
                                                    "$ifNull": [
                                                        "$verification_status",
                                                        "not_submitted",
                                                    ]
                                                },
                                                "approved",
                                            ]
                                        },
                                        {
                                            "$ne": [
                                                {
                                                    "$ifNull": [
                                                        "$verification_expiry",
                                                        None,
                                                    ]
                                                },
                                                None,
                                            ]
                                        },
                                        {
                                            "$lt": [
                                                "$verification_expiry",
                                                datetime.now(timezone.utc),
                                            ]
                                        },
                                    ]
                                },
                                "expired",
                                {
                                    "$ifNull": [
                                        "$verification_status",
                                        "not_submitted",
                                    ]
                                },
                            ]
                        }
                    }
                },
                {
                    "$group": {
                        "_id": "$status",
                        "count": {"$sum": 1},
                    }
                },
            ]
        ).to_list(10),
        _coupon_counts_by_outlet(issued_query),
        _coupon_counts_by_outlet(redeemed_issued_query),
        db.outlets.find({}).sort("name", 1).to_list(1000),
    )

    start_date = start.astimezone(INDIA_TIMEZONE).date()
    end_date = (end.astimezone(INDIA_TIMEZONE) - timedelta(microseconds=1)).date()
    trend = []
    current_date = start_date
    while current_date <= end_date:
        key = current_date.isoformat()
        trend.append(
            {
                "date": key,
                "registrations": registration_trend.get(key, 0),
                "approvals": approval_trend.get(key, 0),
                "redemptions": redemption_trend.get(key, 0),
            }
        )
        current_date += timedelta(days=1)

    top_outlets = sorted(
        [
            {
                "outlet_id": str(outlet["_id"]),
                "outlet_name": outlet.get("name", ""),
                "city": outlet.get("city", ""),
                "issued": issued_by_outlet.get(outlet["_id"], 0),
                "redeemed": redeemed_by_outlet.get(outlet["_id"], 0),
                "redemption_rate": round(
                    (
                        redeemed_by_outlet.get(outlet["_id"], 0)
                        / issued_by_outlet.get(outlet["_id"], 0)
                        * 100
                    ),
                    1,
                )
                if issued_by_outlet.get(outlet["_id"], 0)
                else 0,
            }
            for outlet in outlets
            if issued_by_outlet.get(outlet["_id"], 0)
            or redeemed_by_outlet.get(outlet["_id"], 0)
        ],
        key=lambda row: (-row["redeemed"], -row["issued"], row["outlet_name"]),
    )[:10]

    status_counts = {
        row["_id"]: row["count"] for row in status_rows if row.get("_id")
    }
    user_status_counts = {
        status: 0
        for status in (
            "not_submitted",
            "pending",
            "approved",
            "rejected",
            "expired",
        )
    }
    for row in user_status_rows:
        status = row.get("_id")
        if status in {None, "unverified", "not_submitted"}:
            status = "not_submitted"
        if status in user_status_counts:
            user_status_counts[status] += row.get("count", 0)

    grouped_colleges: dict[str, int] = {}
    for row in college_rows:
        college = canonical_college_name(row.get("college") or "")
        if college:
            grouped_colleges[college] = (
                grouped_colleges.get(college, 0)
                + row.get("registrations", 0)
            )
    top_colleges = sorted(
        grouped_colleges.items(),
        key=lambda item: (-item[1], item[0]),
    )[:12]

    verification_rate = (
        round(verified_students / total_students * 100, 1)
        if total_students
        else 0
    )
    return {
        "period": {
            "date_from": start_date.isoformat(),
            "date_to": end_date.isoformat(),
        },
        "summary": {
            "total_students": total_students,
            "verified_students": verified_students,
            "verification_rate": verification_rate,
            "registrations": period_registrations,
            "approvals": period_approvals,
            "redemptions": period_redemptions,
            "issued": period_issued,
        },
        "trend": trend,
        "verification_funnel": {
            "registered": total_students,
            "submitted": submitted_students,
            "approved": verified_students,
        },
        "college_registrations": [
            {
                "college": college,
                "registrations": registrations,
            }
            for college, registrations in top_colleges
        ],
        "registrations_without_college": college_missing,
        "user_status": [
            {"status": status, "count": user_status_counts[status]}
            for status in (
                "not_submitted",
                "pending",
                "approved",
                "rejected",
                "expired",
            )
        ],
        "redemption_status": [
            {"status": status, "count": status_counts.get(status, 0)}
            for status in ("active", "redeemed", "expired")
        ],
        "top_outlets": top_outlets,
    }


@api.get("/admin/outlet-redemptions")
async def admin_outlet_redemptions(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    admin=Depends(get_admin_user),
):
    if status and status not in {"active", "redeemed", "expired"}:
        raise HTTPException(400, "Invalid coupon status")
    selected_outlet_oid = None
    if outlet_id:
        try:
            selected_outlet_oid = ObjectId(outlet_id)
        except Exception:
            raise HTTPException(404, "Outlet not found")
        if not await db.outlets.find_one({"_id": selected_outlet_oid}, {"_id": 1}):
            raise HTTPException(404, "Outlet not found")

    start, end = _admin_report_date_range(date_from, date_to)
    outlets = await db.outlets.find({}).sort("name", 1).to_list(1000)
    outlet_by_id = {outlet["_id"]: outlet for outlet in outlets}

    base = {"outlet_id": {"$ne": None}}
    issued_query = _with_date_range({**base}, "created_at", start, end)
    active_query = _with_date_range(
        {**base, "status": "active"}, "created_at", start, end
    )
    expired_query = _with_date_range(
        {**base, "status": "expired"}, "created_at", start, end
    )
    redeemed_query = _with_date_range(
        {**base, "status": "redeemed"}, "redeemed_at", start, end
    )
    issued_counts, active_counts, expired_counts, redeemed_counts = await asyncio.gather(
        _coupon_counts_by_outlet(issued_query),
        _coupon_counts_by_outlet(active_query),
        _coupon_counts_by_outlet(expired_query),
        _coupon_counts_by_outlet(redeemed_query),
    )
    summary = [
        {
            "outlet_id": str(outlet["_id"]),
            "outlet_name": outlet.get("name", ""),
            "city": outlet.get("city", ""),
            "issued": issued_counts.get(outlet["_id"], 0),
            "active": active_counts.get(outlet["_id"], 0),
            "redeemed": redeemed_counts.get(outlet["_id"], 0),
            "expired": expired_counts.get(outlet["_id"], 0),
        }
        for outlet in outlets
    ]
    if selected_outlet_oid:
        summary = [
            row for row in summary if row["outlet_id"] == str(selected_outlet_oid)
        ]

    detail_query: dict = {**base}
    if selected_outlet_oid:
        detail_query["outlet_id"] = selected_outlet_oid
    if status:
        detail_query["status"] = status
    if start or end:
        if status == "redeemed":
            _with_date_range(detail_query, "redeemed_at", start, end)
        elif status in {"active", "expired"}:
            _with_date_range(detail_query, "created_at", start, end)
        else:
            created_bounds = {}
            redeemed_bounds = {}
            if start:
                created_bounds["$gte"] = start
                redeemed_bounds["$gte"] = start
            if end:
                created_bounds["$lt"] = end
                redeemed_bounds["$lt"] = end
            detail_query["$or"] = [
                {"status": "redeemed", "redeemed_at": redeemed_bounds},
                {"status": {"$ne": "redeemed"}, "created_at": created_bounds},
            ]

    total = await db.coupons.count_documents(detail_query)
    coupons = await (
        db.coupons.find(detail_query)
        .sort([("redeemed_at", -1), ("created_at", -1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list(page_size)
    )
    student_ids = {coupon.get("user_id") for coupon in coupons if coupon.get("user_id")}
    offer_ids = {coupon.get("offer_id") for coupon in coupons if coupon.get("offer_id")}
    approver_ids = {
        coupon.get("approved_by_user_id") or coupon.get("redeemed_by_user_id")
        for coupon in coupons
        if coupon.get("approved_by_user_id") or coupon.get("redeemed_by_user_id")
    }
    students, offers, approvers = await asyncio.gather(
        db.users.find({"_id": {"$in": list(student_ids)}}).to_list(len(student_ids) or 1),
        db.offers.find({"_id": {"$in": list(offer_ids)}}).to_list(len(offer_ids) or 1),
        db.users.find({"_id": {"$in": list(approver_ids)}}).to_list(len(approver_ids) or 1),
    )
    student_by_id = {student["_id"]: student for student in students}
    offer_by_id = {offer["_id"]: offer for offer in offers}
    approver_by_id = {approver["_id"]: approver for approver in approvers}
    items = []
    for coupon in coupons:
        student = student_by_id.get(coupon.get("user_id"), {})
        offer = offer_by_id.get(coupon.get("offer_id"), {})
        outlet = outlet_by_id.get(coupon.get("outlet_id"), {})
        approver_id = coupon.get("approved_by_user_id") or coupon.get("redeemed_by_user_id")
        approver = approver_by_id.get(approver_id, {})
        items.append(
            {
                "id": str(coupon["_id"]),
                "code": coupon.get("code", ""),
                "status": coupon.get("status", ""),
                "student_name": student.get("name", ""),
                "student_number": student.get("student_number", ""),
                "student_email": student.get("email", ""),
                "offer_title": offer.get("title", ""),
                "discount": offer.get("discount", ""),
                "outlet_id": str(coupon.get("outlet_id")) if coupon.get("outlet_id") else None,
                "outlet_name": outlet.get("name", ""),
                "claimed_at": _admin_datetime(coupon.get("created_at")),
                "approved_at": _admin_datetime(
                    coupon.get("approved_at") or coupon.get("redeemed_at")
                ),
                "redeemed_at": _admin_datetime(coupon.get("redeemed_at")),
                "approved_by_name": approver.get("name", "Legacy scanner"),
                "approved_by_email": approver.get("email", ""),
                "legacy_approval": not bool(approver),
            }
        )
    return {
        "summary": summary,
        "items": items,
        "outlets": [
            {"id": str(outlet["_id"]), "name": outlet.get("name", ""), "city": outlet.get("city", "")}
            for outlet in outlets
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


async def _load_brand_outlet_report_data(
    start: Optional[datetime], end: Optional[datetime]
) -> tuple[list[dict], list[dict], list[dict]]:
    coupon_query = _with_date_range(
        {"status": {"$ne": "archived"}}, "created_at", start, end
    )
    brand_claim_query = _with_date_range({}, "claimed_at", start, end)
    outlets, offers, coupons, brand_claims = await asyncio.gather(
        db.outlets.find({}).sort("name", 1).to_list(None),
        db.offers.find({}).sort("title", 1).to_list(None),
        db.coupons.find(
            coupon_query,
            {
                "_id": 1,
                "offer_id": 1,
                "outlet_id": 1,
                "user_id": 1,
                "code": 1,
                "status": 1,
                "created_at": 1,
                "expires_at": 1,
                "redeemed_at": 1,
            },
        ).to_list(None),
        db.brand_offer_claims.find(
            brand_claim_query,
            {
                "_id": 1,
                "offer_id": 1,
                "user_id": 1,
                "claimed_at": 1,
                "last_visited_at": 1,
                "visit_count": 1,
            },
        ).to_list(None),
    )
    brand_claim_keys = {
        (claim.get("user_id"), claim.get("offer_id")) for claim in brand_claims
    }
    coupons = [
        coupon
        for coupon in coupons
        if coupon.get("outlet_id")
        or (coupon.get("user_id"), coupon.get("offer_id")) not in brand_claim_keys
    ]
    coupons.extend(
        {
            **claim,
            "record_type": "brand_offer_claim",
            "created_at": claim.get("claimed_at"),
            "status": "claimed",
            "code": "",
            "outlet_id": None,
            "redeemed_at": None,
        }
        for claim in brand_claims
    )
    return outlets, offers, coupons


@api.get("/admin/brands-outlets")
async def admin_brands_outlets(
    entity_type: str = Query("all", alias="type"),
    q: Optional[str] = Query(None, max_length=100),
    city: Optional[str] = Query(None, max_length=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    admin=Depends(get_admin_user),
):
    """Read-only partner performance grouped by outlet or online brand."""
    if entity_type not in {"all", "outlet", "brand"}:
        raise HTTPException(400, "Type must be all, outlet, or brand")
    start, end = _admin_report_date_range(date_from, date_to)
    outlets, offers, coupons = await _load_brand_outlet_report_data(start, end)
    rows = _brand_outlet_report_rows(outlets, offers, coupons)

    available_cities = sorted(
        {row["city"] for row in rows if row["type"] == "outlet" and row["city"]},
        key=str.casefold,
    )
    if entity_type != "all":
        rows = [row for row in rows if row["type"] == entity_type]
    if city:
        rows = [row for row in rows if row["city"].casefold() == city.casefold()]
    if q and q.strip():
        needle = q.strip().casefold()
        rows = [
            row
            for row in rows
            if needle
            in " ".join(
                [row["name"], row["address"], row["city"], row["website"]]
            ).casefold()
        ]

    return {
        "summary": {
            "entities": len(rows),
            "outlets": sum(row["type"] == "outlet" for row in rows),
            "brands": sum(row["type"] == "brand" for row in rows),
            "offers": sum(row["offer_count"] for row in rows),
            "claimed": sum(row["claimed"] for row in rows),
            "active": sum(row["active"] for row in rows),
            "redeemed": sum(row["redeemed"] for row in rows),
            "expired": sum(row["expired"] for row in rows),
        },
        "items": rows,
        "cities": available_cities,
        "date_basis": "Coupons are grouped alongside listed brand claims by their claimed date; coupon statuses are current.",
    }


@api.get("/admin/brands-outlets/claims")
async def admin_brand_outlet_claims(
    entity_type: str = Query(..., alias="type"),
    entity_id: str = Query(..., min_length=1, max_length=200),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    admin=Depends(get_admin_user),
):
    """Show which students claimed offers for one brand or outlet."""
    if entity_type not in {"outlet", "brand"}:
        raise HTTPException(400, "Type must be outlet or brand")
    if status and status not in {"claimed", "active", "redeemed", "expired"}:
        raise HTTPException(400, "Invalid claim status")

    start, end = _admin_report_date_range(date_from, date_to)
    outlets, offers, activities = await _load_brand_outlet_report_data(start, end)
    if entity_type == "outlet":
        try:
            outlet_oid = ObjectId(entity_id)
        except Exception:
            raise HTTPException(404, "Outlet not found")
        if not any(outlet.get("_id") == outlet_oid for outlet in outlets):
            raise HTTPException(404, "Outlet not found")
        entity_offers = [offer for offer in offers if offer.get("outlet_id") == outlet_oid]
    else:
        entity_offers = [
            offer
            for offer in offers
            if not offer.get("outlet_id")
            and (offer.get("brand") or "Unnamed brand").strip().casefold()
            == entity_id.casefold()
        ]
        if not entity_offers:
            raise HTTPException(404, "Brand not found")

    offer_by_id = {offer["_id"]: offer for offer in entity_offers}
    matching = []
    for activity in activities:
        if activity.get("offer_id") not in offer_by_id:
            continue
        is_brand_claim = activity.get("record_type") == "brand_offer_claim"
        effective_status = (
            "claimed" if is_brand_claim else _report_coupon_status(activity)
        )
        if status and effective_status != status:
            continue
        matching.append((activity, effective_status, is_brand_claim))
    matching.sort(
        key=lambda row: _aware(row[0].get("created_at"))
        if row[0].get("created_at")
        else datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    total = len(matching)
    selected = matching[(page - 1) * page_size : page * page_size]
    student_ids = {
        activity.get("user_id")
        for activity, _, _ in selected
        if activity.get("user_id")
    }
    students = await db.users.find(
        {"_id": {"$in": list(student_ids)}},
        {"name": 1, "email": 1, "college": 1, "student_number": 1},
    ).to_list(len(student_ids) or 1)
    student_by_id = {student["_id"]: student for student in students}
    items = []
    for activity, effective_status, is_brand_claim in selected:
        student = student_by_id.get(activity.get("user_id"), {})
        offer = offer_by_id.get(activity.get("offer_id"), {})
        items.append(
            {
                "id": str(activity.get("_id", "")),
                "student_id": str(activity.get("user_id", "")),
                "student_name": student.get("name", ""),
                "student_email": student.get("email", ""),
                "student_college": student.get("college", ""),
                "student_number": student.get("student_number", ""),
                "offer_id": str(activity.get("offer_id", "")),
                "offer_title": offer.get("title", ""),
                "discount": offer.get("discount", ""),
                "status": effective_status,
                "interaction_type": "brand_claim" if is_brand_claim else "coupon",
                "claimed_at": _admin_datetime(activity.get("created_at")),
                "redeemed_at": _admin_datetime(activity.get("redeemed_at")),
                "last_visited_at": _admin_datetime(activity.get("last_visited_at")),
                "visit_count": activity.get("visit_count", 1) if is_brand_claim else None,
            }
        )
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@api.get("/admin/brands-outlets/export")
async def admin_brands_outlets_export(
    entity_type: str = Query(..., alias="type"),
    entity_id: str = Query(..., min_length=1, max_length=200),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    admin=Depends(get_admin_user),
):
    """Export a privacy-safe, offer-level report for one partner entity."""
    if entity_type not in {"outlet", "brand"}:
        raise HTTPException(400, "Type must be outlet or brand")
    start, end = _admin_report_date_range(date_from, date_to)
    outlets, offers, coupons = await _load_brand_outlet_report_data(start, end)
    rows = _brand_outlet_report_rows(outlets, offers, coupons)
    entity = next(
        (
            row
            for row in rows
            if row["type"] == entity_type
            and (
                row["id"] == entity_id
                if entity_type == "outlet"
                else row["id"].casefold() == entity_id.casefold()
            )
        ),
        None,
    )
    if not entity:
        raise HTTPException(404, "Brand or outlet not found")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Offer type",
            "Brand or outlet",
            "Location",
            "Offer",
            "Discount",
            "Offers claimed",
            "Active",
            "Redeemed",
            "Expired",
            "Unique students",
            "Redemption rate (%)",
            "Date from",
            "Date to",
        ]
    )
    for offer in entity["offers"]:
        writer.writerow(
            [
                entity["type"].title(),
                _csv_cell(entity["name"]),
                _csv_cell(entity["address"] or entity["city"] or "Online"),
                _csv_cell(offer["title"]),
                _csv_cell(offer["discount"]),
                offer["claimed"],
                offer["active"],
                offer["redeemed"],
                offer["expired"],
                offer["unique_students"],
                offer["redemption_rate"],
                date_from or "All time",
                date_to or "All time",
            ]
        )
    slug = re.sub(r"[^a-z0-9]+", "-", entity["name"].casefold()).strip("-") or "report"
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{slug}-coupon-report.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )


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
    if effective_verification_status(user) != "approved":
        raise HTTPException(403, "You must be verified to access your student card")
    # Public pass verification is deliberately separate from the authenticated
    # restaurant scanner used for coupon redemption.
    pass_token = create_public_pass_token(user)
    payload = f"{FRONTEND_URL}/verify-pass?t={pass_token}"
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


@api.get("/public/student-pass")
async def public_student_pass(
    token: str = Query(..., min_length=10, max_length=200)
):
    """Return only the limited identity fields safe for a public QR check."""
    user_id = decode_public_pass_token(token)
    user = await db.users.find_one({"_id": user_id, "role": "student"})
    if not user or not user.get("student_number"):
        raise HTTPException(404, "Student pass not found")

    status = effective_verification_status(user)
    expiry = user.get("verification_expiry")
    return {
        "verified": status == "approved",
        "status": status,
        "name": user.get("name", ""),
        "college": user.get("college", ""),
        "course": user.get("course", ""),
        "year": user.get("year", ""),
        "student_number": user.get("student_number", ""),
        "expiry": expiry.isoformat() if expiry else None,
    }


# -----------------------------
# Offers
# -----------------------------
def get_offer_categories(offer: dict) -> list[str]:
    """Return every filterable category while supporting legacy offers."""
    categories = offer.get("categories")
    if not isinstance(categories, list):
        categories = []
    values = [
        category.strip()
        for category in categories
        if isinstance(category, str) and category.strip()
    ]
    primary = offer.get("category", "")
    if isinstance(primary, str) and primary.strip() and primary.strip() not in values:
        values.insert(0, primary.strip())
    return values


def offer_category_query(category: str) -> dict:
    """Match both new multi-category offers and legacy single-category offers."""
    return {
        "$or": [
            {"category": category},
            {"categories": category},
        ]
    }


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
        "categories": get_offer_categories(o),
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
        "offer_type": "partner_outlet" if outlet_id else "listed_brand",
        "disclaimer": "" if outlet_id else BRAND_OFFER_DISCLAIMER,
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
    filters = []
    if q:
        filters.append(
            {
                "$or": [
                    {"title": {"$regex": q, "$options": "i"}},
                    {"brand": {"$regex": q, "$options": "i"}},
                    {"description": {"$regex": q, "$options": "i"}},
                ]
            }
        )
    if category and category != "all":
        filters.append(offer_category_query(category))

    if len(filters) == 1:
        query = filters[0]
    elif filters:
        query = {"$and": filters}
    else:
        query = {}

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
    cats = set(await db.offers.distinct("category"))
    cats.update(await db.offers.distinct("categories"))
    counts = []
    for c in sorted(category for category in cats if isinstance(category, str) and category.strip()):
        n = await db.offers.count_documents(offer_category_query(c))
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
    result = serialize_offer(o, saved_ids)
    if o.get("outlet_id"):
        outlet = await db.outlets.find_one(
            {"_id": o["outlet_id"]}, {"hours": 1}
        )
        result["outlet_hours"] = outlet.get("hours", "") if outlet else ""
    return result


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
def serialize_brand_offer_claim(claim: dict, offer: dict) -> dict:
    return {
        "id": str(claim["_id"]),
        "kind": "listed_brand_offer",
        "status": "claimed",
        "offer_id": str(claim["offer_id"]),
        "offer_title": offer.get("title", ""),
        "brand": offer.get("brand", ""),
        "brand_logo": offer.get("brand_logo", ""),
        "discount": offer.get("discount", ""),
        "image_url": offer.get("image_url", ""),
        "official_url": offer.get("brand_url", ""),
        "terms": offer.get("terms", ""),
        "validity": offer.get("validity", ""),
        "disclaimer": BRAND_OFFER_DISCLAIMER,
        "claimed_at": (
            claim["claimed_at"].isoformat() if claim.get("claimed_at") else None
        ),
        "last_visited_at": (
            claim["last_visited_at"].isoformat()
            if claim.get("last_visited_at")
            else None
        ),
        "legacy": str(claim.get("source", "")).startswith("legacy_coupon"),
    }


def listed_brand_offer_email(offer: dict) -> str:
    brand = html.escape(offer.get("brand", "Brand"))
    title = html.escape(offer.get("title", "Student offer"))
    discount = html.escape(offer.get("discount", "Student offer"))
    terms = html.escape(offer.get("terms", "Check the official website for terms."))
    official_url = html.escape(offer.get("brand_url", ""), quote=True)
    disclaimer = html.escape(BRAND_OFFER_DISCLAIMER)
    return f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#0a0a0f;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your link to the {brand} student offer is ready.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#0a0a0f;">
      <tr><td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
          <tr><td style="padding:0 8px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:34px;height:34px;border-radius:10px;background-color:#7c3aed;text-align:center;font-size:18px;line-height:34px;">S</td>
              <td style="padding-left:10px;vertical-align:middle;"><div style="font-size:16px;line-height:20px;font-weight:700;color:#ffffff;">SavvyCampusDeals</div><div style="font-size:11px;line-height:16px;color:#a1a1aa;">Exclusive student deals</div></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:32px 28px 30px;border:1px solid #312e4b;border-radius:24px 24px 0 0;background-color:#171425;background-image:linear-gradient(135deg,#171425 0%,#1d1740 58%,#102d38 100%);">
            <div style="display:inline-block;padding:6px 10px;border:1px solid #514b75;border-radius:999px;background-color:#292343;color:#c4b5fd;font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;">Listed brand offer</div>
            <h1 style="margin:18px 0 10px;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-1px;color:#ffffff;">Your student offer link is ready</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#d4d4dc;">Continue to {brand}'s official website to check eligibility and activate the offer.</p>
          </td></tr>
          <tr><td style="padding:0 28px 30px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #4b4670;border-radius:20px;background-color:#11111a;">
              <tr><td style="padding:24px 22px 12px;"><div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#a78bfa;">{brand}</div><div style="padding-top:7px;font-size:20px;line-height:27px;font-weight:700;color:#ffffff;">{title}</div><div style="padding-top:10px;font-size:25px;line-height:31px;font-weight:800;color:#ffffff;">{discount}</div></td></tr>
              <tr><td align="center" style="padding:14px 22px 24px;"><a href="{official_url}" style="display:inline-block;padding:14px 24px;border-radius:999px;background-color:#ffffff;color:#111111;font-size:14px;line-height:18px;font-weight:700;text-decoration:none;">Continue to official website</a></td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 28px 26px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:18px;background-color:#0e2028;"><tr><td style="padding:20px 18px;"><div style="font-size:17px;line-height:23px;font-weight:700;color:#ffffff;">How to access the offer</div><div style="padding-top:10px;font-size:14px;line-height:22px;color:#d1e4e9;">Use the official link above, then follow the brand's own student-verification and activation process. SavvyCampusDeals does not issue a redemption code for this offer.</div></td></tr></table>
          </td></tr>
          <tr><td style="padding:0 28px 26px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
            <div style="font-size:12px;line-height:19px;color:#a1a1aa;"><strong style="color:#ffffff;">Offer terms:</strong> {terms}</div>
          </td></tr>
          <tr><td style="padding:0 28px 30px;border-left:1px solid #312e4b;border-right:1px solid #312e4b;background-color:#171425;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #514b75;border-radius:16px;background-color:#211d35;"><tr><td style="padding:17px 18px;"><div style="font-size:13px;line-height:19px;font-weight:700;color:#f5f3ff;">Important information</div><div style="padding-top:5px;font-size:12px;line-height:19px;color:#c9c4df;">{disclaimer}</div></td></tr></table>
          </td></tr>
          <tr><td style="padding:25px 28px 28px;border:1px solid #312e4b;border-top:0;border-radius:0 0 24px 24px;background-color:#12111d;text-align:center;"><div style="font-size:14px;line-height:20px;font-weight:700;color:#ffffff;">SavvyCampusDeals</div><div style="padding-top:5px;font-size:12px;line-height:18px;color:#a1a1aa;">Helping students discover better student offers.</div><div style="padding-top:13px;font-size:12px;line-height:18px;color:#777286;">Made with &#10084;&#65039; for students &middot; &copy; 2026 SavvyCampusDeals</div></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


async def claim_listed_brand_offer(offer: dict, user: dict, now: datetime) -> dict:
    official_url = offer.get("brand_url", "").strip()
    if not re.match(r"^https?://", official_url, re.IGNORECASE):
        raise HTTPException(409, "This brand offer does not have a valid official link")

    query = {"user_id": user["_id"], "offer_id": offer["_id"]}
    existing = await db.brand_offer_claims.find_one(query)
    if existing:
        await db.brand_offer_claims.update_one(
            {"_id": existing["_id"]},
            {"$set": {"last_visited_at": now}, "$inc": {"visit_count": 1}},
        )
        existing = {
            **existing,
            "last_visited_at": now,
            "visit_count": existing.get("visit_count", 1) + 1,
        }
        return serialize_brand_offer_claim(existing, offer)

    claim = {
        "user_id": user["_id"],
        "offer_id": offer["_id"],
        "status": "claimed",
        "claimed_at": now,
        "last_visited_at": now,
        "visit_count": 1,
        "source": "website",
    }
    try:
        result = await db.brand_offer_claims.insert_one(claim)
        claim["_id"] = result.inserted_id
    except DuplicateKeyError:
        await db.brand_offer_claims.update_one(
            query,
            {"$set": {"last_visited_at": now}, "$inc": {"visit_count": 1}},
        )
        claim = await db.brand_offer_claims.find_one(query)
        return serialize_brand_offer_claim(claim, offer)

    await db.offers.update_one(
        {"_id": offer["_id"]}, {"$inc": {"claims_count": 1}}
    )
    send_email(
        user["email"],
        f"Your link to the {offer['brand']} student offer",
        listed_brand_offer_email(offer),
    )
    return serialize_brand_offer_claim(claim, offer)


def serialize_coupon(c: dict, offer: dict = None) -> dict:
    status = c["status"]
    if (
        status == "active"
        and c.get("expires_at")
        and _aware(c["expires_at"]) <= datetime.now(timezone.utc)
    ):
        status = "expired"
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
        "status": status,
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
    outlet_oid = offer.get("outlet_id")

    # Listed online offers are discovery links, not Savy-issued coupons. Keep
    # this branch before every coupon/QR operation so outlet behavior remains
    # byte-for-byte compatible below.
    if not outlet_oid:
        return await claim_listed_brand_offer(offer, user, now)

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

    # Apply the policy configured on this specific outlet offer. The QR expiry
    # is calculated from the same policy below.
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
    expires = coupon_expiry_for_offer(offer, now)
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
                      <div style="font-size:16px;line-height:20px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;">SavvyCampusDeals</div>
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
                <div style="font-size:14px;line-height:20px;font-weight:700;color:#ffffff;">SavvyCampusDeals</div>
                <div style="padding-top:5px;font-size:12px;line-height:18px;color:#a1a1aa;">Helping students save more every day.</div>
                <div style="padding-top:13px;font-size:12px;line-height:18px;color:#777286;">Made with &#10084;&#65039; for students &middot; &copy; 2026 SavvyCampusDeals</div>
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
        await db.coupons.find(
            {
                "user_id": user["_id"],
                "outlet_id": {"$ne": None},
                "status": {"$ne": "archived"},
            }
        )
        .sort("created_at", -1)
        .to_list(200)
    )
    result = []
    for c in coupons:
        o = await db.offers.find_one({"_id": c["offer_id"]})
        result.append(serialize_coupon(c, o))
    return result


@api.get("/brand-offer-claims")
async def my_brand_offer_claims(user=Depends(get_current_user)):
    """Return new claims plus a non-mutating view of legacy brand coupons."""
    claims = (
        await db.brand_offer_claims.find({"user_id": user["_id"]})
        .sort("claimed_at", -1)
        .to_list(200)
    )
    legacy_coupons = (
        await db.coupons.find(
            {
                "user_id": user["_id"],
                "outlet_id": None,
                "status": {"$ne": "archived"},
            }
        )
        .sort("created_at", -1)
        .to_list(200)
    )
    offer_ids = {
        record.get("offer_id")
        for record in [*claims, *legacy_coupons]
        if record.get("offer_id")
    }
    offers = (
        await db.offers.find({"_id": {"$in": list(offer_ids)}}).to_list(400)
        if offer_ids
        else []
    )
    offer_by_id = {offer["_id"]: offer for offer in offers}
    result = []
    claimed_offer_ids = set()
    for claim in claims:
        offer = offer_by_id.get(claim.get("offer_id"))
        if not offer or offer.get("outlet_id"):
            continue
        claimed_offer_ids.add(claim["offer_id"])
        result.append(serialize_brand_offer_claim(claim, offer))
    for coupon in legacy_coupons:
        offer = offer_by_id.get(coupon.get("offer_id"))
        if (
            not offer
            or offer.get("outlet_id")
            or coupon.get("offer_id") in claimed_offer_ids
        ):
            continue
        claimed_offer_ids.add(coupon["offer_id"])
        legacy_claim = {
            "_id": f"legacy-{coupon['_id']}",
            "offer_id": coupon["offer_id"],
            "claimed_at": coupon.get("created_at"),
            "last_visited_at": None,
            "source": "legacy_coupon",
        }
        result.append(serialize_brand_offer_claim(legacy_claim, offer))
    return sorted(
        result,
        key=lambda claim: claim.get("claimed_at") or "",
        reverse=True,
    )


@api.get("/coupons/{coupon_id}")
async def get_coupon(coupon_id: str, user=Depends(get_current_user)):
    c = await db.coupons.find_one(
        {
            "_id": ObjectId(coupon_id),
            "user_id": user["_id"],
            "outlet_id": {"$ne": None},
            "status": {"$ne": "archived"},
        }
    )
    if not c:
        raise HTTPException(404, "Coupon not found")
    o = await db.offers.find_one({"_id": c["offer_id"]})
    return serialize_coupon(c, o)


# -----------------------------
# Dashboard stats
# -----------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    outlet_coupon_query = {
        "user_id": user["_id"],
        "outlet_id": {"$ne": None},
        "status": {"$ne": "archived"},
    }
    outlet_claimed = await db.coupons.count_documents(outlet_coupon_query)
    brand_offer_ids = set(
        await db.brand_offer_claims.distinct(
            "offer_id", {"user_id": user["_id"]}
        )
    )
    brand_offer_ids.update(
        await db.coupons.distinct(
            "offer_id",
            {
                "user_id": user["_id"],
                "outlet_id": None,
                "status": {"$ne": "archived"},
            },
        )
    )
    claimed = outlet_claimed + len(brand_offer_ids)
    redeemed = await db.coupons.count_documents(
        {**outlet_coupon_query, "status": "redeemed"}
    )
    active = await db.coupons.count_documents(
        {**outlet_coupon_query, "status": "active"}
    )
    saved = await db.saved_offers.count_documents({"user_id": user["_id"]})
    total_offers = await db.offers.count_documents({})
    return {
        "claimed": claimed,
        "brand_claimed": len(brand_offer_ids),
        "redeemed": redeemed,
        "active": active,
        "saved": saved,
        "savvy_points_balance": savvy_points_balance(user),
        "savvy_points_lifetime": savvy_points_lifetime(user),
        "reward_points": savvy_points_balance(user),
        "referral_code": user.get("referral_code", ""),
        "verification_status": user.get("verification_status", "unverified"),
        "total_offers": total_offers,
    }


@api.get("/savvy-points/overview")
async def savvy_points_overview(
    limit: int = Query(8, ge=1, le=25), user=Depends(get_current_user)
):
    await ensure_savvy_point_fields(user["_id"])
    if effective_verification_status(user) == "approved":
        # Also acts as a safe repair path if a verification response was interrupted.
        await complete_pending_referral(user["_id"])
    fresh = await db.users.find_one({"_id": user["_id"]})
    level_rewards = await ensure_level_rewards(user["_id"])
    transactions = await db.savvy_points_transactions.find(
        {"user_id": user["_id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    pending_referrals = await db.referrals.count_documents(
        {"referrer_id": user["_id"], "status": "pending"}
    )
    balance = savvy_points_balance(fresh)
    lifetime = savvy_points_lifetime(fresh)
    return {
        "balance": balance,
        "lifetime": lifetime,
        "tier": savvy_tier(lifetime),
        "pending_referrals": pending_referrals,
        "activity": [
            {
                "id": str(item["_id"]),
                "amount": item.get("amount", 0),
                "event_type": item.get("event_type", "bonus"),
                "title": item.get("title", "Savvy Points update"),
                "description": item.get("description", ""),
                "status": item.get("status", "earned"),
                "created_at": item.get("created_at").isoformat()
                if item.get("created_at")
                else None,
            }
            for item in transactions
        ],
        "ways_to_earn": [
            {
                "type": "redeem",
                "title": "Use a partner deal",
                "description": "Claim, visit the outlet and let staff approve your QR.",
                "points": SAVVY_REDEMPTION_POINTS,
                "cta": "Find an outlet",
                "href": "/outlets",
            },
            {
                "type": "verify",
                "title": "Verify student status",
                "description": "Complete your student verification for a one-time boost.",
                "points": 200,
                "cta": "Check status",
                "href": "/verify",
                "completed": effective_verification_status(fresh) == "approved",
            },
            {
                "type": "refer",
                "title": "Bring a friend",
                "description": "You both earn after your friend becomes a verified student.",
                "points": 100,
                "cta": "Copy your code",
                "referral_code": fresh.get("referral_code", ""),
            },
        ],
        "tiers": SAVVY_POINT_TIERS,
        "level_rewards": [serialize_level_reward(item) for item in level_rewards],
    }


# -----------------------------
# Outlets (local restaurants/cafes)
# -----------------------------
@api.get("/outlets")
async def list_outlets(
    city: Optional[str] = None,
    q: Optional[str] = None,
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    nearby_only: bool = False,
    radius_km: float = Query(5, gt=0, le=50),
):
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
        serialized = serialize_outlet(o, count)
        if lat is not None and lng is not None and o.get("lat") is not None and o.get("lng") is not None:
            distance = distance_km(lat, lng, float(o["lat"]), float(o["lng"]))
            serialized["distance_km"] = round(distance, 1)
            serialized["is_nearby"] = distance <= radius_km
        else:
            serialized["distance_km"] = None
            serialized["is_nearby"] = False
        if not nearby_only or serialized["is_nearby"]:
            result.append(serialized)
    if lat is not None and lng is not None:
        result.sort(
            key=lambda outlet: (
                outlet["distance_km"] is None,
                outlet["distance_km"] if outlet["distance_km"] is not None else float("inf"),
            )
        )
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
       - URL formats: https://.../scan?c=CODE, ?r=REWARD, ?s=STUDENT_NUM, ?p=RAW
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
            elif "f" in qs:
                return {"kind": "freshers_cafe", "code": qs["f"][0].strip().upper()}
            elif "r" in qs:
                return {"kind": "level_reward", "code": qs["r"][0].strip()}
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
    if raw.upper().startswith("SVR-"):
        return {"kind": "level_reward", "code": raw.upper()}
    if raw.upper().startswith("KFC-"):
        return {"kind": "freshers_cafe", "code": raw.upper()}
    if raw.upper().startswith("SCD-") and len(raw) >= 8:
        # Student numbers look like SCD-2026-XXXXXX ; coupon codes like SCD-XXXXXXXX
        segs = raw.split("-")
        if len(segs) == 3:
            return {"kind": "student", "student_number": raw}
        return {"kind": "coupon", "code": raw}
    return {"kind": "unknown"}


@api.post("/scan/lookup")
async def scan_lookup(body: ScanIn, scanner=Depends(get_scanner_user)):
    """Authenticated restaurant scanner lookup for student and coupon QRs."""
    parsed = _parse_qr_payload(body.payload)

    if parsed["kind"] == "freshers_cafe":
        participant = await db.freshers_participants.find_one({"cafe_code": parsed.get("code")})
        if not participant:
            raise HTTPException(404, "Freshers café coupon not found")
        if scanner.get("role") != "admin" and participant.get("cafe_outlet_id") != scanner.get("outlet_id"):
            raise HTTPException(403, "This Freshers coupon belongs to another café")
        user = await db.users.find_one({"_id": participant["user_id"]})
        campaign = await get_freshers_campaign()
        expired = bool(participant.get("expires_at") and _aware(participant["expires_at"]) <= datetime.now(timezone.utc))
        cafe_name = participant.get("cafe_name") or (
            "The Big Bite Co." if participant.get("cafe") == "big_bite"
            else "GOG Cafe & Bakers" if participant.get("cafe") == "gog"
            else "S Cafe"
        )
        offer = participant.get("cafe_offer") or (
            _freshers_offer(
                participant.get("cafe"),
                campaign,
                participant.get("reward_slot") or participant.get("position"),
            )
        )
        return {
            "kind": "freshers_cafe",
            "code": participant["cafe_code"],
            "status": "expired" if expired and participant.get("cafe_status") == "active" else participant.get("cafe_status", "active"),
            "expired": expired,
            "cafe_name": cafe_name,
            "brand": cafe_name,
            "cafe_address": participant.get("cafe_address", ""),
            "offer_title": "KIET Freshers exclusive",
            "discount": offer,
            "student_name": (user or {}).get("name", ""),
            "student_number": (user or {}).get("student_number", ""),
            "student_email": (user or {}).get("email", ""),
            "student_college": (user or {}).get("college", ""),
            "student_verified": bool(user and effective_verification_status(user) == "approved"),
            "student_expiry": _admin_datetime((user or {}).get("verification_expiry")),
            "student_expiry_expired": False,
            "expires_at": _admin_datetime(participant.get("expires_at")),
            "redeemed_at": _admin_datetime(participant.get("cafe_redeemed_at")),
        }

    if parsed["kind"] == "level_reward":
        reward = await db.savvy_level_rewards.find_one({"code": parsed.get("code")})
        if not reward:
            raise HTTPException(404, "Level reward not found")
        now = datetime.now(timezone.utc)
        expired = bool(
            reward.get("expires_at") and _aware(reward["expires_at"]) <= now
        )
        if expired and reward.get("status") == "active":
            await db.savvy_level_rewards.update_one(
                {"_id": reward["_id"], "status": "active"},
                {"$set": {"status": "expired"}},
            )
        student = await db.users.find_one({"_id": reward["user_id"]})
        return {
            "kind": "level_reward",
            "code": reward["code"],
            "status": "expired" if expired and reward.get("status") == "active" else reward.get("status", "active"),
            "expired": expired,
            "tier_name": reward.get("tier_name", ""),
            "reward_title": reward.get("reward_title", ""),
            "student_name": (student or {}).get("name", ""),
            "student_number": (student or {}).get("student_number", ""),
            "student_college": (student or {}).get("college", ""),
            "student_verified": bool(
                student and effective_verification_status(student) == "approved"
            ),
            "expires_at": reward.get("expires_at").isoformat()
            if reward.get("expires_at")
            else None,
            "redeemed_at": reward.get("redeemed_at").isoformat()
            if reward.get("redeemed_at")
            else None,
        }

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
        approved = effective_verification_status(user) == "approved"
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
        ensure_scanner_coupon_access(scanner, c)
        if c.get("status") == "archived":
            raise HTTPException(
                410,
                "This legacy brand coupon has been archived and cannot be redeemed",
            )
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
            "student_verified": bool(
                user and effective_verification_status(user) == "approved"
            ),
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
async def scan_redeem(body: ScanIn, scanner=Depends(get_scanner_user)):
    """Restaurant marks a coupon as redeemed."""
    parsed = _parse_qr_payload(body.payload)
    if parsed["kind"] == "freshers_cafe":
        participant = await db.freshers_participants.find_one({"cafe_code": parsed.get("code")})
        if not participant:
            raise HTTPException(404, "Freshers café coupon not found")
        if scanner.get("role") != "admin" and participant.get("cafe_outlet_id") != scanner.get("outlet_id"):
            raise HTTPException(403, "This Freshers coupon belongs to another café")
        now = datetime.now(timezone.utc)
        if participant.get("cafe_status") == "redeemed":
            campaign = await get_freshers_campaign()
            await db.freshers_scan_events.insert_one({"campaign_id": campaign["_id"], "participant_id": participant["_id"], "staff_id": scanner["_id"], "kind": "cafe", "result": "duplicate", "created_at": now})
            raise HTTPException(409, "Freshers café coupon already redeemed")
        if participant.get("expires_at") and _aware(participant["expires_at"]) <= now:
            raise HTTPException(410, "Freshers café coupon has expired")
        user = await db.users.find_one({"_id": participant["user_id"]})
        if not user or effective_verification_status(user) != "approved":
            raise HTTPException(403, "Student verification is not active")
        changed = await db.freshers_participants.update_one(
            {"_id": participant["_id"], "cafe_status": "active", "expires_at": {"$gt": now}},
            {"$set": {"cafe_status": "redeemed", "cafe_redeemed_at": now, "cafe_redeemed_by": scanner["_id"], "updated_at": now}},
        )
        if not changed.matched_count:
            raise HTTPException(409, "Freshers café coupon already redeemed")
        campaign = await get_freshers_campaign()
        await db.freshers_scan_events.insert_one({"campaign_id": campaign["_id"], "participant_id": participant["_id"], "staff_id": scanner["_id"], "kind": "cafe", "result": "redeemed", "created_at": now})
        return {"ok": True, "kind": "freshers_cafe", "code": participant["cafe_code"], "student_name": user.get("name", ""), "redeemed_at": now.isoformat(), "approved_by": scanner.get("name", "")}
    if parsed["kind"] == "level_reward":
        reward = await db.savvy_level_rewards.find_one({"code": parsed.get("code")})
        if not reward:
            raise HTTPException(404, "Level reward not found")
        if reward.get("status") == "redeemed":
            raise HTTPException(409, "Level reward already redeemed")
        now = datetime.now(timezone.utc)
        if reward.get("expires_at") and _aware(reward["expires_at"]) <= now:
            await db.savvy_level_rewards.update_one(
                {"_id": reward["_id"], "status": "active"},
                {"$set": {"status": "expired"}},
            )
            raise HTTPException(410, "Level reward has expired")
        student = await db.users.find_one({"_id": reward["user_id"]})
        if not student or effective_verification_status(student) != "approved":
            raise HTTPException(403, "Student not verified")
        redeemed = await db.savvy_level_rewards.update_one(
            {"_id": reward["_id"], "status": "active"},
            {
                "$set": {
                    "status": "redeemed",
                    "redeemed_at": now,
                    "redeemed_outlet_id": scanner.get("outlet_id"),
                    "redeemed_by_user_id": scanner["_id"],
                }
            },
        )
        if not redeemed.matched_count:
            raise HTTPException(409, "Level reward already redeemed")
        return {
            "ok": True,
            "kind": "level_reward",
            "code": reward["code"],
            "tier_name": reward.get("tier_name", ""),
            "reward_title": reward.get("reward_title", ""),
            "student_name": student.get("name", ""),
            "student_number": student.get("student_number", ""),
            "redeemed_at": now.isoformat(),
            "approved_by": scanner.get("name", ""),
            "outlet_id": str(scanner.get("outlet_id"))
            if scanner.get("outlet_id")
            else None,
        }
    if parsed["kind"] != "coupon":
        raise HTTPException(400, "Not a coupon QR")
    code = parsed.get("code")
    if not code:
        raise HTTPException(400, "Invalid coupon")
    c = await db.coupons.find_one({"code": code})
    if not c:
        raise HTTPException(404, "Coupon not found")
    ensure_scanner_coupon_access(scanner, c)
    if c.get("status") == "archived":
        raise HTTPException(
            410,
            "This legacy brand coupon has been archived and cannot be redeemed",
        )
    repairing_points_award = bool(
        c["status"] == "redeemed" and c.get("savvy_points_award_pending")
    )
    if c["status"] == "redeemed" and not repairing_points_award:
        raise HTTPException(409, "Coupon already redeemed")
    if (
        c.get("status") == "active"
        and c.get("expires_at")
        and _aware(c["expires_at"]) < datetime.now(timezone.utc)
    ):
        await db.coupons.update_one({"_id": c["_id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(410, "Coupon has expired")

    user = await db.users.find_one({"_id": c["user_id"]})
    if not user or effective_verification_status(user) != "approved":
        raise HTTPException(403, "Student not verified")

    now = datetime.now(timezone.utc)
    offer = await db.offers.find_one({"_id": c["offer_id"]})
    if repairing_points_award:
        await award_savvy_points(
            c["user_id"],
            SAVVY_REDEMPTION_POINTS,
            "redemption",
            str(c["_id"]),
            "Partner deal redeemed",
            f"You used your {(offer or {}).get('brand', 'partner')} deal.",
        )
        await db.coupons.update_one(
            {"_id": c["_id"]},
            {
                "$set": {"savvy_points_awarded": SAVVY_REDEMPTION_POINTS},
                "$unset": {"savvy_points_award_pending": ""},
            },
        )
        return {
            "ok": True,
            "code": c["code"],
            "redeemed_at": c.get("redeemed_at").isoformat()
            if c.get("redeemed_at")
            else now.isoformat(),
            "offer_title": (offer or {}).get("title", ""),
            "discount": (offer or {}).get("discount", ""),
            "brand": (offer or {}).get("brand", ""),
            "student_name": user.get("name", ""),
            "student_number": user.get("student_number", ""),
            "approved_by": scanner.get("name", ""),
            "outlet_id": str(c.get("outlet_id")) if c.get("outlet_id") else None,
            "savvy_points_awarded": SAVVY_REDEMPTION_POINTS,
        }
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
        {
            "$set": {
                "status": "redeemed",
                "redeemed_at": now,
                "approved_at": now,
                "redeemed_outlet_id": c.get("outlet_id"),
                "redeemed_by_user_id": scanner["_id"],
                "approved_by_user_id": scanner["_id"],
                "savvy_points_award_pending": True,
            }
        },
    )
    if not redeemed.matched_count:
        raise HTTPException(409, "Coupon already redeemed")
    await award_savvy_points(
        c["user_id"],
        SAVVY_REDEMPTION_POINTS,
        "redemption",
        str(c["_id"]),
        "Partner deal redeemed",
        f"You used your {(offer or {}).get('brand', 'partner')} deal.",
    )
    await db.coupons.update_one(
        {"_id": c["_id"]},
        {
            "$set": {"savvy_points_awarded": SAVVY_REDEMPTION_POINTS},
            "$unset": {"savvy_points_award_pending": ""},
        },
    )
    return {
        "ok": True,
        "code": c["code"],
        "redeemed_at": now.isoformat(),
        "offer_title": (offer or {}).get("title", ""),
        "discount": (offer or {}).get("discount", ""),
        "brand": (offer or {}).get("brand", ""),
        "student_name": user.get("name", ""),
        "student_number": user.get("student_number", ""),
        "approved_by": scanner.get("name", ""),
        "outlet_id": str(c.get("outlet_id")) if c.get("outlet_id") else None,
        "savvy_points_awarded": SAVVY_REDEMPTION_POINTS,
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
                "savvy_points_balance": 0,
                "savvy_points_lifetime": 0,
                "reward_points": 0,
                "referral_code": "ADMIN",
                "created_at": datetime.now(timezone.utc),
            }
        )
        logger.info("Seeded admin user")


async def migrate_savvy_points():
    """Carry legacy totals forward without rewriting or taking points away."""
    cursor = db.users.find(
        {
            "$or": [
                {"savvy_points_balance": {"$exists": False}},
                {"savvy_points_lifetime": {"$exists": False}},
            ]
        }
    )
    async for user in cursor:
        legacy_balance = int(user.get("reward_points", 0) or 0)
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "savvy_points_balance": legacy_balance,
                    "savvy_points_lifetime": legacy_balance,
                    "reward_points": legacy_balance,
                }
            },
        )
        if legacy_balance:
            try:
                await db.savvy_points_transactions.insert_one(
                    {
                        "user_id": user["_id"],
                        "amount": legacy_balance,
                        "event_type": "legacy_balance",
                        "source_id": str(user["_id"]),
                        "event_key": f"legacy_balance:{user['_id']}:{user['_id']}",
                        "title": "Savvy Points balance brought forward",
                        "description": "Your existing rewards are safe in the new Savvy Points experience.",
                        "status": "earned",
                        "created_at": datetime.now(timezone.utc),
                    }
                )
            except DuplicateKeyError:
                pass
    await db.referrals.update_many(
        {"status": {"$exists": False}, "points_awarded": {"$gt": 0}},
        {"$set": {"status": "awarded"}},
    )


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.saved_offers.create_index(
            [("user_id", 1), ("offer_id", 1)], unique=True
        )
        await db.coupons.create_index([("user_id", 1), ("offer_id", 1), ("status", 1)])
        await db.coupons.create_index(
            [("outlet_id", 1), ("status", 1), ("redeemed_at", -1)]
        )
        await db.brand_offer_claims.create_index(
            [("user_id", 1), ("offer_id", 1)], unique=True
        )
        await db.brand_offer_claims.create_index([("claimed_at", -1)])
        await db.users.create_index([("verification_status", 1), ("created_at", -1)])
        await db.users.create_index(
            [("verification_status", 1), ("verification_expiry", 1)]
        )
        await db.users.create_index(
            [("outlet_id", 1)],
            unique=True,
            partialFilterExpression={"role": "outlet_partner"},
        )
        await db.verifications.create_index([("status", 1), ("submitted_at", -1)])
        await db.referrals.create_index(
            [("referrer_id", 1), ("created_at", -1)]
        )
        await db.referrals.create_index([("referred_id", 1), ("status", 1)])
        await db.savvy_points_transactions.create_index("event_key", unique=True)
        await db.savvy_points_transactions.create_index(
            [("user_id", 1), ("created_at", -1)]
        )
        await db.savvy_level_rewards.create_index(
            [("user_id", 1), ("tier_key", 1)], unique=True
        )
        await db.savvy_level_rewards.create_index("code", unique=True)
        await db.savvy_level_rewards.create_index(
            [("status", 1), ("expires_at", 1)]
        )
        await db.announcements.create_index(
            [("published", 1), ("audience", 1), ("starts_at", 1), ("expires_at", 1)]
        )
        await db.announcement_receipts.create_index(
            [("user_id", 1), ("announcement_id", 1)], unique=True
        )
        await db.announcement_receipts.create_index(
            [("announcement_id", 1), ("seen_at", 1), ("clicked_at", 1)]
        )
        await db.email_campaigns.create_index([("status", 1), ("scheduled_at", 1)])
        await db.email_campaign_recipients.create_index(
            [("campaign_id", 1), ("user_id", 1)], unique=True
        )
        await db.email_campaign_recipients.create_index(
            [("campaign_id", 1), ("status", 1), ("created_at", 1)]
        )
        await db.freshers_campaigns.create_index("slug", unique=True)
        await db.freshers_participants.create_index(
            [("campaign_id", 1), ("user_id", 1)], unique=True
        )
        await db.freshers_participants.create_index(
            [("campaign_id", 1), ("position", 1)], unique=True
        )
        await db.freshers_participants.create_index(
            "goodies_code", unique=True, sparse=True
        )
        await db.freshers_participants.create_index(
            "cafe_code", unique=True, sparse=True
        )
        await db.freshers_email_jobs.create_index(
            [("participant_id", 1), ("kind", 1)], unique=True
        )
        await db.freshers_email_jobs.create_index(
            [("status", 1), ("deliver_at", 1)]
        )
        await db.freshers_scan_events.create_index(
            [("campaign_id", 1), ("created_at", -1)]
        )
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
        await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Index warn: {e}")
    await db.users.update_many(
        {
            "role": "student",
            "verification_status": "approved",
            "verification_expiry": {"$lt": datetime.now(timezone.utc)},
        },
        {
            "$set": {
                "verification_status": "expired",
                "verification_expired_at": datetime.now(timezone.utc),
            }
        },
    )
    await seed_admin()
    await migrate_savvy_points()
    await seed_offers()
    await seed_outlets()
    # 26 Aug 22:00 IST through the end of 27 Aug (28 Aug 00:00 IST).
    freshers_opens = datetime(2026, 8, 26, 16, 30, tzinfo=timezone.utc)
    freshers_closes = datetime(2026, 8, 27, 18, 30, tzinfo=timezone.utc)
    await db.freshers_campaigns.update_one(
        {"slug": FRESHERS_CAMPAIGN_SLUG},
        {
            "$setOnInsert": {
                "slug": FRESHERS_CAMPAIGN_SLUG,
                "name": "KIET Freshers 2026",
                "opens_at": freshers_opens,
                "closes_at": freshers_closes,
                "grace_ends_at": freshers_closes + timedelta(minutes=FRESHERS_GRACE_MINUTES),
                "verification_deadline": None,
                "manual_status": "scheduled",
                "allowed_domain": FRESHERS_DOMAIN,
                "next_position": 0,
                "gog_offer": "One free coffee. Limited campaign pool: 30 coffees total.",
                "gog_discount_offer": "15% off on a purchase of ₹350 at GOG Cafe & Bakers.",
                "s_cafe_offer": "Buy one pizza and get one free, across every pizza category and size.",
                "big_bite_offer": "Choose one Freshers offer: Buy 1 Pizza and Get 1 Pizza FREE; or selected Chilli Potato, Noodles, Fried Rice, and Rolls at ₹99 each. Dine-in only; one offer per bill; cannot be combined with another promotion.",
                "goodies_description": "Savvy stickers and pamphlet",
                "pickup_location": "Collect your goodies from the registration desk, or from Palak Gupta, Sahil Gupta, Aditya Dixit, or Satwik Srivastava, by showing your goodies QR code.",
                "rewards_enabled": False,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    await db.freshers_email_jobs.update_many(
        {"status": "sending"}, {"$set": {"status": "pending"}}
    )
    global _freshers_worker_task
    _freshers_worker_task = asyncio.create_task(_freshers_job_worker())
    # Resume durable campaign jobs after a process restart. Any recipient left in
    # the transient sending state is safe to claim again from its persisted row.
    try:
        resumable = await db.email_campaigns.find(
            {"status": {"$in": ["queued", "scheduled", "sending"]}}, {"_id": 1}
        ).to_list(200)
        for campaign in resumable:
            await db.email_campaign_recipients.update_many(
                {"campaign_id": campaign["_id"], "status": "sending"},
                {"$set": {"status": "pending"}},
            )
            _track_email_campaign_task(
                asyncio.create_task(_run_email_campaign(campaign["_id"]))
            )
    except Exception as e:
        logger.warning(f"Email campaign resume warn: {e}")
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
    if _freshers_worker_task:
        _freshers_worker_task.cancel()
        await asyncio.gather(_freshers_worker_task, return_exceptions=True)
    for task in list(_email_campaign_tasks):
        task.cancel()
    if _email_campaign_tasks:
        await asyncio.gather(*_email_campaign_tasks, return_exceptions=True)
    client.close()
