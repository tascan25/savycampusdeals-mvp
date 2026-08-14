"""Focused coverage for the admin email studio's validation and rendering."""
import os
import sys
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["MONGO_URL"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "savycampusdeals_unit"
os.environ["JWT_SECRET"] = "unit-test-secret-that-is-long-enough"

import server  # noqa: E402


def campaign_input(**overrides):
    values = {
        "name": "Savvy Card launch",
        "subject": "Your card got a glow-up",
        "preview_text": "See the new card",
        "heading": "Meet your new Savvy Card",
        "message": "A premium new look.",
        "eyebrow": "SAVVY CAMPUS UPDATE",
        "cta_label": "View my card",
        "cta_url": "/card",
        "audience": "approved_students",
        "background_color": "#050706",
        "card_color": "#083f46",
        "accent_color": "#2dd4bf",
        "text_color": "#ffffff",
        "muted_color": "#c7dedb",
        "button_text_color": "#042f2e",
        "corner_style": "rounded",
    }
    values.update(overrides)
    return server.AdminEmailCampaignIn(**values)


def test_campaign_payload_rejects_unsafe_urls_and_invalid_colours():
    try:
        server._validated_email_campaign_payload(
            campaign_input(cta_url="javascript:alert(1)")
        )
        assert False, "unsafe CTA should fail"
    except HTTPException as exc:
        assert exc.status_code == 400

    try:
        server._validated_email_campaign_payload(
            campaign_input(accent_color="teal")
        )
        assert False, "invalid colour should fail"
    except HTTPException as exc:
        assert exc.status_code == 400


def test_campaign_html_escapes_content_and_expands_internal_cta(monkeypatch):
    monkeypatch.setattr(server, "FRONTEND_URL", "https://savvy.example")
    campaign = server._validated_email_campaign_payload(
        campaign_input(
            heading="Hello <script>alert(1)</script>",
            message="Line one\nLine <b>two</b>",
        )
    )
    rendered = server.email_campaign_html(
        campaign,
        recipient_name="Aarav <Admin>",
        unsubscribe_url="https://api.example/unsubscribe?t=safe",
    )

    assert "<script>" not in rendered
    assert "&lt;script&gt;" in rendered
    assert "Line one<br />Line &lt;b&gt;two&lt;/b&gt;" in rendered
    assert "https://savvy.example/card" in rendered
    assert "Aarav &lt;Admin&gt;" in rendered
    assert "Unsubscribe" in rendered


def test_unsubscribe_token_round_trip_and_tamper_rejection():
    user_id = ObjectId()
    token = server._campaign_unsubscribe_token(user_id)
    assert server._decode_campaign_unsubscribe_token(token) == user_id

    try:
        server._decode_campaign_unsubscribe_token(token[:-1] + "x")
        assert False, "tampered token should fail"
    except HTTPException as exc:
        assert exc.status_code == 400


def test_approved_audience_excludes_opted_out_students():
    query = server._campaign_audience_query("approved_students")
    assert query["role"] == "student"
    assert query["email_verified"] is True
    assert query["verification_status"] == "approved"
    assert query["marketing_email_opt_out"] == {"$ne": True}
