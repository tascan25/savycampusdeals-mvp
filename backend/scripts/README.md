# Maintenance scripts

## Legacy brand coupon migration

The brand-offer migration is deliberately read-only by default. From the
`backend` directory, first inspect the affected record counts:

```bash
python3 scripts/migrate_brand_coupons.py
```

After taking a database backup and reviewing those counts, apply it explicitly:

```bash
python3 scripts/migrate_brand_coupons.py --apply
```

The migration does not delete coupons. It creates one listed-brand claim per
student and offer, then archives the corresponding legacy QR/coupon records.
