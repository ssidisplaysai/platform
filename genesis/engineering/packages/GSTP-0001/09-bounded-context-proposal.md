# Bounded Context Proposal

## GSTP-Wide Contexts

### STONER Platform Registry
- Purpose: register STONER platform subjects and application relationships.
- Owned entities: platform subject, application descriptor.
- Owned policies: registration eligibility, naming constraints.
- Inputs: constitutional registration requests.
- Outputs: governed standing records.
- Genesis dependencies: registry and identity resolution.
- Forbidden responsibilities: runtime implementation.
- Future package: GSTP-0002.

### STONER Shared Identity
- Purpose: common identity boundaries across STONER applications.
- Owned entities: platform actor profile classes.
- Owned policies: identity continuity and ID non-reuse policy.
- Genesis dependencies: identity and authority resolution.
- Forbidden responsibilities: authentication implementation.
- Future package: GSTP-0003.

### STONER Commerce Boundary
- Purpose: define what commerce remains external versus owned.
- Owned policies: ingestion boundaries, customer data boundaries.
- External dependencies: ecommerce systems, payment systems.
- Forbidden responsibilities: checkout implementation.
- Future package: GSTP-0004.

### STONER Shared Analytics
- Purpose: cross-app analytics taxonomy and privacy controls.
- Forbidden responsibilities: exposing payment secrets.
- Future package: GSTP-0005.

### STONER Shared Governance
- Purpose: policy overlays subordinate to Genesis governance.
- Genesis dependencies: review, validation, audit services.
- Future package: GSTP-0007.

### STONER Shared Integrations
- Purpose: third-party boundary models and contract governance.
- External dependencies: payment, tax, verification, fraud, messaging.
- Future package: GSTP-0006.

## SPN-Specific Contexts

### Partner Registry
- Purpose: partner identities and statuses.
- Owned entities: partner account, partner ID.
- Future package: SPN-0002.

### Partner Programs and Classifications
- Purpose: configurable partner classifications and program attachment.
- Future package: SPN-0003.

### Relationship Graph
- Purpose: sponsor lineage and compensation lineage as separate graphs.
- Future package: SPN-0004.

### QR and Link Management
- Purpose: managed QR assignment and managed short links.
- Future package: SPN-0005.

### Attribution
- Purpose: raw evidence retention and final decision retention.
- Future package: SPN-0006.

### Compensation
- Purpose: rule-versioned deterministic calculations.
- Future package: SPN-0008.

### Ledger
- Purpose: append-only partner/admin financial evidence.
- Future package: SPN-0009.

### Payout and Credit
- Purpose: payout, merchandise credit, inventory credit policy enforcement.
- Future package: SPN-0011.

### Partner Lifecycle
- Purpose: inactivity/reactivation/suspension/archival.
- Future package: SPN-0010.

### Compliance, Fraud and Risk, Disputes
- Purpose: policy enforcement and issue resolution.
- Future package: SPN-0012 and SPN-0013.

### Partner Experience and Administrative Operations
- Purpose: future portals and dashboards.
- Future package: SPN-0014 and SPN-0015.

### Partner Analytics and Intelligence
- Purpose: partner and network insights.
- Future package: SPN-0016.
