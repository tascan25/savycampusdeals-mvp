"""Backend tests: outlets, scanner, outlet gate (Iteration 2)."""
import os
import secrets
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Outlets ----------
class TestOutlets:
    def test_list_outlets(self, s):
        r = s.get(f"{API}/outlets")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 6, f"expected 6 outlets got {len(data)}"
        cities = {o["city"] for o in data}
        assert cities == {"Mumbai", "Delhi", "Bangalore"}
        for o in data:
            assert "offer_count" in o
            assert o["offer_count"] >= 1
            assert "id" in o and "name" in o

    def test_cities(self, s):
        r = s.get(f"{API}/outlets/cities")
        assert r.status_code == 200
        assert r.json() == ["Bangalore", "Delhi", "Mumbai"]

    def test_filter_by_city(self, s):
        r = s.get(f"{API}/outlets", params={"city": "Mumbai"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        assert all(o["city"] == "Mumbai" for o in data)

    def test_outlet_detail(self, s):
        outlets = s.get(f"{API}/outlets").json()
        oid = outlets[0]["id"]
        r = s.get(f"{API}/outlets/{oid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == oid
        assert isinstance(d["offers"], list) and len(d["offers"]) >= 1
        assert "already_redeemed_here" in d
        assert d["already_redeemed_here"] is False  # anonymous


# ---------- Scan lookup / redeem ----------
def _register_verified_student(s):
    email = f"test_{secrets.token_hex(4)}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Test Student",
        "email": email,
        "password": "Test@1234",
    })
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    user_id = r.json()["user"]["id"]
    h = {"Authorization": f"Bearer {token}"}
    # verify
    r = s.post(f"{API}/verification/submit", headers=h, json={
        "college_id_image": "data:image/png;base64,AAA",
        "selfie_image": "data:image/png;base64,AAA",
        "college_name": "IIT Bombay",
        "course": "B.Tech CS",
        "year": "3",
        "student_id_number": "IITB123",
    })
    assert r.status_code == 200, r.text
    student_number = r.json()["user"]["student_number"]
    return {"email": email, "token": token, "user_id": user_id, "headers": h,
            "student_number": student_number}


class TestScan:
    def test_lookup_student_full_payload(self, s):
        u = _register_verified_student(s)
        payload = f"SCD|{u['student_number']}|{u['user_id']}|{u['email']}"
        r = s.post(f"{API}/scan/lookup", json={"payload": payload})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "student"
        assert d["verified"] is True
        assert d["student_number"] == u["student_number"]
        assert d["name"] == "Test Student"

    def test_lookup_student_raw_number(self, s):
        u = _register_verified_student(s)
        r = s.post(f"{API}/scan/lookup", json={"payload": u["student_number"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "student"
        assert d["verified"] is True
        assert d["student_number"] == u["student_number"]

    def test_lookup_coupon_raw_and_prefixed(self, s):
        u = _register_verified_student(s)
        # claim a non-outlet offer
        offers = s.get(f"{API}/offers").json()
        non_outlet = next(o for o in offers if not o.get("outlet_id"))
        r = s.post(f"{API}/offers/{non_outlet['id']}/claim", headers=u["headers"])
        assert r.status_code == 200
        code = r.json()["code"]

        # raw
        r = s.post(f"{API}/scan/lookup", json={"payload": code})
        assert r.status_code == 200
        d = r.json()
        assert d["kind"] == "coupon"
        assert d["code"] == code
        assert d["brand"] == non_outlet["brand"]
        assert d["student_name"] == "Test Student"

        # COUPON|... payload
        payload = f"COUPON|{code}|{u['user_id']}|{non_outlet['id']}"
        r = s.post(f"{API}/scan/lookup", json={"payload": payload})
        assert r.status_code == 200
        assert r.json()["code"] == code

    def test_redeem_then_conflict(self, s):
        u = _register_verified_student(s)
        offers = s.get(f"{API}/offers").json()
        non_outlet = next(o for o in offers if not o.get("outlet_id"))
        code = s.post(f"{API}/offers/{non_outlet['id']}/claim", headers=u["headers"]).json()["code"]

        r = s.post(f"{API}/scan/redeem", json={"payload": code})
        assert r.status_code == 200, r.text
        assert r.json()["code"] == code

        # verify status via lookup
        d = s.post(f"{API}/scan/lookup", json={"payload": code}).json()
        assert d["status"] == "redeemed"
        assert d["redeemed_at"] is not None

        r = s.post(f"{API}/scan/redeem", json={"payload": code})
        assert r.status_code == 409


# ---------- Outlet gate ----------
class TestOutletGate:
    def test_outlet_gate_blocks_same_outlet(self, s):
        u = _register_verified_student(s)
        # find a Mumbai outlet with >=2 offers (Roastery & Co. has 2)
        outlets = s.get(f"{API}/outlets").json()
        target = None
        for o in outlets:
            detail = s.get(f"{API}/outlets/{o['id']}").json()
            if len(detail["offers"]) >= 2:
                target = detail
                break
        assert target, "need an outlet with >=2 offers for gate test"
        offer_a, offer_b = target["offers"][0], target["offers"][1]

        # claim A
        r = s.post(f"{API}/offers/{offer_a['id']}/claim", headers=u["headers"])
        assert r.status_code == 200
        code_a = r.json()["code"]

        # redeem A via scan
        r = s.post(f"{API}/scan/redeem", json={"payload": code_a})
        assert r.status_code == 200

        # try to claim B -> should 409
        r = s.post(f"{API}/offers/{offer_b['id']}/claim", headers=u["headers"])
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"
        assert "new deal" in r.text.lower() or "already redeemed" in r.text.lower()

        # unrelated (non-outlet) offer should still be claimable
        offers = s.get(f"{API}/offers").json()
        other = next(o for o in offers if not o.get("outlet_id"))
        r = s.post(f"{API}/offers/{other['id']}/claim", headers=u["headers"])
        assert r.status_code == 200

        # outlet detail should reflect gate
        d = s.get(f"{API}/outlets/{target['id']}", headers=u["headers"]).json()
        assert d["already_redeemed_here"] is True

    def test_unrelated_outlet_offer_claimable(self, s):
        u = _register_verified_student(s)
        outlets = s.get(f"{API}/outlets").json()
        # claim from outlet #1
        o1 = s.get(f"{API}/outlets/{outlets[0]['id']}").json()
        code = s.post(f"{API}/offers/{o1['offers'][0]['id']}/claim", headers=u["headers"]).json()["code"]
        s.post(f"{API}/scan/redeem", json={"payload": code})
        # claim from a DIFFERENT outlet — allowed
        for other in outlets[1:]:
            det = s.get(f"{API}/outlets/{other['id']}").json()
            if det["offers"]:
                r = s.post(f"{API}/offers/{det['offers'][0]['id']}/claim", headers=u["headers"])
                assert r.status_code == 200, f"cross-outlet claim failed: {r.text}"
                return
        pytest.fail("no other outlet with offers")
