from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import base64
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

import bcrypt
import jwt
import qrcode
import resend
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# -----------------------------
# Setup
# -----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("savycampusdeals")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "onboarding@resend.dev")

resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
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
        "verification_status": u.get("verification_status", "unverified"),
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


DEV_OTP_FALLBACK = os.environ.get("DEV_OTP_FALLBACK", "true").lower() == "true"


def send_email(to: str, subject: str, html: str) -> dict:
    """Returns {ok: bool, error: str|None}."""
    if not RESEND_API_KEY:
        logger.warning(f"[Email skipped: no key] To={to}")
        return {"ok": False, "error": "no_api_key"}
    try:
        resend.Emails.send(
            {"from": f"SavyCampusDeals <{FROM_EMAIL}>", "to": [to], "subject": subject, "html": html}
        )
        return {"ok": True, "error": None}
    except Exception as e:
        logger.error(f"Resend error: {e}")
        return {"ok": False, "error": str(e)}


def generate_qr_data_uri(payload: str) -> str:
    qr = qrcode.QRCode(box_size=8, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


import re

PASSWORD_RE = re.compile(r"^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$")


def validate_password(pw: str) -> None:
    if len(pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", pw):
        raise HTTPException(400, "Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", pw):
        raise HTTPException(400, "Password must include at least one digit.")
    if not re.search(r"[^A-Za-z0-9\s]", pw):
        raise HTTPException(400, "Password must include at least one special character.")
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
    selfie_image: Optional[str] = ""      # base64 data URI (optional)
    college_name: str
    course: str
    year: str
    student_id_number: Optional[str] = ""


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
    referral_bonus = 200 if referrer else 0
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
        "verification_status": "unverified",
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
        await db.users.update_one({"_id": referrer["_id"]}, {"$inc": {"reward_points": 200}})
        await db.referrals.insert_one({
            "referrer_id": referrer["_id"],
            "referrer_email": referrer["email"],
            "referred_id": result.inserted_id,
            "referred_email": email,
            "points_awarded": 200,
            "created_at": now,
        })
        # Bonus notification email (best-effort)
        send_email(
            referrer["email"],
            "You just earned 200 SavyPoints",
            f"""<div style="font-family:Manrope,Arial,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
            <h1 style="font-family:Outfit,sans-serif;font-weight:800">+200 SavyPoints</h1>
            <p>{body.name.split(' ')[0]} just joined SavyCampusDeals using your code <b>{ref_code_raw}</b>. 200 points added to your account.</p>
            </div>""",
        )

    # Generate and send OTP (6-digit)
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.insert_one({
        "user_id": result.inserted_id,
        "email": email,
        "otp": otp,
        "expires_at": now + timedelta(minutes=10),
        "used": False,
        "created_at": now,
    })
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
    resp = {"user": serialize_user(user_doc), "token": token, "email_sent": email_result["ok"]}
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
    latest = await db.otp_codes.find_one({"user_id": user["_id"]}, sort=[("created_at", -1)])
    now = datetime.now(timezone.utc)
    if latest and (now - _aware(latest["created_at"])).total_seconds() < 60:
        raise HTTPException(429, "Please wait a minute before requesting a new code")
    otp = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.insert_one({
        "user_id": user["_id"],
        "email": email,
        "otp": otp,
        "expires_at": now + timedelta(minutes=10),
        "used": False,
        "created_at": now,
    })
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
            f'<p>Reset link (1 hour): <a href="{link}">{link}</a></p>',
        )
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset(body: ResetIn):
    validate_password(body.password)
    doc = await db.password_resets.find_one({"token": body.token, "used": False})
    if not doc or _aware(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired token")
    await db.users.update_one(
        {"_id": doc["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}}
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
async def submit_verification(body: VerificationSubmitIn, user=Depends(get_verified_user)):
    if user.get("verification_status") == "approved":
        raise HTTPException(400, "Already verified")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user["_id"],
        "college_id_image": body.college_id_image,
        "selfie_image": body.selfie_image,
        "college_name": body.college_name,
        "course": body.course,
        "year": body.year,
        "student_id_number": body.student_id_number,
        "status": "pending",
        "submitted_at": now,
        "reviewed_at": None,
        "reviewer_note": "",
    }
    await db.verifications.insert_one(doc)

    # Auto-approve for MVP demo (in real app: admin manual review)
    student_number = gen_student_number()
    expiry = now + timedelta(days=365)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "verification_status": "approved",
                "student_number": student_number,
                "verification_expiry": expiry,
                "college": body.college_name,
                "course": body.course,
                "year": body.year,
            },
            "$inc": {"reward_points": 200},
        },
    )
    await db.verifications.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "approved", "reviewed_at": now, "reviewer_note": "Auto-approved (demo)"}},
    )

    fresh = await db.users.find_one({"_id": user["_id"]})
    return {"ok": True, "user": serialize_user(fresh)}


