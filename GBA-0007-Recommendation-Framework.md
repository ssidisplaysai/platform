# GBA-0007 Recommendation Framework

## Recommendation Categories

1. AT_RISK
2. RENEWAL
3. ESCALATION
4. ADOPTION
5. EXPANSION

## Lifecycle

1. NEW
2. REVIEWED
3. APPROVED
4. REJECTED
5. DISMISSED

## Review Flow

1. POST /api/gba/customer-success/recommendations/review validates payload.
2. Authorized actors with gba:customer_success:review_recommendations can submit decisions.
3. Decision creates recommendation review record and timeline evidence entry.
4. Recommendation status is updated to the review decision.
