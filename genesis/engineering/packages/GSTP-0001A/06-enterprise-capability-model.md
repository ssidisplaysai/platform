# Enterprise Capability Model

| Domain | Mission | Owned Capabilities | Consumed Capabilities | Produced Capabilities | Strategic Importance | Business Value | Architectural Risk |
|---|---|---|---|---|---|---|---|
| Identity and Access | Provide trusted identity and authority boundaries | identity, authN policy, authZ policy, role model | audit, events, notifications | verified identities, permission decisions | Critical | High | High |
| Commerce and Orders | Execute and govern value exchange | pricing policy, order lifecycle, refund policy | identity, product, inventory, payments | orders, commerce events | Critical | High | High |
| Product and Catalog | Govern product identity and lifecycle | product model, variants, lifecycle states | media, manufacturing, inventory | product records and states | Critical | High | Medium |
| Partner Network | Govern partner participation and economics | partner identity, sponsor graph, policy states | identity, rewards, ledger, commerce | partner states, referral relations | High | High | High |
| Passport and Participation | Track customer participation journey | participation ledger, stamps, milestones | identity, events, products | participation proofs | High | High | Medium |
| Rewards and Value Exchange | Manage incentives and loyalty policy | reward policy, earn/redeem rules | passport, commerce, ledger | reward balances and events | High | High | High |
| Collectibles and Provenance | Govern collectible artifacts and ownership story | collectible identity, provenance graph | product, passport, events | collectible state and provenance | Medium | High | Medium |
| QR and Interaction Routing | Route identity-bearing interactions | route policy, destination governance | identity, product, campaigns | scan events, interaction routes | High | High | High |
| Manufacturing and Supply Network | Govern production lineage and lot state | lot identity, manufacturing milestones | product, inventory | lot records and traceability | High | High | High |
| Inventory and Fulfillment | Govern stock and movement | inventory states, allocations, fulfillment policy | product, commerce, stores | inventory events and balances | Critical | High | High |
| Finance and Ledger Operations | Preserve financial truth and reconciliation | ledger entries, settlement policy | commerce, rewards, payouts | financial evidence and balances | Critical | High | High |
| Analytics and Intelligence | Deliver trusted decision support | metric definitions, model governance | events, domain data, AI | insights and scorecards | High | High | Medium |
| AI and Agents | Augment decisions and operations responsibly | model ops policy, agent orchestration policy | analytics, events, identity | recommendations, forecasts, assistant outputs | High | High | High |
| Administration and Governance | Protect constitutional integrity | governance workflows, approvals, controls | all domains | policy decisions and control records | Critical | High | Medium |