@api.get("/verification/status")
async def verification_status(user=Depends(get_current_user)):
    latest = await db.verifications.find_one({"user_id": user["_id"]}, sort=[("submitted_at", -1)])
    return {
        "status": user.get("verification_status", "unverified"),
        "student_number": user.get("student_number", ""),
        "expiry": user.get("verification_expiry").isoformat() if user.get("verification_expiry") else None,
        "last_submission": latest.get("submitted_at").isoformat() if latest else None,
    }


# -----------------------------
# Digital Student Card
# -----------------------------
@api.get("/student-card")
async def student_card(user=Depends(get_current_user)):
    if user.get("verification_status") != "approved":
        raise HTTPException(403, "You must be verified to access your student card")
    payload = f"SCD|{user.get('student_number','')}|{str(user['_id'])}|{user.get('email','')}"
    qr = generate_qr_data_uri(payload)
    return {
        "name": user.get("name", ""),
        "college": user.get("college", ""),
        "course": user.get("course", ""),
        "year": user.get("year", ""),
        "student_number": user.get("student_number", ""),
        "email": user.get("email", ""),
        "avatar_url": user.get("avatar_url", ""),
        "expiry": user.get("verification_expiry").isoformat() if user.get("verification_expiry") else None,
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
        saved = await db.saved_offers.find_one({"user_id": user["_id"], "offer_id": o["_id"]})
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
        {"user_id": user["_id"], "offer_id": oid, "created_at": datetime.now(timezone.utc)}
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

    # prevent duplicate active coupon for same offer
    existing = await db.coupons.find_one({"user_id": user["_id"], "offer_id": oid, "status": "active"})
    if existing:
        return serialize_coupon(existing, offer)

    # OUTLET GATE: if offer belongs to an outlet, ensure user has NOT already redeemed
    # a newer-or-same-vintage deal at this outlet.
    outlet_oid = offer.get("outlet_id")
    if outlet_oid:
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
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30)
    payload = f"COUPON|{code}|{str(user['_id'])}|{offer_id}"
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
        f"<p>Your code: <b>{code}</b> for {offer['title']}. Show it at checkout.</p>",
    )
    return serialize_coupon(doc, offer)


