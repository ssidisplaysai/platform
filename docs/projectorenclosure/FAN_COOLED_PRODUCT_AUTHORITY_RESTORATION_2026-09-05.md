# Fan Cooled Product Authority Restoration

Date: `2026-09-05`
Product ID: `prod-ssi-fan-cooled-projector-enclosures`

## Bounded Migration

- Durable repository: `.gcp-foundation-data/product-repository.json`
- Fresh backup: `.gcp-foundation-data/backups/fan-cooled-authority/product-repository.before-final-fan-cooled-20260905T113508186Z.json`
- Backup SHA-256: `5be49fe24151a04c28216ce202b2dd76c83b40106a2d3254859af8ec370e69fe`
- Revision: `4` to `6` (`createProduct` plus bounded activation update)
- Product count: `8` to `9`
- Added IDs: exactly `prod-ssi-fan-cooled-projector-enclosures`
- Existing products semantically changed: `0`
- Categories semantically changed: `0`
- Manufacturers changed: `0`
- Homeline count: `1` before and after
- UTF-8 BOM: absent

Timestamp-only changes to Homeline/category occurred before the final migration operation and were preserved as concurrent state. Semantic comparison against the immediate backup is unchanged.

## Canonical Authority

- Product name/display name: Fan Cooled Projector Enclosures
- Slug: `fan-cooled-projector-enclosures`
- SKU: `WP-PROJECTORENCLOSURE-10541`
- Type/family: `projector_enclosure` / Fan Cooled Projector Enclosures
- Site: `site-ssi-projectorenclosure`
- Category: `cat-ssi-projector-enclosures`
- Manufacturer: `mfr-ssi-projector-enclosures`
- Primary media: `wordpress-media:10757`
- Evidence: `wordpress-page:10541:https://projectorenclosure.com/fan-cooled-projector-enclosures/`
- Lifecycle/catalog/visibility: active / ready / public_candidate

Only three specifications were restored:

1. Built-In Fan Cooling / Fan Cooled
2. Durable Metal Construction / Metal
3. Removable or hinged access panels

No generated Irvine claims were used. The authority explicitly excludes inferred ratings, weather guarantees, filters, security, universal compatibility, thermal sizing, insulation, mounting, and other unsupported features.

## API and Test Evidence

- Authenticated sidecar `/api/products?query=fan-cooled-projector-enclosures`: exactly one result
- Targeted product/Homeline/planner tests: `18/18` passed
- Jest test-isolation proof: live durable repository hash unchanged before/after test execution
- Port `3001`: read-only and untouched
- No WordPress, campaign, target, media, redirect, credential, LDW, or SSI campaign mutation