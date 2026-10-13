# Share-to-Grow PostgreSQL staging certification (2026-10-11)

- Source branch: `infra/genesis-staging-runtime-v1`
- Source SHA: `8d9f8092c9524a5eeb3cda321b5cb754eae640a2`
- Staging cluster/service: `genesis-production` / `genesis-staging-web`
- Certified runtime task definition: `genesis-staging-web:5`
- Certified persistence backend proof: `GENESIS_PERSISTENCE_BACKEND_SELECTED backend=postgres`

## Baseline and pre-certification

- Clean pre-certification business revision: `24`
- Clean pre-certification semantic hash: `eaa47329a63dcfe8097d42b234461be9b7a16d35a8349df3d69f21061b3d9b37`
- EFS source checksum before certification: `f1c46c53164e5f155bc09fe952a70f10dd3467fec662277927a25c6d5d07421c`

## A-F economics certification results

- Case A (unpaid/on-hold): ignored ineligible, no economics recognized
- Case B (paid): DMP `37.00`, split `18.50 / 12.95 / 5.55` (STONER/Jessica/Daniel)
- Case C (paid then cancelled): full reversal to net `0.00`
- Case D (paid then refund `20.00`): reversal `20.00`, net DMP `17.00`, split net `8.50 / 5.95 / 2.55`
- Case E (paid then refunds `20.00` + `40.00`): cumulative full economic reversal capped at `37.00`, brand loss `23.00`
- Case F (paid then refund `50.00`): reversal capped at `37.00`, brand loss `13.00`

## Certified final staging business state

- Final business revision: `36`
- Final semantic hash: `74391ce09d02d4222d88fc3f7c53fa6a9c942d06b9234ab4a3282a7222727e98`
- Final collection counts:
  - participants: `0`
  - trackingIdentities: `0`
  - ruleVersions: `0`
  - ledgerEntries: `57`
  - sourceEventReceipts: `27`
  - processedCommerceLines: `10`
  - payoutEntitlements: `30`
  - commerceAdjustments: `9`

## Idempotency and durability gates

- Duplicate replay (exact delivery replay): **PASS**
- Controlled restart durability: **PASS**
- Post-restart duplicate replay: **PASS**

## Safety and boundary outcomes

- EFS checksum after certification unchanged: `f1c46c53164e5f155bc09fe952a70f10dd3467fec662277927a25c6d5d07421c`
- Automated payouts executed: **NO**
- Production infrastructure/data modified during this staging certification: **NO**