@api.get("/coupons")
async def my_coupons(user=Depends(get_current_user)):
    coupons = await db.coupons.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
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
    active = await db.coupons.count_documents({"user_id": user["_id"], "status": "active"})
    saved = await db.saved_offers.count_documents({"user_id": user["_id"]})
    total_offers = await db.offers.count_documents({})
    return {
        "claimed": claimed,
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
    try:
        user = await get_current_user(request)
        saved = await db.saved_offers.find({"user_id": user["_id"]}).to_list(500)
        saved_ids = {str(s["offer_id"]) for s in saved}
        # gate info
        already_redeemed_outlet = bool(
            await db.coupons.find_one(
                {"user_id": user["_id"], "outlet_id": oid, "status": "redeemed"}
            )
        )
    except Exception:
        pass

    return {
        **serialize_outlet(outlet, len(offers)),
        "offers": [serialize_offer(o, saved_ids) for o in offers],
        "already_redeemed_here": already_redeemed_outlet,
    }


# -----------------------------
# Restaurant Scanner APIs
# -----------------------------
class ScanIn(BaseModel):
    payload: str


def _parse_qr_payload(raw: str) -> dict:
    """Parse QR string. Supports:
       SCD|student_number|user_id|email  (student card)
       COUPON|code|user_id|offer_id      (coupon)
       raw coupon code like SCD-XXXXXXXX
       raw student number like SCD-2026-XXXXXX
    """
    raw = (raw or "").strip()
    if not raw:
        return {"kind": "unknown"}
    parts = raw.split("|")
    if len(parts) >= 4 and parts[0] == "SCD":
        return {"kind": "student", "student_number": parts[1], "user_id": parts[2], "email": parts[3]}
    if len(parts) >= 4 and parts[0] == "COUPON":
        return {"kind": "coupon", "code": parts[1], "user_id": parts[2], "offer_id": parts[3]}
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
            "expired": bool(c.get("expires_at") and _aware(c["expires_at"]) < datetime.now(timezone.utc)),
            "offer_title": (offer or {}).get("title", ""),
            "brand": (offer or {}).get("brand", ""),
            "discount": (offer or {}).get("discount", ""),
            "outlet_id": str(offer.get("outlet_id")) if offer and offer.get("outlet_id") else None,
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
            "student_expiry_expired": bool(student_expiry and _aware(student_expiry) < datetime.now(timezone.utc)),
            "redeemed_at": c["redeemed_at"].isoformat() if c.get("redeemed_at") else None,
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
    await db.coupons.update_one(
        {"_id": c["_id"]}, {"$set": {"status": "redeemed", "redeemed_at": now}}
    )
    offer = await db.offers.find_one({"_id": c["offer_id"]})
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
        "featured": True, "trending": True, "location": "Digital", "claims_count": 5610,
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
        "featured": True, "trending": True, "location": "Digital", "claims_count": 4110,
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
        "featured": False, "trending": True, "location": "Digital", "claims_count": 2140,
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
        "featured": True, "trending": True, "location": "Online", "claims_count": 2780,
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
        "featured": True, "trending": False, "location": "Digital", "claims_count": 3220,
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
        "featured": True, "trending": True, "location": "Digital", "claims_count": 6410,
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
        "featured": True, "trending": True, "location": "Digital", "claims_count": 1980,
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
        "featured": False, "trending": True, "location": "Digital", "claims_count": 1130,
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
        "featured": False, "trending": True, "location": "Digital", "claims_count": 2410,
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
        "featured": False, "trending": True, "location": "Pan India", "claims_count": 3760,
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
        "featured": True, "trending": True, "location": "Pan India", "claims_count": 8210,
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
        "featured": True, "trending": True, "location": "Pan India", "claims_count": 6520,
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
        "featured": False, "trending": False, "location": "Digital", "claims_count": 1560,
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
        "featured": False, "trending": False, "location": "Digital", "claims_count": 2830,
    },
]


SEED_VERSION = "v2-real-deals-2026"


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
    docs = [{**o, "created_at": now, "outlet_id": None} for o in SEED_OFFERS]
    await db.offers.insert_many(docs)
    await db.seed_meta.update_one({"key": "offers"}, {"$set": {"version": SEED_VERSION, "updated_at": now}}, upsert=True)
    logger.info(f"Seeded {len(docs)} REAL brand offers ({SEED_VERSION})")


