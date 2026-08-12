# GLW Genesis Integration Guide (GLW-1001)

## Purpose
Provide the canonical implementation blueprint for onboarding enterprise applications to Genesis using GLW as reference.

## Step 1: Register in EAR
1. Define identity, ownership, lifecycle, launch metadata, capabilities, and health references.
2. Register through EAR authority only.
3. Do not implement a parallel registry in the application.

## Step 2: Participate in EHC
1. Provide required health inputs through EHC interfaces.
2. Do not compute enterprise health aggregation in the application.
3. Do not duplicate readiness/liveness/compatibility policy logic.

## Step 3: Discover in GMC
1. Ensure launch metadata and capability metadata are available in EAR.
2. Ensure EHC has current health records.
3. GMC dynamically assembles discovery/search/navigation/dashboard.

## Step 4: Launch Participation
1. Launch targets are defined by application metadata.
2. Launch policy, validation, and block semantics are controlled by GMC.
3. Application UI must not override platform launch policy.

## Step 5: Capability Participation
1. Declare capabilities in EAR.
2. Consume capability status from EHC/GMC outputs.
3. Avoid maintaining separate capability inventories in orchestration layers.

## Step 6: Boundary Compliance Checklist
- Keep business domain behavior in the application.
- Keep platform responsibilities in EAR/EHC/GMC.
- Do not move persistence ownership across layers.
- Preserve constitutional authorities.

## GLW-Specific Implementation Notes
- GLW registration lifecycle set to ACTIVE for launchability.
- GLW health and capability routes delegate to EHC handlers.
- GLW remains unchanged in business workflow behavior.
