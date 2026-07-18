import asyncio

from db import db
from helpers import load_json


async def main():
    print("Connected to MongoDB!")

    offers = load_json("offers.json")
    outlets = load_json("outlets.json")

    print(f"Offers in JSON : {len(offers)}")
    print(f"Outlets in JSON: {len(outlets)}")

    count = await db.offers.count_documents({})
    print(f"Offers in MongoDB: {count}")


if __name__ == "__main__":
    asyncio.run(main())