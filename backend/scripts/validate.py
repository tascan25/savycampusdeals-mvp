from helpers import load_json

# ----------------------------
# Required Fields
# ----------------------------

REQUIRED_OUTLET_FIELDS = [
    "name",
    "tagline",
    "cuisine",
    "city",
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

REQUIRED_LOCAL_OFFER_FIELDS = [
    "title",
    "discount",
    "description",
    "terms",
    "validity",
]


# ----------------------------
# Validate Outlets
# ----------------------------

def validate_outlets(outlets):

    seen_outlets = set()

    for outlet in outlets:

        # Required outlet fields
        for field in REQUIRED_OUTLET_FIELDS:
            if field not in outlet:
                raise ValueError(
                    f"Outlet '{outlet.get('name', 'Unknown')}' is missing '{field}'"
                )

        # Duplicate outlet detection
        outlet_key = (
            outlet["name"].strip().lower(),
            outlet["city"].strip().lower(),
        )

        if outlet_key in seen_outlets:
            raise ValueError(
                f"Duplicate outlet found: {outlet['name']} ({outlet['city']})"
            )

        seen_outlets.add(outlet_key)

        # Offers must exist
        offers = outlet.get("offers", [])

        if not isinstance(offers, list):
            raise ValueError(
                f"'offers' must be a list in outlet '{outlet['name']}'"
            )

        validate_local_offers(outlet["name"], offers)

    print(f"✅ {len(outlets)} outlet(s) validated.")


# ----------------------------
# Validate Offers
# ----------------------------

def validate_local_offers(outlet_name, offers):

    seen_titles = set()

    for offer in offers:

        # Required offer fields
        for field in REQUIRED_LOCAL_OFFER_FIELDS:
            if field not in offer:
                raise ValueError(
                    f"Offer in '{outlet_name}' is missing '{field}'"
                )

        title = offer["title"].strip().lower()

        if title in seen_titles:
            raise ValueError(
                f"Duplicate offer '{offer['title']}' found in '{outlet_name}'"
            )

        seen_titles.add(title)

    print(f"   ↳ {len(offers)} offer(s) validated for {outlet_name}")


# ----------------------------
# Main
# ----------------------------

def main():

    print("\nValidating outlets...\n")

    outlets = load_json("outlets.json")

    validate_outlets(outlets)

    print("\n" + "─" * 30)
    print("✅ Validation Successful!")
    print("─" * 30)


if __name__ == "__main__":
    main()