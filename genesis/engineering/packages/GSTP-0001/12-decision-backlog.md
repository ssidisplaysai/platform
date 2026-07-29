# Decision Backlog

## Platform Decisions

| Decision | Classification | Notes |
|---|---|---|
| Canonical GSTP location | Architecture baseline established | Foundation package path established at genesis/engineering/packages/GSTP-0001. |
| Canonical SPN location | Architecture decision required | Recommend under same canonical engineering root. |
| GSTP registration method | Architecture decision required | Must align with existing constitutional registry model. |
| SPN registration method | Architecture decision required | Must align with artifact registration model. |
| Shared STONER identity | Business + architecture | Needs product authority semantics and architecture model. |
| Shared customer identity | Privacy + architecture | Requires privacy/legal review. |
| Product identity ownership | Business decision required | Cross-app ownership unresolved. |
| Order identity ownership | Business + accounting | Needed for attribution and finance reconciliation. |
| Analytics ownership | Architecture + privacy | Shared vs app-owned unresolved. |
| Event ownership | Architecture decision required | Cross-context event authority unresolved. |
| Integration ownership | Architecture decision required | Shared integration boundary unresolved. |
| Data retention/deletion | Legal/privacy required | Policy unresolved. |
| Security model extensions | Security review required | Shared policy unresolved. |
| Application isolation strategy | Architecture/security | Isolation boundary unresolved. |
| Release strategy | Architecture decision required | Packaging and certification profile unresolved. |
| Certification strategy | Architecture decision required | Needs GAR/GD adaptation for STONER program. |

## Resolved Identifier Authority Decision

| Decision | Resolution | Notes |
|---|---|---|
| Identifier family assignment | Closed | GSP remains reserved for Genesis Specification Governance; GSTP assigned to Genesis STONER Platform; resolution completed before commit/registration/approval/certification/implementation; no migration required; existing Genesis artifacts unaffected. |

## SPN Decisions

| Decision | Classification | Notes |
|---|---|---|
| Partner identity ownership | Business + architecture | Entity authority unresolved. |
| Partner classification model | Business decision required | Configurable taxonomy required. |
| Sponsor cardinality | Business decision required | Single vs multi-sponsor unresolved. |
| Sponsor reassignment | Business/legal | Historical lineage impacts unresolved. |
| Sponsor lineage vs compensation lineage | Architecture decision required | Must remain separate models. |
| Compensation depth | Business decision required | Policy depth unresolved. |
| Direct seller commission | Business/accounting | Rule basis unresolved. |
| Sponsor override | Business/accounting | Override logic unresolved. |
| Attribution window | Business decision required | Window policy unresolved. |
| First-touch vs last-touch | Business decision required | Priority unresolved. |
| QR/coupon/account precedence | Business decision required | Rule precedence unresolved. |
| Self-referrals/split attribution | Legal/business | Policy unresolved. |
| Commission basis | Accounting decision required | Net/gross/adjusted basis unresolved. |
| Shipping/tax/discount inclusion | Accounting/legal | Inclusion rules unresolved. |
| Product exclusions | Business decision required | Exclusion policy unresolved. |
| Return reserve/chargeback policy | Accounting/legal | Reversal behavior unresolved. |
| Payout and credits | Accounting/business | Channel rules unresolved. |
| Minimum payout | Accounting decision required | Threshold unresolved. |
| Inactivity threshold | Business decision required | Preliminary model provided only. |
| Qualified activity | Business decision required | Definition unresolved. |
| QR behavior after inactivity | Business + compliance | Visibility and assignment behavior unresolved. |
| Reactivation policy | Business/legal | Reverification and terms acceptance unresolved. |
| Territory/exclusivity | Business/legal | Rights model unresolved. |
| Ledger visibility | Privacy/security | Exposure boundaries unresolved. |
| Manual adjustments | Accounting/security | Approval controls unresolved. |
| Payout provider/tax provider/KYC provider | Implementation discovery required | Vendor selection unresolved. |
| Commerce integration | Implementation discovery required | Source platforms unresolved. |
| Analytics data boundaries | Privacy decision required | Aggregation and exposure policy unresolved. |
| Account deletion/legal preservation | Legal/privacy required | Preservation vs deletion obligations unresolved. |
