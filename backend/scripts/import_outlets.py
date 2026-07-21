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
    "redemption_policy",
    "validity",
    "featured",
    "trending",
]

DEFAULTS = {
    "featured": False,
    "trending": False,
}


def validate_outlets(outlets):
    if not isinstance(outlets, list):
        raise ValueError("outlets.json must contain a JSON array.")

    seen_keys = set()

    for index, outlet in enumerate(outlets):
        if not isinstance(outlet, dict):
            raise ValueError(
                f"Outlet at index {index} must be a JSON object."
            )

        name = outlet.get("name")
        city = outlet.get("city")

        if not name or not isinstance(name, str):
            raise ValueError(
                f"Outlet at index {index} has a missing or invalid name."
            )

        if not city or not isinstance(city, str):
            raise ValueError(
                f"Outlet at index {index} has a missing or invalid city."
            )

        outlet_key = (
            name.strip(),
            city.strip(),
        )

        if outlet_key in seen_keys:
            raise ValueError(
                f"Duplicate outlet found: {name} - {city}"
            )

        seen_keys.add(outlet_key)


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
            print(
                f"        {field}: "
                f"{old!r} -> {new!r}"
            )

            update[field] = new

    if update:
        update["updated_at"] = datetime.now(UTC)

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
                "redemption_policy": offer.get("redemption_policy", ""),
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

        linked_fields = {
            "brand": outlet["name"],
            "brand_logo": outlet.get("logo_url", ""),
            "image_url": outlet.get("cover_url", ""),
            "location": f"{outlet['name']} • {outlet['city']}",
        }

        for field, new in linked_fields.items():
            old = existing.get(field)

            if normalize(old) != normalize(new):
                update[field] = new

        if update:
            update["updated_at"] = datetime.now(UTC)

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


async def delete_removed_local_offers(outlet, outlet_id):
    json_offer_titles = {
        offer["title"].strip()
        for offer in outlet.get("offers", [])
    }

    removed_offer_ids = []
    removed_offer_titles = []

    cursor = db.offers.find(
        {
            "outlet_id": outlet_id,
        },
        {
            "_id": 1,
            "title": 1,
        },
    )

    async for existing_offer in cursor:
        title = existing_offer.get("title")

        if not isinstance(title, str):
            continue

        if title.strip() not in json_offer_titles:
            removed_offer_ids.append(existing_offer["_id"])
            removed_offer_titles.append(title)

    if not removed_offer_ids:
        return 0

    result = await db.offers.delete_many(
        {
            "_id": {
                "$in": removed_offer_ids,
            }
        }
    )

    for title in removed_offer_titles:
        success(f"Deleted offer : {title}")

    return result.deleted_count


async def delete_removed_outlets(outlets):
    json_outlet_keys = {
        (
            outlet["name"].strip(),
            outlet["city"].strip(),
        )
        for outlet in outlets
    }

    removed_outlets = []

    cursor = db.outlets.find(
        {},
        {
            "_id": 1,
            "name": 1,
            "city": 1,
        },
    )

    async for existing_outlet in cursor:
        name = existing_outlet.get("name")
        city = existing_outlet.get("city")

        if not isinstance(name, str) or not isinstance(city, str):
            continue

        database_key = (
            name.strip(),
            city.strip(),
        )

        if database_key not in json_outlet_keys:
            removed_outlets.append(existing_outlet)

    deleted_outlets = 0
    deleted_offers = 0

    for outlet in removed_outlets:
        outlet_id = outlet["_id"]

        offer_result = await db.offers.delete_many(
            {
                "outlet_id": outlet_id,
            }
        )

        outlet_result = await db.outlets.delete_one(
            {
                "_id": outlet_id,
            }
        )

        deleted_offers += offer_result.deleted_count
        deleted_outlets += outlet_result.deleted_count

        success(
            f"Deleted outlet : "
            f"{outlet.get('name')} ({outlet.get('city')})"
        )

        if offer_result.deleted_count:
            info(
                f"Deleted {offer_result.deleted_count} linked offer(s)."
            )

    return deleted_outlets, deleted_offers


async def main():
    divider()
    info("Importing Outlets")
    divider()

    outlets = load_json("outlets.json")

    validate_outlets(outlets)

    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    total_deleted_local_offers = 0

    for outlet in outlets:
        print(f"\n🍔 {outlet['name']} ({outlet['city']})")

        outlet_id = await import_outlet(outlet)

        inserted, updated, skipped = await import_local_offers(
            outlet,
            outlet_id,
        )

        deleted_local_offers = await delete_removed_local_offers(
            outlet,
            outlet_id,
        )

        total_inserted += inserted
        total_updated += updated
        total_skipped += skipped
        total_deleted_local_offers += deleted_local_offers

    deleted_outlets, deleted_linked_offers = (
        await delete_removed_outlets(outlets)
    )

    divider()

    print("Outlet Import Summary")
    print(f"Inserted offers       : {total_inserted}")
    print(f"Updated offers        : {total_updated}")
    print(f"Skipped offers        : {total_skipped}")
    print(f"Deleted local offers  : {total_deleted_local_offers}")
    print(f"Deleted outlets       : {deleted_outlets}")
    print(f"Deleted linked offers : {deleted_linked_offers}")

    divider()


if __name__ == "__main__":
    asyncio.run(main())