SEED_OUTLETS = [
    {
        "name": "Roastery & Co.",
        "tagline": "Third-wave coffee + fresh bakes",
        "cuisine": "Cafe • Bakery",
        "city": "Mumbai",
        "address": "Bandra Linking Road, Mumbai 400050",
        "lat": 19.0680, "lng": 72.8365,
        "image_url": "https://images.pexels.com/photos/34482998/pexels-photo-34482998.jpeg",
        "cover_url": "https://images.pexels.com/photos/34482998/pexels-photo-34482998.jpeg",
        "logo_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
        "phone": "+91 98200 12345",
        "hours": "8am – 11pm",
        "rating": 4.7,
        "offers": [
            {"title": "Buy 1 Get 1 on Cold Brews", "discount": "BOGO", "description": "Every cold brew comes with a friend, on us. Verified students only.", "terms": "In-store only. Cannot combine with other offers.", "validity": "Till 31 Dec", "featured": True, "trending": True},
            {"title": "30% OFF Weekend Brunch", "discount": "30% OFF", "description": "Sat & Sun mornings, hit our brunch spread for 30% less.", "terms": "Valid Sat/Sun 9-1pm only.", "validity": "Weekends"},
        ],
    },
    {
        "name": "Momo Mafia",
        "tagline": "Steamed. Fried. Iconic.",
        "cuisine": "Asian • Momos",
        "city": "Delhi",
        "address": "Hudson Lane, GTB Nagar, Delhi 110009",
        "lat": 28.7047, "lng": 77.2109,
        "image_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=200",
        "phone": "+91 98111 78901",
        "hours": "11am – 12am",
        "rating": 4.5,
        "offers": [
            {"title": "Flat ₹100 OFF on Orders ₹299+", "discount": "₹100 OFF", "description": "Because 10 momos > 8.", "terms": "Min order ₹299. Dine-in only.", "validity": "Till 15 Jan", "trending": True},
        ],
    },
    {
        "name": "The Book Barn",
        "tagline": "Boba tea + study cocoons",
        "cuisine": "Cafe • Boba",
        "city": "Bangalore",
        "address": "Church Street, Bangalore 560001",
        "lat": 12.9754, "lng": 77.6084,
        "image_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=200",
        "phone": "+91 80482 76543",
        "hours": "9am – 11pm",
        "rating": 4.8,
        "offers": [
            {"title": "Free Boba Upgrade + 20% OFF", "discount": "20% OFF", "description": "Level up any drink to boba, free. Plus 20% off the bill.", "terms": "In-store only.", "validity": "Ongoing", "featured": True},
        ],
    },
    {
        "name": "Burger Republic",
        "tagline": "Smash burgers, done right",
        "cuisine": "American • Burgers",
        "city": "Mumbai",
        "address": "Powai Central, Mumbai 400076",
        "lat": 19.1176, "lng": 72.9060,
        "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200",
        "phone": "+91 96000 44444",
        "hours": "12pm – 1am",
        "rating": 4.6,
        "offers": [
            {"title": "Free Fries + Coke on Any Burger", "discount": "FREE COMBO", "description": "Any burger, we throw in fries + a drink. On the house.", "terms": "One combo per student per visit.", "validity": "Weekdays only", "trending": True},
        ],
    },
    {
        "name": "South Side Idli",
        "tagline": "Filter coffee & fluffy idlis",
        "cuisine": "South Indian",
        "city": "Bangalore",
        "address": "Jayanagar 4th Block, Bangalore 560011",
        "lat": 12.9299, "lng": 77.5834,
        "image_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=200",
        "phone": "+91 80999 22221",
        "hours": "6am – 10pm",
        "rating": 4.9,
        "offers": [
            {"title": "Unlimited Thali at ₹149", "discount": "₹149 THALI", "description": "Unlimited South Indian thali for verified students.", "terms": "Dine-in only. Lunch (12-3pm).", "validity": "Till 28 Feb", "featured": True},
        ],
    },
    {
        "name": "Chai Point Studio",
        "tagline": "Cutting chai + maggi combos",
        "cuisine": "Cafe • Snacks",
        "city": "Delhi",
        "address": "Kamla Nagar, Delhi 110007",
        "lat": 28.6864, "lng": 77.2072,
        "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200",
        "cover_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1600",
        "logo_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200",
        "phone": "+91 97733 55511",
        "hours": "7am – 11pm",
        "rating": 4.4,
        "offers": [
            {"title": "₹99 Maggi + Chai Combo", "discount": "₹99 COMBO", "description": "The DU tradition: maggi + chai for ninety-nine.", "terms": "Dine-in only.", "validity": "Ongoing"},
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
            offer_docs.append({
                "title": o["title"],
                "brand": od["name"],
                "brand_logo": od.get("logo_url", ""),
                "category": "Food & Drink",
                "description": o["description"],
                "discount": o["discount"],
                "image_url": od.get("cover_url", od.get("image_url", "")),
                "terms": o.get("terms", ""),
                "validity": o.get("validity", "Ongoing"),
                "featured": o.get("featured", False),
                "trending": o.get("trending", False),
                "location": f"{od['name']} • {od['city']}",
                "claims_count": 0,
                "outlet_id": outlet_id,
                "created_at": now,
            })
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
        await db.saved_offers.create_index([("user_id", 1), ("offer_id", 1)], unique=True)
        await db.coupons.create_index([("user_id", 1), ("offer_id", 1), ("status", 1)])
        await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Index warn: {e}")
    await seed_admin()
    await seed_offers()
    await seed_outlets()


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
