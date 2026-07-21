"""Iteration 4 backend tests: password validation + referral rewards + expanded scan/lookup coupon fields."""
import os
import secrets
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email(tag="user"):
    return f"TEST_iter4_{tag}_{secrets.token_hex(4)}@example.com"


@pytest.fixture(scope="module")
def session():
    return requests.Session()


# ---------- Password validation ----------
class TestPasswordValidation:
    def test_pw_too_short_returns_422(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "Short", "email": _rand_email("short"), "password": "abc",
        })
        # pydantic min_length=8 → 422
        assert r.status_code == 422, r.text

    def test_pw_missing_uppercase_returns_400(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "NoUpper", "email": _rand_email("noupper"), "password": "abcdefgh!",
        })
        assert r.status_code == 400, r.text
        assert "uppercase" in r.json().get("detail", "").lower()

    def test_pw_missing_special_returns_400(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "NoSpecial", "email": _rand_email("nospecial"), "password": "Abcdefgh",
        })
        assert r.status_code == 400, r.text
        assert "special" in r.json().get("detail", "").lower()

    def test_pw_valid_returns_200(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "Valid User", "email": _rand_email("valid"), "password": "Test@1234",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"].startswith("test_iter4_valid_")
        assert data["user"]["reward_points"] == 100  # welcome only
        assert data["user"]["referral_code"]


# ---------- Referral flow ----------
class TestReferralRewards:
    def test_referral_flow_end_to_end(self, session):
        # User A
        a_email = _rand_email("refA")
        rA = session.post(f"{API}/auth/register", json={
            "name": "Alice Referrer", "email": a_email, "password": "Test@1234",
        })
        assert rA.status_code == 200
        dataA = rA.json()
        ref_code = dataA["user"]["referral_code"]
        assert ref_code and len(ref_code) >= 5
        assert dataA["user"]["reward_points"] == 100

        # User B with A's referral code
        b_email = _rand_email("refB")
        rB = requests.post(f"{API}/auth/register", json={
            "name": "Bob Referred", "email": b_email, "password": "Test@1234",
            "referral_code": ref_code,
        })
        assert rB.status_code == 200, rB.text
        dataB = rB.json()
        # B gets 100 welcome + 200 referral
        assert dataB["user"]["reward_points"] == 300, dataB

        # Verify A's balance bumped by 200 via mongosh
        out = subprocess.run(
            ["mongosh", "--quiet", "--eval",
             f"db.getSiblingDB('savycampusdeals').users.findOne({{referral_code:'{ref_code}'}}).reward_points"],
            capture_output=True, text=True, timeout=15,
        )
        assert out.returncode == 0, out.stderr
        val = out.stdout.strip().splitlines()[-1].strip()
        assert val == "300", f"referrer points expected 300 got {val!r} (stdout={out.stdout!r})"

        # Verify db.referrals doc exists
        out2 = subprocess.run(
            ["mongosh", "--quiet", "--eval",
             f"JSON.stringify(db.getSiblingDB('savycampusdeals').referrals.findOne({{referred_email:'{b_email.lower()}'}}))"],
            capture_output=True, text=True, timeout=15,
        )
        assert out2.returncode == 0
        assert '"points_awarded":200' in out2.stdout.replace(" ", ""), out2.stdout

    def test_invalid_referral_code_returns_400(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "Bad Ref", "email": _rand_email("badref"),
            "password": "Test@1234", "referral_code": "BADCODE99",
        })
        assert r.status_code == 400, r.text
        assert "not valid" in r.json().get("detail", "").lower()


# ---------- /scan/lookup coupon expanded fields ----------
class TestScanLookupExpandedCoupon:
    def test_coupon_has_student_fields(self, session):
        # Create a student, verify email, submit verification (auto-approves), claim an offer
        email = _rand_email("scan")
        r = session.post(f"{API}/auth/register", json={
            "name": "Scan Student", "email": email, "password": "Test@1234",
            "college": "Test College", "course": "BSc CS", "year": "3rd",
        })
        assert r.status_code == 200
        token = r.json()["token"]
        dev_otp = r.json().get("dev_otp")
        if not dev_otp:
            # fetch via mongo
            out = subprocess.run(
                ["mongosh", "--quiet", "--eval",
                 f"db.getSiblingDB('savycampusdeals').otp_codes.findOne({{email:'{email}',used:false}},{{otp:1}}).otp"],
                capture_output=True, text=True, timeout=10,
            )
            dev_otp = out.stdout.strip().splitlines()[-1].strip()
        # Verify OTP
        vr = requests.post(f"{API}/auth/verify-otp", json={"email": email, "otp": dev_otp})
        assert vr.status_code == 200, vr.text

        headers = {"Authorization": f"Bearer {token}"}
        # Submit verification (auto approves)
        sub = requests.post(f"{API}/verification/submit", json={
            "college_name": "Test College", "course": "BSc CS", "year": "3rd",
            "student_id_number": "TSTID001",
        }, headers=headers)
        assert sub.status_code == 200, sub.text

        # Get an offer, claim it
        offers = requests.get(f"{API}/offers").json()
        assert offers
        offer_id = offers[0]["id"]
        cl = requests.post(f"{API}/offers/{offer_id}/claim", headers=headers)
        assert cl.status_code == 200, cl.text
        code = cl.json()["code"]

        # Authenticated scanner lookup (admin access is allowed for support/testing)
        admin_login = requests.post(f"{API}/auth/login", json={
            "email": "admin@savycampusdeals.in", "password": "Admin@123",
        })
        assert admin_login.status_code == 200, admin_login.text
        scanner_headers = {"Authorization": f"Bearer {admin_login.json()['token']}"}
        sc = requests.post(f"{API}/scan/lookup", json={"payload": code}, headers=scanner_headers)
        assert sc.status_code == 200, sc.text
        data = sc.json()
        assert data["kind"] == "coupon"
        # Required new expanded fields
        for k in ("student_college", "student_course", "student_year",
                  "student_avatar_url", "student_email", "student_expiry",
                  "student_expiry_expired", "student_verified", "student_name",
                  "student_number", "brand", "discount", "code", "status"):
            assert k in data, f"missing field {k}"
        assert data["student_college"] == "Test College"
        assert data["student_course"] == "BSc CS"
        assert data["student_year"] == "3rd"
        assert data["student_verified"] is True
        assert data["student_expiry_expired"] is False
        assert data["student_expiry"]  # ISO string
        assert data["code"] == code


# ---------- Regression: OTP fallback works ----------
class TestRegressionOTP:
    def test_register_returns_dev_otp_when_email_fails(self, session):
        r = session.post(f"{API}/auth/register", json={
            "name": "Reg OTP", "email": _rand_email("regotp"), "password": "Test@1234",
        })
        assert r.status_code == 200
        d = r.json()
        # email_sent may be True or False depending on Resend config; if false, dev_otp must be present
        if not d.get("email_sent"):
            assert "dev_otp" in d and len(d["dev_otp"]) == 6

    def test_offers_returns_14_brand_offers(self, session):
        r = session.get(f"{API}/offers")
        assert r.status_code == 200
        offers = r.json()
        brand_offers = [o for o in offers if not o.get("outlet_id")]
        assert len(brand_offers) == 14
        # brand_url present
        assert all("brand_url" in o for o in brand_offers)

    def test_admin_login(self, session):
        r = session.post(f"{API}/auth/login", json={
            "email": "admin@savycampusdeals.in", "password": "Admin@123",
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"
