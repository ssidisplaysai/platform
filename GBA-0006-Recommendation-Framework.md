# GBA-0006 Recommendation Framework

## Categories
- Cash flow
- Budget
- Cost
- Profit
- AR
- AP
- Anomaly

## Lifecycle
- Initial state: `NEW`
- Review decisions: `REVIEWED`, `APPROVED`, `REJECTED`, `DISMISSED`

## Endpoints
- Read: `GET /api/gba/finance/recommendations`
- Review: `POST /api/gba/finance/recommendations/review`

## Authorization
- View: `gba:finance:view_recommendations`
- Review: `gba:finance:review_recommendations`
