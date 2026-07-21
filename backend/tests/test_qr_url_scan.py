"""Backend tests for coupon/student QR URL-format payload (iteration 5)."""
import base64
import io
import os
import re
import secrets
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://student-perks-9.preview.emergentagent.com").rstrip("/")
FRONTEND_URL = "https://student-perks-9.preview.emergentagent.com"

# Optional decoder (installed on demand)
try:
    from PIL import Image  # noqa
    from pyzbar.pyzbar import decode as zbar_decode
    HAS_ZBAR = True
except Exception:
    HAS_ZBAR = False
try:
    from PIL import Image  # noqa
    from pyzbar.pyzbar import decode as zbar_decode
    HAS_ZBAR = True
except Exception:
    pass

STATE = {}



def _decode_qr(data_uri: str) -> str:
    if not HAS_ZBAR:
        return ""
    assert data_uri.startswith("data:image/png;base64,")
    raw = base64.b64decode(data_uri.split(",", 1)[1])
    img = Image.open(io.BytesIO(raw))
    res = zbar_decode(img)
    if not res:
        return ""
    return res[0].data.decode("utf-8")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@savycampusdeals.in", "password": "Admin@123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def student():
    """Register+verify a fresh student, submit verification (auto-approve)."""
    api = requests.Session()
    api.headers.update({"Content-Type": "application/json"})
    suffix = secrets.token_hex(3)
    email = f"qrstud_{suffix}@example.com"
    pw = "Test@1234"
    r = api.post(f"{BASE_URL}/api/auth/register", json={
        "name": "QR Tester",
        "email": email,
        "password": pw,
        "college": "IIT Test",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    token_reg = body.get("token")
    otp = body.get("dev_otp")
    if not otp:
        # Email likely succeeded; fetch OTP directly from mongo (sync)
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        client = MongoClient(mongo_url)
        doc = client[db_name].otp_codes.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
        otp = doc["otp"] if doc else None
        client.close()
    assert otp, f"OTP not found for {email}"
    r2 = api.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": otp})
    assert r2.status_code == 200, r2.text
    r3 = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r3.status_code == 200
    token = r3.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    # submit verification (auto-approves)
    rv = api.post(f"{BASE_URL}/api/verification/submit", json={
        "college_name": "IIT Test",
        "course": "CS",
        "year": "2026",
        "id_card_url": "https://example.com/id.jpg",
    }, headers=headers)
    assert rv.status_code == 200, rv.text
    return {"email": email, "token": token, "headers": headers, "session": api}


# ------------------ TESTS ------------------

def test_student_card_qr_is_url(student):
    api = student["session"]
    r = api.get(f"{BASE_URL}/api/student-card", headers=student["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    student_number = body.get("student_number")
    assert student_number and student_number.startswith("SCD-"), body
    assert len(student_number.split("-")) == 3, f"expected 3-seg student number, got {student_number}"
    qr = body.get("qr_data_uri", "")
    assert qr.startswith("data:image/png;base64,")
    if HAS_ZBAR:
        decoded = _decode_qr(qr)
        assert decoded == f"{FRONTEND_URL}/scan?s={student_number}", decoded


def test_claim_coupon_qr_is_url(api, admin_token, student):
    sapi = student["session"]
    # Find an outlet offer
    r = api.get(f"{BASE_URL}/api/offers")
    assert r.status_code == 200
    offers = r.json()
    outlet_offer = next((o for o in offers if o.get("outlet_id")), None)
    assert outlet_offer, "No outlet offer available for claim test"
    # claim
    r2 = sapi.post(f"{BASE_URL}/api/offers/{outlet_offer['id']}/claim", headers=student["headers"])
    assert r2.status_code == 200, r2.text
    coupon = r2.json()
    code = coupon["code"]
    assert code.startswith("SCD-")
    qr = coupon.get("qr_data_uri", "")
    assert qr.startswith("data:image/png;base64,")
    if HAS_ZBAR:
        decoded = _decode_qr(qr)
        assert decoded == f"{FRONTEND_URL}/scan?c={code}", decoded
    # stash for the next test
    STATE["code"] = code
    STATE["code"] = code
    sc = sapi.get(f"{BASE_URL}/api/student-card", headers=student["headers"]).json()
    STATE["sn"] = sc["student_number"]
    STATE["sn"] = sc["student_number"]


def test_scan_lookup_url_coupon(api, admin_token):
    code = STATE["code"]
    assert code, "prior test did not produce a code"
    url_payload = f"{FRONTEND_URL}/scan?c={code}"
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": url_payload}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kind"] == "coupon"
    assert d["code"] == code
    # must include student_* fields
    for f in ("student_name", "student_verified", "student_number", "student_college"):
        assert f in d, f"missing {f} in coupon response: {d}"
    assert d["student_verified"] is True


def test_scan_lookup_url_student(api, admin_token):
    sn = STATE["sn"]
    assert sn
    print(f"DEBUG sn={sn!r}", flush=True)
    url_payload = f"{FRONTEND_URL}/scan?s={sn}"
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": url_payload}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kind"] == "student"
    assert d["student_number"] == sn
    assert d["verified"] is True


def test_backward_compat_raw_coupon_code(api, admin_token):
    code = STATE["code"]
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": code}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["kind"] == "coupon"


def test_backward_compat_raw_student_number(api, admin_token):
    sn = STATE["sn"]
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": sn}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["kind"] == "student"


def test_backward_compat_pipe_coupon(api, admin_token):
    # Use the actual coupon; user_id/offer_id can be dummy — parser only inspects delimiter/kind
    code = STATE["code"]
    payload = f"COUPON|{code}|000000000000000000000000|000000000000000000000000"
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": payload}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    d = r.json()
    assert d["kind"] == "coupon"
    assert d["code"] == code


def test_backward_compat_pipe_student(api, admin_token):
    sn = STATE["sn"]
    payload = f"SCD|{sn}|000000000000000000000000|x@y.z"
    r = api.post(f"{BASE_URL}/api/scan/lookup", json={"payload": payload}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    # For pipe-student, parser sets kind=student. The endpoint may still resolve.
    assert r.json()["kind"] == "student"


def test_startup_migration_log():
    """Check the backend log for the migration line."""
    found = False
    for path in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
        try:
            with open(path) as f:
                if "Migrated" in f.read():
                    found = True
                    break
        except FileNotFoundError:
            pass
    assert found, "Startup migration log line 'Migrated N active coupon QRs' not found"


def test_active_coupons_all_have_url_qr(student):
    api = student["session"]
    r = api.get(f"{BASE_URL}/api/coupons", headers=student["headers"])
    assert r.status_code == 200
    coupons = r.json()
    assert len(coupons) >= 1
    if HAS_ZBAR:
        for c in coupons:
            if c.get("status") != "active":
                continue
            decoded = _decode_qr(c["qr_data_uri"])
            assert decoded.startswith(f"{FRONTEND_URL}/scan?c="), decoded
