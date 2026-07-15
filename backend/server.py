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


def send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning(f"[Email skipped: no key] To={to} Subject={subject}")
        return False
    try:
        resend.Emails.send(
            {"from": f"SavyCampusDeals <{FROM_EMAIL}>", "to": [to], "subject": subject, "html": html}
        )
        return True
    except Exception as e:
        logger.error(f"Resend error: {e}")
        return False


def generate_qr_data_uri(payload: str) -> str:
    qr = qrcode.QRCode(box_size=8, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


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
    password: str = Field(min_length=6)
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
    password: str = Field(min_length=6)


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    course: Optional[str] = None
    year: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class VerificationSubmitIn(BaseModel):
    college_id_image: str  # base64 data URI
    selfie_image: str
    college_name: str
    course: str
    year: str
    student_id_number: str


# -----------------------------
# Auth Routes
# -----------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")

    now = datetime.now(timezone.utc)
    verify_token = secrets.token_urlsafe(24)
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
        "verification_status": "unverified",  # unverified | pending | approved | rejected
        "student_number": "",
        "verification_expiry": None,
        "reward_points": 100,  # welcome bonus
        "referral_code": gen_ref_code(body.name),
        "referred_by": body.referral_code or "",
        "created_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # send verification email (non-blocking failure)
    link = f"{FRONTEND_URL}/verify-email/{verify_token}"
    send_email(
        email,
        "Welcome to SavyCampusDeals — Verify your email",
        f"""<div style="font-family:Manrope,sans-serif;background:#050505;color:#fff;padding:32px;border-radius:16px;max-width:560px;margin:auto">
        <h1 style="font-family:Outfit,sans-serif">Welcome, {body.name}!</h1>
        <p>Thanks for joining SavyCampusDeals — your student perks club.</p>
        <p>Confirm your email to unlock exclusive offers:</p>
        <p style="margin:24px 0"><a href="{link}" style="background:#4F46E5;padding:14px 28px;border-radius:999px;color:#fff;text-decoration:none;font-weight:700">Verify Email</a></p>
        <p style="color:#71717A;font-size:12px">If the button doesn't work, paste this in your browser: {link}</p>
        </div>""",
    )

    token = create_access_token(str(result.inserted_id), email, "student")
    set_auth_cookie(response, token)
    return {"user": serialize_user(user_doc), "token": token}


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
    doc = await db.password_resets.find_one({"token": body.token, "used": False})
    if not doc or doc["expires_at"] < datetime.now(timezone.utc):
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
async def submit_verification(body: VerificationSubmitIn, user=Depends(get_current_user)):
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
    return {
        "id": str(o["_id"]),
        "title": o["title"],
        "brand": o["brand"],
        "brand_logo": o.get("brand_logo", ""),
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
async def claim_offer(offer_id: str, user=Depends(get_current_user)):
    if user.get("verification_status") != "approved":
        raise HTTPException(403, "Get verified to claim offers")
    try:
        oid = ObjectId(offer_id)
    except Exception:
        raise HTTPException(404, "Offer not found")
    offer = await db.offers.find_one({"_id": oid})
    if not offer:
        raise HTTPException(404, "Offer not found")

    # prevent duplicate active coupon
    existing = await db.coupons.find_one({"user_id": user["_id"], "offer_id": oid, "status": "active"})
    if existing:
        return serialize_coupon(existing, offer)

    code = f"SCD-{secrets.token_hex(4).upper()}"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30)
    payload = f"COUPON|{code}|{str(user['_id'])}|{offer_id}"
    qr = generate_qr_data_uri(payload)
    doc = {
        "user_id": user["_id"],
        "offer_id": oid,
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
# Seed data
# -----------------------------
SEED_OFFERS = [
    {
        "title": "40% OFF on all Handcrafted Coffees",
        "brand": "Blue Tokai",
        "brand_logo": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
        "category": "Food & Drink",
        "description": "Sip your way through exam week with 40% off every brew at Blue Tokai's flagship campus outlets.",
        "discount": "40% OFF",
        "image_url": "https://images.pexels.com/photos/34482998/pexels-photo-34482998.jpeg",
        "terms": "Valid on all handcrafted beverages. Not valid with other offers. Show digital coupon at counter.",
        "validity": "Valid till 31 Dec",
        "featured": True,
        "trending": True,
        "location": "Pan India",
        "claims_count": 1240,
    },
    {
        "title": "Flat ₹500 OFF Kicks + Free Shipping",
        "brand": "Nike",
        "brand_logo": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
        "category": "Fashion",
        "description": "Fresh drops. Fresh discounts. Flat ₹500 off + free shipping on your first Nike purchase.",
        "discount": "₹500 OFF",
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200",
        "terms": "Min order ₹2999. One-time use per student.",
        "validity": "Valid till 30 Nov",
        "featured": True,
        "trending": True,
        "location": "Online + Stores",
        "claims_count": 2340,
    },
    {
        "title": "3 Months Premium — Free",
        "brand": "Spotify",
        "brand_logo": "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=200",
        "category": "Entertainment",
        "description": "Score three months of Spotify Premium on us. Ad-free tunes for every all-nighter.",
        "discount": "3 MONTHS FREE",
        "image_url": "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=1200",
        "terms": "New users only. Auto-renews at ₹59/mo unless cancelled.",
        "validity": "Ongoing",
        "featured": True,
        "trending": False,
        "location": "Digital",
        "claims_count": 5610,
    },
    {
        "title": "50% OFF Annual Cult Elite",
        "brand": "cult.fit",
        "brand_logo": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=200",
        "category": "Fitness",
        "description": "Half-off annual gym + group workouts across 500+ centres. The glow up starts here.",
        "discount": "50% OFF",
        "image_url": "https://images.pexels.com/photos/3888405/pexels-photo-3888405.jpeg",
        "terms": "Applicable on Elite annual plan only. Non-transferable.",
        "validity": "Valid till 15 Dec",
        "featured": False,
        "trending": True,
        "location": "Metro cities",
        "claims_count": 890,
    },
    {
        "title": "60% OFF Everything at Zudio",
        "brand": "Zudio",
        "brand_logo": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=200",
        "category": "Fashion",
        "description": "Refresh your fit for less. Flat 60% off on your first Zudio haul.",
        "discount": "60% OFF",
        "image_url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200",
        "terms": "In-store only. Valid at all Zudio outlets.",
        "validity": "Valid till 20 Dec",
        "featured": False,
        "trending": True,
        "location": "In-store",
        "claims_count": 1450,
    },
    {
        "title": "Free Notion Plus for Students",
        "brand": "Notion",
        "brand_logo": "https://images.unsplash.com/photo-1611175694989-4870fafa4494?w=200",
        "category": "Education",
        "description": "Level up productivity with Notion Plus free for verified students. AI-powered notes included.",
        "discount": "100% FREE",
        "image_url": "https://images.unsplash.com/photo-1611175694989-4870fafa4494?w=1200",
        "terms": "Valid while enrolled. Requires student email.",
        "validity": "Yearly renewal",
        "featured": True,
        "trending": False,
        "location": "Digital",
        "claims_count": 3220,
    },
    {
        "title": "25% OFF MacBook Air M3",
        "brand": "Apple",
        "brand_logo": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200",
        "category": "Tech",
        "description": "Education pricing on the new MacBook Air M3. Because your work deserves silicon.",
        "discount": "25% OFF",
        "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200",
        "terms": "Valid via Apple Education store. One device per student per year.",
        "validity": "Ongoing",
        "featured": True,
        "trending": True,
        "location": "Online",
        "claims_count": 2780,
    },
    {
        "title": "Buy 1 Get 1 Free on Movies",
        "brand": "BookMyShow",
        "brand_logo": "https://images.unsplash.com/photo-1489599809927-48b3b1c6f61f?w=200",
        "category": "Entertainment",
        "description": "Weekend vibes: BOGO tickets across PVR, INOX and Cinepolis via BookMyShow.",
        "discount": "BUY 1 GET 1",
        "image_url": "https://images.unsplash.com/photo-1489599809927-48b3b1c6f61f?w=1200",
        "terms": "Applicable Mon–Thu shows. Max 2 tickets per booking.",
        "validity": "Valid till 31 Jan",
        "featured": False,
        "trending": False,
        "location": "Pan India",
        "claims_count": 640,
    },
    {
        "title": "70% OFF Coding Bootcamps",
        "brand": "Coursera",
        "brand_logo": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=200",
        "category": "Education",
        "description": "Ship your first startup. Take any Coursera Plus specialization at 70% off.",
        "discount": "70% OFF",
        "image_url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200",
        "terms": "Applicable on annual Coursera Plus only.",
        "validity": "Ongoing",
        "featured": False,
        "trending": True,
        "location": "Digital",
        "claims_count": 1980,
    },
    {
        "title": "Free 1-Year YouTube Premium",
        "brand": "YouTube",
        "brand_logo": "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200",
        "category": "Entertainment",
        "description": "One full year of ad-free YouTube + Music Premium. Study soundtracks on repeat.",
        "discount": "1 YEAR FREE",
        "image_url": "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200",
        "terms": "New Premium members only.",
        "validity": "Limited-time",
        "featured": False,
        "trending": False,
        "location": "Digital",
        "claims_count": 4110,
    },
    {
        "title": "30% OFF Zomato Gold",
        "brand": "Zomato",
        "brand_logo": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200",
        "category": "Food & Drink",
        "description": "Unlock BOGO meals and free deliveries with Zomato Gold at 30% off for students.",
        "discount": "30% OFF",
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200",
        "terms": "Applicable on annual Gold membership.",
        "validity": "Valid till 28 Feb",
        "featured": False,
        "trending": True,
        "location": "Pan India",
        "claims_count": 2650,
    },
    {
        "title": "Flat 45% OFF Ray-Ban Aviators",
        "brand": "Ray-Ban",
        "brand_logo": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=200",
        "category": "Fashion",
        "description": "Icons never go out of style. Flat 45% off aviator classics for verified students.",
        "discount": "45% OFF",
        "image_url": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200",
        "terms": "Online only.",
        "validity": "Valid till 31 Dec",
        "featured": False,
        "trending": False,
        "location": "Online",
        "claims_count": 520,
    },
]


async def seed_offers():
    if await db.offers.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc)
    docs = [{**o, "created_at": now} for o in SEED_OFFERS]
    await db.offers.insert_many(docs)
    logger.info(f"Seeded {len(docs)} offers")


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
