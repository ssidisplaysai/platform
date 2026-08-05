# 04 Value Objects

Canonical reusable value objects:

1. Dimensions
- Fields: length, width, height, unit.
- Rules: non-negative values; unit required.

2. Weight
- Fields: value, unit.
- Rules: non-negative; unit required.

3. Currency
- Fields: ISO currency code.
- Rules: valid code set only.

4. Money
- Fields: amount, Currency.
- Rules: deterministic decimal precision and currency consistency.

5. EffectiveDateRange
- Fields: startsAt, endsAt.
- Rules: startsAt <= endsAt; open-ended allowed by policy.

6. SKU
- Fields: skuValue.
- Rules: stable canonical business identifier format.

7. PartNumber
- Fields: partNumberValue.
- Rules: format policy and uniqueness constraints in Product scope.

8. Barcode
- Fields: barcodeValue, barcodeType.
- Rules: type-consistent format checks.

9. GTIN
- Fields: gtinValue.
- Rules: checksum-valid structure.

10. UPC
- Fields: upcValue.
- Rules: checksum-valid structure.

11. ManufacturerReference
- Fields: manufacturerId, manufacturerPartNumber.
- Rules: reference-only semantics.

12. RevisionIdentifier
- Fields: revisionToken.
- Rules: immutable once version published.

13. VersionIdentifier
- Fields: major, minor, patch or canonical token.
- Rules: monotonic progression in defined lineage.

14. DisplayName
- Fields: primary text.
- Rules: non-empty, normalized display policy.

15. LocalizedText
- Fields: locale map.
- Rules: fallback locale required.

16. MetadataCollection
- Fields: key-value set.
- Rules: governed key namespace and value type policy.

17. AttributeCollection
- Fields: AttributeValue set.
- Rules: attribute definition compatibility and cardinality enforcement.

Value-object modeling rules:

1. Value objects are immutable as a unit.
2. Updates produce replacement instances.
3. No value object owns foreign canonical state.
