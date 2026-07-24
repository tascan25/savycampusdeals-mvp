"""Read-only admin analytics API coverage."""
import os

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api" if BASE_URL else ""

pytestmark = pytest.mark.skipif(
    not API,
    reason="REACT_APP_BACKEND_URL is required for API integration tests",
)


@pytest.fixture(scope="module")
def admin_headers():
    response = requests.post(
        f"{API}/auth/login",
        json={
            "email": "admin@savycampusdeals.in",
            "password": "Admin@123",
        },
        timeout=20,
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_admin_analytics_requires_authentication():
    response = requests.get(f"{API}/admin/analytics", timeout=20)
    assert response.status_code == 401


def test_admin_analytics_returns_college_and_activity_data(admin_headers):
    response = requests.get(
        f"{API}/admin/analytics",
        params={"date_from": "2026-01-01", "date_to": "2026-01-07"},
        headers=admin_headers,
        timeout=30,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["period"] == {
        "date_from": "2026-01-01",
        "date_to": "2026-01-07",
    }
    assert len(data["trend"]) == 7
    assert set(data["summary"]) == {
        "total_students",
        "verified_students",
        "verification_rate",
        "registrations",
        "approvals",
        "redemptions",
        "issued",
    }
    assert set(data["verification_funnel"]) == {
        "registered",
        "submitted",
        "approved",
    }
    assert all(
        item["college"].strip() and item["registrations"] >= 1
        for item in data["college_registrations"]
    )
    college_counts = [
        item["registrations"] for item in data["college_registrations"]
    ]
    assert college_counts == sorted(college_counts, reverse=True)
    assert [item["status"] for item in data["redemption_status"]] == [
        "active",
        "redeemed",
        "expired",
    ]


def test_admin_analytics_rejects_unbounded_custom_range(admin_headers):
    response = requests.get(
        f"{API}/admin/analytics",
        params={"date_from": "2024-01-01", "date_to": "2026-01-01"},
        headers=admin_headers,
        timeout=20,
    )
    assert response.status_code == 400
    assert "366 days" in response.json()["detail"]
