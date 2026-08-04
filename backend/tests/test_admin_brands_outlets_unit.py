"""Focused coverage for the read-only Brands & Outlets reporting feature."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson import ObjectId

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret"

import server  # noqa: E402


def report_records():
    now = datetime(2026, 8, 1, tzinfo=timezone.utc)
    outlet_id = ObjectId()
    outlet_offer_id = ObjectId()
    brand_offer_id = ObjectId()
    second_brand_offer_id = ObjectId()
    student_one = ObjectId()
    student_two = ObjectId()
    outlets = [{
        "_id": outlet_id,
        "name": "Campus Cafe",
        "logo_url": "/logo.webp",
        "address": "North Campus, Delhi",
        "city": "Delhi",
    }]
    offers = [
        {"_id": outlet_offer_id, "outlet_id": outlet_id, "title": "Lunch combo", "brand": "Campus Cafe", "discount": "20% OFF"},
        {"_id": brand_offer_id, "outlet_id": None, "title": "Student plan", "brand": "Adobe", "discount": "50% OFF", "brand_logo": "/adobe.webp"},
        {"_id": second_brand_offer_id, "outlet_id": None, "title": "Creative tools", "brand": "adobe", "discount": "FREE"},
    ]
    coupons = [
        {"_id": ObjectId(), "offer_id": outlet_offer_id, "outlet_id": outlet_id, "user_id": student_one, "code": "ACTIVE", "status": "active", "created_at": now, "expires_at": now + timedelta(days=1)},
        {"_id": ObjectId(), "offer_id": outlet_offer_id, "outlet_id": outlet_id, "user_id": student_two, "code": "STALE", "status": "active", "created_at": now, "expires_at": now - timedelta(seconds=1)},
        {"_id": ObjectId(), "offer_id": brand_offer_id, "outlet_id": None, "user_id": student_one, "code": "USED", "status": "redeemed", "created_at": now, "redeemed_at": now},
    ]
    return now, outlets, offers, coupons


def test_report_groups_outlets_and_case_insensitive_online_brands():
    now, outlets, offers, coupons = report_records()
    rows = server._brand_outlet_report_rows(outlets, offers, coupons, now=now)

    outlet = next(row for row in rows if row["type"] == "outlet")
    brand = next(row for row in rows if row["type"] == "brand")
    assert outlet["address"] == "North Campus, Delhi"
    assert outlet["claimed"] == 2
    assert outlet["active"] == 1
    assert outlet["expired"] == 1
    assert outlet["unique_students"] == 2
    assert brand["name"] == "Adobe"
    assert brand["offer_count"] == 2
    assert brand["claimed"] == 1
    assert brand["redeemed"] == 1
    assert brand["redemption_rate"] == 100.0


def test_listed_brand_claim_counts_as_claimed_but_not_redeemable():
    now, outlets, offers, _ = report_records()
    brand_offer = next(offer for offer in offers if not offer.get("outlet_id"))
    activity = [{
        "_id": ObjectId(),
        "offer_id": brand_offer["_id"],
        "outlet_id": None,
        "user_id": ObjectId(),
        "status": "claimed",
        "record_type": "brand_offer_claim",
        "created_at": now,
    }]

    rows = server._brand_outlet_report_rows(outlets, offers, activity, now=now)
    brand = next(row for row in rows if row["type"] == "brand")

    assert brand["claimed"] == 1
    assert brand["active"] == 0
    assert brand["redeemed"] == 0
    assert brand["expired"] == 0


def test_admin_report_filters_type_city_and_search(monkeypatch):
    _, outlets, offers, coupons = report_records()

    async def fake_loader(_start, _end):
        return outlets, offers, coupons

    monkeypatch.setattr(server, "_load_brand_outlet_report_data", fake_loader)
    result = asyncio.run(server.admin_brands_outlets(
        entity_type="outlet",
        q="north campus",
        city="Delhi",
        date_from=None,
        date_to=None,
        admin={"role": "admin"},
    ))

    assert result["summary"]["entities"] == 1
    assert result["summary"]["outlets"] == 1
    assert result["summary"]["claimed"] == 2
    assert result["items"][0]["name"] == "Campus Cafe"
    assert result["date_basis"].startswith("Coupons are grouped")


def test_csv_export_contains_offer_summary_without_student_identity(monkeypatch):
    _, outlets, offers, coupons = report_records()

    async def fake_loader(_start, _end):
        return outlets, offers, coupons

    monkeypatch.setattr(server, "_load_brand_outlet_report_data", fake_loader)
    response = asyncio.run(server.admin_brands_outlets_export(
        entity_type="outlet",
        entity_id=str(outlets[0]["_id"]),
        date_from=None,
        date_to=None,
        admin={"role": "admin"},
    ))
    content = response.body.decode("utf-8")

    assert "Lunch combo" in content
    assert "Offers claimed" in content
    assert "student_one" not in content
    assert "email" not in content.casefold()
    assert response.headers["content-disposition"].endswith('campus-cafe-coupon-report.csv"')


def test_csv_cells_neutralize_spreadsheet_formulas():
    assert server._csv_cell("=HYPERLINK(\"bad\")") == "'=HYPERLINK(\"bad\")"
    assert server._csv_cell("  +SUM(1,1)") == "'  +SUM(1,1)"
    assert server._csv_cell("Normal offer") == "Normal offer"
