"""Safely migrate legacy non-outlet coupons into listed brand-offer claims.

The script is read-only unless --apply is supplied. Coupon records are never
deleted: applied migrations preserve their former status and mark them archived.
"""
import argparse
import asyncio
from datetime import UTC, datetime

from db import db
from helpers import divider, info, success


async def migrate(apply_changes: bool) -> None:
    query = {
        "outlet_id": None,
        "status": {"$ne": "archived"},
    }
    coupons = await db.coupons.find(query).sort("created_at", 1).to_list(None)
    offer_ids = {c.get("offer_id") for c in coupons if c.get("offer_id")}
    offers = (
        await db.offers.find({"_id": {"$in": list(offer_ids)}}).to_list(None)
        if offer_ids
        else []
    )
    listed_brand_offer_ids = {
        offer["_id"] for offer in offers if not offer.get("outlet_id")
    }
    eligible_coupons = [
        coupon
        for coupon in coupons
        if coupon.get("user_id")
        and coupon.get("offer_id") in listed_brand_offer_ids
    ]
    skipped_count = len(coupons) - len(eligible_coupons)
    divider()
    info("Legacy Brand Coupon Migration")
    info(f"Mode: {'APPLY' if apply_changes else 'DRY RUN'}")
    info(f"Legacy coupon records found: {len(coupons)}")
    info(f"Eligible legacy coupons: {len(eligible_coupons)}")
    info(f"Students affected: {len({c['user_id'] for c in eligible_coupons})}")
    info(f"Offers affected: {len({c['offer_id'] for c in eligible_coupons})}")
    info(f"Malformed, missing-offer, or non-brand records skipped: {skipped_count}")

    if not apply_changes:
        info("No database records were changed. Re-run with --apply after review.")
        divider()
        return

    migrated = 0
    archived = 0
    migration_time = datetime.now(UTC)
    for coupon in eligible_coupons:
        claimed_at = coupon.get("created_at") or migration_time
        await db.brand_offer_claims.update_one(
            {
                "user_id": coupon["user_id"],
                "offer_id": coupon["offer_id"],
            },
            {
                "$setOnInsert": {
                    "user_id": coupon["user_id"],
                    "offer_id": coupon["offer_id"],
                    "status": "claimed",
                    "claimed_at": claimed_at,
                    "last_visited_at": claimed_at,
                    "visit_count": 1,
                    "source": "legacy_coupon_migration",
                    "migrated_at": migration_time,
                },
                "$addToSet": {"legacy_coupon_ids": coupon["_id"]},
            },
            upsert=True,
        )
        migrated += 1
        result = await db.coupons.update_one(
            {"_id": coupon["_id"], "status": {"$ne": "archived"}},
            {
                "$set": {
                    "legacy_status": coupon.get("status", "active"),
                    "status": "archived",
                    "archived_at": migration_time,
                    "archived_reason": "migrated_to_listed_brand_offer_claim",
                }
            },
        )
        archived += result.modified_count

    success(f"Brand claim links created or updated: {migrated}")
    success(f"Legacy coupons archived: {archived}")
    info("No coupon records were deleted.")
    divider()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the migration. Without this flag the command is read-only.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    asyncio.run(migrate(arguments.apply))
