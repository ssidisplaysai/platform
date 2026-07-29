# Genesis Application Boundary Model

## Boundary Rules
1. Application boundaries are capability-centric.
2. Ownership implies write authority over canonical records in that capability domain.
3. Non-owners consume via contracts only.
4. No direct database coupling across applications.
5. Shared enterprise services remain neutral and non-domain-authoritative.

## Per-Application Boundary Statements
| Application | Owns | Must Not Own |
|---|---|---|
| Identity and Access | Users, roles, permissions, auth, sessions | Business knowledge, campaigns, commercial transactions |
| Enterprise Dashboard (GLW) | Navigation, enterprise operation surface, configuration UX | Domain transactional records |
| Business Genome | Canonical knowledge graph and ontology | Campaign execution, quote/order execution |
| Marketing Platform | Campaigns, content, SEO, publishing orchestration | Canonical identity, commercial transaction records |
| Commerce Platform | Customers, products, quotes, orders, pricing | Marketing execution, machine control |
| Manufacturing Platform | Production schedules, work centers, machine/jobs/material records | Campaign ownership, quote authority |
| Discovery Platform | Source discovery and evidence acquisition | Canonical business authority |
| Executive Intelligence | KPI and analytics products | Source transactional authority |
| Operations Platform | Operational state, health, maintenance visibility | Quote/order authoring |
| Support Platform | Tickets, cases, support history | Canonical commerce or manufacturing ownership |
| Developer Platform | SDKs, extension framework, tooling | Domain authority records |

## Boundary Determinism Outcome
Boundaries are deterministic when ownership is singular and explicit, and all non-owner access occurs through published contracts.
