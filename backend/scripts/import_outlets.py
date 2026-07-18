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

OUTLET_FIELDS = [
    "tagline",
    "cuisine",
    "address",
    "lat",
    "lng",
    "image_url",
    "cover_url",
    "logo_url",
    "phone",
    "hours",
    "rating",
]

OFFER_FIELDS = [
    "title",
    "category",
    "discount",
    "description",
    "terms",
    "validity",
    "featured",
    "trending",
]

DEFAULTS = {
    "featured": False,
    "trending": False,
}


async def import_outlet(outlet):

    existing = await db.outlets.find_one(
        {
            "name": outlet["name"],
            "city": outlet["city"],
        }
    )

    if existing is None:

        document = outlet.copy()
        document.pop("offers", None)

        document["created_at"] = datetime.now(UTC)

        result = await db.outlets.insert_one(document)

        success(f"Inserted : {outlet['name']}")

        return result.inserted_id

    update = {}

    for field in OUTLET_FIELDS:

        old = existing.get(field)
        new = outlet.get(field)

        if normalize(old) != normalize(new):

            print(f"        {field}: " f"{old!r}  ->  {new!r}")

            update[field] = new

    if update:

        await db.outlets.update_one(
            {"_id": existing["_id"]},
            {"$set": update},
        )

        success(f"Updated : {outlet['name']}")

    else:

        info(f"Skipped : {outlet['name']}")

    return existing["_id"]


async def import_local_offers(outlet, outlet_id):

    offers = outlet.get("offers", [])

    inserted = 0
    updated = 0
    skipped = 0

    for offer in offers:

        existing = await db.offers.find_one(
            {
                "outlet_id": outlet_id,
                "title": offer["title"],
            }
        )

        if existing is None:

            document = {
                "title": offer["title"],
                "category": offer["category"],
                "discount": offer["discount"],
                "description": offer["description"],
                "terms": offer["terms"],
                "validity": offer["validity"],
                "brand": outlet["name"],
                "brand_logo": outlet.get("logo_url", ""),
                "brand_url": "",
                "image_url": outlet.get("cover_url", ""),
                "location": f"{outlet['name']} • {outlet['city']}",
                "outlet_id": outlet_id,
                "featured": offer.get("featured", False),
                "trending": offer.get("trending", False),
                "claims_count": 0,
                "created_at": datetime.now(UTC),
            }

            await db.offers.insert_one(document)

            inserted += 1
            print(f"      ✅ Inserted offer: {offer['title']}")

            continue

        update = {}

        for field in OFFER_FIELDS:

            old = existing.get(field)

            new = offer.get(field, DEFAULTS.get(field))

            if normalize(old) != normalize(new):
                update[field] = new

        if update:

            await db.offers.update_one(
                {"_id": existing["_id"]},
                {"$set": update},
            )

            updated += 1
            print(f"      🔄 Updated offer: {offer['title']}")

        else:

            skipped += 1
            print(f"      ⏭ Skipped offer: {offer['title']}")

    return inserted, updated, skipped


async def main():

    divider()
    info("Importing Outlets")
    divider()

    outlets = load_json("outlets.json")

    total_inserted = 0
    total_updated = 0
    total_skipped = 0

    for outlet in outlets:

        print(f"\n🍔 {outlet['name']} ({outlet['city']})")

        outlet_id = await import_outlet(outlet)

        inserted, updated, skipped = await import_local_offers(
            outlet,
            outlet_id,
        )

        total_inserted += inserted
        total_updated += updated
        total_skipped += skipped

    divider()

    print("Offer Summary")
    print(f"Inserted : {total_inserted}")
    print(f"Updated  : {total_updated}")
    print(f"Skipped  : {total_skipped}")

    divider()


if __name__ == "__main__":
    asyncio.run(main())
