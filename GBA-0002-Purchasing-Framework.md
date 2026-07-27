# GBA-0002 Purchasing Framework

## Capability
Purchasing tracks request/order references, vendor links, lead times, delivery due dates, and total cost posture.

## Data Model
- `GbaOperationsPurchasingRecord`
- `GbaOperationsPurchasingHistory`

## Runtime Notes
- Baseline purchasing records are seeded if empty.
- Lead time and vendor dependencies are used in recommendations and executive summaries.

## API
- `GET /api/gba/operations/purchasing`
