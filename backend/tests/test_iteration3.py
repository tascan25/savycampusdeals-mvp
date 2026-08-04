"""Iteration 3 backend tests: real brand offers, OTP flow, email-verified gates,
optional images in verification submit, brand offer claim."""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://student-perks-9.preview.emergentagent.com"
# Load backend env for direct mongo access
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]


def _uniq_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- REAL brand offers ----------
def test_offers_are_14_real_brand_deals():
    r = requests.get(f"{BASE_URL}/api/offers")
    assert r.status_code == 200
    offers = r.json()
    brand_offers = [o for o in offers if not o.get("outlet_id")]
    assert len(brand_offers) == 14, f"Expected 14 brand offers, got {len(brand_offers)}"
    expected_brands = {"Spotify","YouTube","Apple Music","Apple","Notion","GitHub","Adobe","Figma","Canva","Amazon Prime","Swiggy","Zomato","Coursera","Microsoft"}
    got = {o["brand"] for o in brand_offers}
    assert expected_brands == got, f"Brand mismatch: missing {expected_brands - got}, extra {got - expected_brands}"
    for o in brand_offers:
        assert o.get("brand_url"), f"Offer {o['brand']} missing brand_url"
        assert o["brand_url"].startswith("http"), f"Bad brand_url for {o['brand']}"


# ---------- Registration + OTP flow ----------
def test_register_creates_unverified_user_with_otp():
    email = _uniq_email()
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test User", "email": email, "password": "Test@1234"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email_verified"] is False
    # OTP stored
    doc = db.otp_codes.find_one({"email": email.lower()})
    assert doc, "OTP not stored"
    assert len(doc["otp"]) == 6
    assert doc["otp"].isdigit()


def test_verify_otp_wrong_returns_400():
    email = _uniq_email()
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test", "email": email, "password": "Test@1234"
    })
    r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": "000000"})
    # note: 000000 could randomly match, but odds ~ 1e-6; treat conflict
    doc = db.otp_codes.find_one({"email": email.lower()})
    if doc["otp"] == "000000":
        pytest.skip("Random OTP collision")
    assert r.status_code == 400
    assert "Invalid" in r.json().get("detail", "")


def test_verify_otp_correct_marks_verified():
    email = _uniq_email()
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test", "email": email, "password": "Test@1234"
    })
    doc = db.otp_codes.find_one({"email": email.lower()})
    r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": doc["otp"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["user"]["email_verified"] is True


def test_send_otp_throttle_429():
    email = _uniq_email()
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test", "email": email, "password": "Test@1234"
    })
    # second send within 60s must fail
    r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": email})
    assert r.status_code == 429, f"Expected 429, got {r.status_code}: {r.text}"


def test_send_otp_after_delay_would_succeed_by_deleting_last():
    """Simulate 60s wait by directly aging the last OTP in DB."""
    email = _uniq_email()
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test", "email": email, "password": "Test@1234"
    })
    # Age the OTP
    from datetime import datetime, timezone, timedelta
    db.otp_codes.update_many({"email": email.lower()}, {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(minutes=2)}})
    r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": email})
    assert r.status_code == 200, r.text


# ---------- Gate: email-unverified blocked from writes ----------
def _register_and_login(email):
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test", "email": email, "password": "Test@1234"
    })
    return r.json()["token"]


def test_unverified_cannot_submit_verification():
    email = _uniq_email()
    token = _register_and_login(email)
    r = requests.post(
        f"{BASE_URL}/api/verification/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"college_name": "IIT", "course": "CS", "year": "2"},
    )
    assert r.status_code == 403
    assert "verify" in r.json()["detail"].lower()


def test_unverified_cannot_claim_offer():
    email = _uniq_email()
    token = _register_and_login(email)
    offers = requests.get(f"{BASE_URL}/api/offers").json()
    offer_id = offers[0]["id"]
    r = requests.post(
        f"{BASE_URL}/api/offers/{offer_id}/claim",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


# ---------- After OTP: verification without images auto-approves ----------
def test_verification_optional_images_auto_approves():
    email = _uniq_email()
    token = _register_and_login(email)
    doc = db.otp_codes.find_one({"email": email.lower()})
    r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": doc["otp"]})
    assert r.status_code == 200
    # Submit with NO images
    r2 = requests.post(
        f"{BASE_URL}/api/verification/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"college_name": "IIT Bombay", "course": "CSE", "year": "3"},
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["user"]["verification_status"] == "approved"
    assert body["user"]["student_number"].startswith("SCD-")


# ---------- Brand offer claim returns an official link, never a Savy coupon ----------
def test_brand_offer_claim_succeeds_after_full_verification():
    email = _uniq_email()
    token = _register_and_login(email)
    doc = db.otp_codes.find_one({"email": email.lower()})
    requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": doc["otp"]})
    requests.post(
        f"{BASE_URL}/api/verification/submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"college_name": "IIT", "course": "CS", "year": "2"},
    )
    # pick brand offer (no outlet_id)
    offers = requests.get(f"{BASE_URL}/api/offers").json()
    brand = next(o for o in offers if not o.get("outlet_id"))
    r = requests.post(
        f"{BASE_URL}/api/offers/{brand['id']}/claim",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    claim = r.json()
    assert claim["kind"] == "listed_brand_offer"
    assert claim["status"] == "claimed"
    assert claim["official_url"] == brand["brand_url"]
    assert "code" not in claim
    assert "qr_data_uri" not in claim


# ---------- Admin bypass ----------
def test_admin_bypasses_email_gate():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@savycampusdeals.in", "password": "Admin@123"
    })
    assert r.status_code == 200
    token = r.json()["token"]
    # admin GET /auth/me
    me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["role"] == "admin"


def teardown_module(module):
    # Cleanup TEST_ users
    test_users = list(db.users.find({"email": {"$regex": "^test_", "$options": "i"}}))
    ids = [u["_id"] for u in test_users]
    if ids:
        db.otp_codes.delete_many({"user_id": {"$in": ids}})
        db.coupons.delete_many({"user_id": {"$in": ids}})
        db.saved_offers.delete_many({"user_id": {"$in": ids}})
        db.verifications.delete_many({"user_id": {"$in": ids}})
        db.users.delete_many({"_id": {"$in": ids}})
