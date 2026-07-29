# Enterprise Event Model

| Event | Producer | Consumers | Owning Context | Lifecycle Role | Strategic Importance |
|---|---|---|---|---|---|
| Product Created | Product Context | Commerce, Inventory, Marketing | Product Context | catalog genesis | High |
| Product Registered | Passport Context | Rewards, Collectibles, Analytics | Passport Context | participation binding | High |
| QR Scanned | QR Platform Context | Passport, Marketing, Events, Partner | QR Platform Context | interaction evidence | Critical |
| Customer Created | Customer Context | Identity, Commerce, Analytics | Customer Context | relationship start | High |
| Order Completed | Commerce Context | Rewards, Finance, Inventory | Commerce Context | value realization | Critical |
| Reward Earned | Rewards Context | Passport, Customer, Analytics | Rewards Context | loyalty progression | High |
| Partner Activated | Partner Network Context | Commerce, Rewards, Analytics | Partner Network Context | channel expansion | High |
| Passport Stamp Earned | Passport Context | Rewards, Community | Passport Context | journey progression | High |
| Limited Drop Released | Product Context | Commerce, Community, Marketing | Product Context | scarcity activation | Medium |
| Inventory Received | Inventory Context | Commerce, Retail, Analytics | Inventory Context | fulfillment readiness | High |
| Manufacturing Completed | Manufacturing Context | Inventory, Product, Analytics | Manufacturing Context | supply readiness | High |
| Store Opened | Retail Context | Events, Commerce, Community | Retail Context | channel expansion | Medium |
| Store Visit Recorded | Retail Context | Passport, Rewards, Analytics | Retail Context | behavior signal | Medium |
| Referral Credited | Partner Network Context | Rewards, Finance, Analytics | Partner Network Context | network incentive | High |
| Event Attended | Events Context | Passport, Community, Rewards | Events Context | engagement deepening | Medium |

## Event Principles
- Event ownership is singular and explicit.
- Events are business facts, not implementation commands.
- Event lineage is preserved for audit and analytics.