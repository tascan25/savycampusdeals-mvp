import asyncio
from datetime import UTC, datetime

from db import db
from helpers import (
    divider,
    info,
    load_json,
    normalize,
    success,
)


OFFER_FIELDS = [
    "brand_logo",
    "brand_url",
    "category",
    "description",
    "discount",
    "image_url",
    "terms",
    "validity",
    "featured",
    "trending",
    "location",
]


DEFAULTS = {
    "featured": False,
    "trending": False,
    "location": "Digital",
    "claims_count": 0,
}


def validate_offers(offers):
    """
    Validate the JSON data before making any database changes.

    Each brand offer must have a brand and title because those fields
    are used as the unique identity for synchronization.
    """

    if not isinstance(offers, list):
        raise ValueError("brand_offers.json must contain a JSON array.")

    seen_offer_keys = set()

    for index, offer in enumerate(offers):

        if not isinstance(offer, dict):
            raise ValueError(
                f"Offer at index {index} must be a JSON object."
            )

        brand = offer.get("brand")
        title = offer.get("title")

        if not brand or not isinstance(brand, str):
            raise ValueError(
                f"Offer at index {index} has a missing or invalid brand."
            )

        if not title or not isinstance(title, str):
            raise ValueError(
                f"Offer at index {index} has a missing or invalid title."
            )

        offer_key = (brand.strip(), title.strip())

        if offer_key in seen_offer_keys:
            raise ValueError(
                "Duplicate offer found in brand_offers.json: "
                f"{brand} - {title}"
            )

        seen_offer_keys.add(offer_key)


async def import_brand_offer(offer):
    """
    Insert a new brand offer or update an existing brand offer.

    Existing runtime fields such as claims_count and created_at are
    preserved when an offer is updated.
    """

    existing = await db.offers.find_one(
        {
            "brand": offer["brand"],
            "title": offer["title"],
            "outlet_id": None,
        }
    )

    if existing is None:

        document = offer.copy()

        document["featured"] = offer.get(
            "featured",
            DEFAULTS["featured"],
        )
        document["trending"] = offer.get(
            "trending",
            DEFAULTS["trending"],
        )
        document["location"] = offer.get(
            "location",
            DEFAULTS["location"],
        )
        document["claims_count"] = DEFAULTS["claims_count"]

        document["outlet_id"] = None
        document["created_at"] = datetime.now(UTC)

        await db.offers.insert_one(document)

        success(f"Inserted : {offer['title']}")

        return "inserted"

    update = {}

    for field in OFFER_FIELDS:

        old_value = existing.get(field)
        new_value = offer.get(field, DEFAULTS.get(field))

        if normalize(old_value) != normalize(new_value):

            print(
                f"        {field}: "
                f"{old_value!r} -> {new_value!r}"
            )

            update[field] = new_value

    if update:

        update["updated_at"] = datetime.now(UTC)

        await db.offers.update_one(
            {"_id": existing["_id"]},
            {"$set": update},
        )

        success(f"Updated : {offer['title']}")

        return "updated"

    info(f"Skipped : {offer['title']}")

    return "skipped"


async def delete_removed_brand_offers(offers):
    """
    Delete brand offers that exist in MongoDB but no longer exist
    in brand_offers.json.

    Only documents with outlet_id=None are considered. Outlet-specific
    offers are never deleted by this function.
    """

    json_offer_keys = {
        (
            offer["brand"].strip(),
            offer["title"].strip(),
        )
        for offer in offers
    }

    removed_offer_ids = []
    removed_offer_names = []

    cursor = db.offers.find(
        {
            "outlet_id": None,
            "brand": {"$exists": True},
            "title": {"$exists": True},
        },
        {
            "_id": 1,
            "brand": 1,
            "title": 1,
        },
    )

    async for existing_offer in cursor:

        brand = existing_offer.get("brand")
        title = existing_offer.get("title")

        if not isinstance(brand, str) or not isinstance(title, str):
            continue

        database_offer_key = (
            brand.strip(),
            title.strip(),
        )

        if database_offer_key not in json_offer_keys:

            removed_offer_ids.append(existing_offer["_id"])
            removed_offer_names.append(
                f"{brand} - {title}"
            )

    if not removed_offer_ids:
        info("No removed brand offers found.")

        return 0

    delete_result = await db.offers.delete_many(
        {
            "_id": {
                "$in": removed_offer_ids,
            }
        }
    )

    for offer_name in removed_offer_names:
        success(f"Deleted  : {offer_name}")

    return delete_result.deleted_count


async def main():

    divider()
    info("Importing Brand Offers")
    divider()

    offers = load_json("brand_offers.json")

    # Validate the complete file before updating MongoDB.
    validate_offers(offers)

    inserted = 0
    updated = 0
    skipped = 0

    for offer in offers:

        result = await import_brand_offer(offer)

        if result == "inserted":
            inserted += 1

        elif result == "updated":
            updated += 1

        else:
            skipped += 1

    # Run deletion only after every JSON offer has been processed
    # successfully.
    deleted = await delete_removed_brand_offers(offers)

    divider()

    print("Brand Offer Summary")
    print(f"Inserted : {inserted}")
    print(f"Updated  : {updated}")
    print(f"Skipped  : {skipped}")
    print(f"Deleted  : {deleted}")

    divider()


if __name__ == "__main__":
    asyncio.run(main())