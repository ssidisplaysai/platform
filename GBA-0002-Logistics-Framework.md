# GBA-0002 Logistics Framework

## Capability
Logistics coverage spans shipping operations, carrier tracking, delivery timing, freight cost, and damage-claim visibility.

## Data Model
- `GbaOperationsShippingRecord`
- `GbaOperationsShippingHistory`
- `GbaOperationsVendorMetric`
- `GbaOperationsVendorMetricHistory`

## Runtime Notes
- Shipping and vendor baseline rows are seeded if empty.
- Delays and vendor on-time trends feed health snapshots and recommendations.

## APIs
- `GET /api/gba/operations/shipping`
- `GET /api/gba/operations/recommendations`
- `POST /api/gba/operations/recommendations/review`
