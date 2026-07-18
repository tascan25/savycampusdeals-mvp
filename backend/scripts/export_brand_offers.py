import asyncio
import json
from pathlib import Path

from db import db
from helpers import (
    divider,
    info,
    success,
)

OUTPUT_FILE = (
    Path(__file__)
    .resolve()
    .parent.parent
    / "data"
    / "brand_offers.json"
)

EXPORT_FIELDS = [
    "title",
    "brand",
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


async def main():

    divider()
    info("Exporting Brand Offers")
    divider()

    offers = await db.offers.find(
        {
            "outlet_id": None,
        }
    ).to_list(length=None)

    export = []

    for offer in offers:

        document = {}

        for field in EXPORT_FIELDS:

            document[field] = offer.get(field)

        export.append(document)

    export.sort(
        key=lambda x: (
            x["brand"].lower(),
            x["title"].lower(),
        )
    )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            export,
            f,
            indent=2,
            ensure_ascii=False,
        )

    success(f"Exported {len(export)} brand offers")
    print(f"\nSaved to:\n{OUTPUT_FILE}")

    divider()


if __name__ == "__main__":
    asyncio.run(main())