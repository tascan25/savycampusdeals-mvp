import asyncio
from datetime import datetime, UTC

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


async def import_brand_offer(offer):

    existing = await db.offers.find_one(
        {
            "brand": offer["brand"],
            "title": offer["title"],
            "outlet_id": None,
        }
    )

    if existing is None:

        document = offer.copy()

        document = offer.copy()

        document["featured"] = offer.get("featured", DEFAULTS["featured"])
        document["trending"] = offer.get("trending", DEFAULTS["trending"])
        document["location"] = offer.get("location", DEFAULTS["location"])
        document["claims_count"] = DEFAULTS["claims_count"]

        document["outlet_id"] = None
        document["created_at"] = datetime.now(UTC)

        await db.offers.insert_one(document)

        success(f"Inserted : {offer['title']}")

        return "inserted"

    update = {}

    for field in OFFER_FIELDS:

        old = existing.get(field)
        new = offer.get(field, DEFAULTS.get(field))

        if normalize(old) != normalize(new):

            print(f"        {field}: {old!r} -> {new!r}")

            update[field] = new

    if update:

        await db.offers.update_one(
            {"_id": existing["_id"]},
            {"$set": update},
        )

        success(f"Updated : {offer['title']}")

        return "updated"

    info(f"Skipped : {offer['title']}")

    return "skipped"


async def main():

    divider()
    info("Importing Brand Offers")
    divider()

    offers = load_json("brand_offers.json")

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

    divider()

    print("Brand Offer Summary")
    print(f"Inserted : {inserted}")
    print(f"Updated  : {updated}")
    print(f"Skipped  : {skipped}")

    divider()


if __name__ == "__main__":
    asyncio.run(main())