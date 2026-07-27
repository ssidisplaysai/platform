# Genesis Business Agent Interaction Matrix

## Matrix Definitions
1. Owns: capabilities and intelligence records the agent is constitutionally responsible for.
2. Consumes: read-only intelligence from other agents/domain.
3. Publishes: outputs made available to peers and Executive.
4. Never Owns: capability domains constitutionally outside the agent.
5. Never Writes: records and states owned by other agents/domain.

## Interaction Matrix
| Agent | Owns | Consumes | Publishes | Never Owns | Never Writes |
|---|---|---|---|---|---|
| Executive | Enterprise strategic synthesis, cross-agent priorities, executive recommendations | Operations, Manufacturing, Marketing, Sales, Finance, Customer Success, Enterprise Domain | Executive briefings, strategic KPIs, enterprise alerts, enterprise health summary | Functional operational capabilities, canonical entities | Any non-executive agent repository/state |
| Operations | Work orders, inventory operations, warehouse/purchasing/shipping intelligence, operational health | Manufacturing throughput signals, sales demand context, finance constraints, enterprise entities | Operational KPIs, capacity/risk alerts, operational recommendations, operational health | Marketing strategy, sales pipeline, finance ledger ownership | Manufacturing, Marketing, Sales, Finance, Executive, Customer Success state |
| Manufacturing | Production orders, machine/labor/material quality intelligence, costing intelligence, manufacturing health | Operations scheduling context, sales demand, finance budget guardrails, enterprise entities | Manufacturing KPIs, cost/quality signals, manufacturing recommendations, manufacturing health | Sales CRM ownership, finance ledger ownership, executive synthesis ownership | Operations, Marketing, Sales, Finance, Executive, Customer Success state |
| Marketing | Campaigns, content strategy, SEO/brand/analytics intelligence, marketing health | Sales conversion outcomes, executive goals, enterprise entities | Marketing KPIs, campaign performance signals, marketing recommendations, marketing health | Sales pipeline ownership, finance controls, operations execution ownership | Operations, Manufacturing, Sales, Finance, Executive, Customer Success state |
| Sales | Pipeline, forecasting, account intelligence, sales health | Marketing demand signals, operations fulfillment constraints, finance terms context, enterprise entities | Sales KPIs, forecast signals, sales recommendations, sales health | Marketing ownership, finance ledger ownership, operations ownership | Operations, Manufacturing, Marketing, Finance, Executive, Customer Success state |
| Finance | Ledger, AR/AP, budgets, forecasts, profitability, finance health | Sales revenue forecasts, manufacturing cost drivers, operations spend, enterprise entities | Financial KPIs, budget/performance reports, finance recommendations, finance health | Sales account ownership, marketing campaign ownership, canonical entity ownership | Operations, Manufacturing, Marketing, Sales, Executive, Customer Success state |
| Customer Success | Onboarding, customer health, renewals, satisfaction/support/expansion intelligence, customer success health | Sales account context, marketing engagement context, finance risk posture, operations delivery signals, executive priorities, enterprise entities | Customer success KPIs, renewal/churn risk signals, customer success recommendations, customer success health | Canonical entities, finance ledger ownership, sales pipeline ownership | Operations, Manufacturing, Marketing, Sales, Finance, Executive state |

## Cross-Agent Interaction Highlights
1. Marketing influences Sales through read-only demand and engagement signals.
2. Sales influences Finance through revenue forecast and account risk signals.
3. Manufacturing influences Finance through cost and throughput intelligence.
4. Customer Success influences Executive through retention and renewal intelligence.
5. Executive consumes all major agent outputs and produces enterprise-level synthesis.

## Ownership Invariant Check
1. Single owner per capability: required.
2. Shared consumption: allowed.
3. Shared mutation: prohibited.
