# Genesis Enterprise Data Authority Model

## Data Authority Principles
1. Data authority is singular per domain.
2. Non-authoritative applications may cache, index, or materialize read models but cannot supersede authority.
3. Cross-application updates require contract-mediated workflows.

## Canonical Data Authorities
| Domain Data | Authoritative Application |
|---|---|
| Users and identities | Identity and Access |
| Canonical business knowledge and ontology | Business Genome |
| Commercial transactions and commercial documents | Commerce Platform |
| Production and manufacturing execution records | Manufacturing Platform |
| Campaign and marketing execution records | Marketing Platform |
| Operational state and health records | Operations Platform |
| Support case records | Support Platform |
| Executive analytics products | Executive Intelligence |

## Non-Authority Clarifications
- AI services are not data authorities.
- Shared services are not business-domain authorities.
- Dashboard is an orchestration surface, not a domain record authority.
