# Genesis Application Responsibility Matrix

## Ownership Matrix
| Capability | Authoritative Owner | Supporting Consumers |
|---|---|---|
| Users | Identity and Access | Dashboard, Commerce, Marketing, Operations |
| Roles | Identity and Access | All applications |
| Permissions | Identity and Access | All applications |
| Organizations | Identity and Access | Dashboard, Commerce, Marketing |
| Authentication | Identity and Access | All applications |
| Sessions | Identity and Access | All applications |
| Navigation | Enterprise Dashboard (GLW) | All operators |
| Operations Monitoring | Enterprise Dashboard (GLW) | Operations Platform, Executive Intelligence |
| Site Management | Enterprise Dashboard (GLW) | Commerce Platform, Marketing Platform |
| Publishing Control | Enterprise Dashboard (GLW) | Marketing Platform |
| Canonical Business Knowledge | Business Genome | Commerce, Marketing, Executive Intelligence |
| Ontology | Business Genome | Commerce, Discovery, Executive Intelligence |
| Relationships | Business Genome | Commerce, Manufacturing, Executive Intelligence |
| Entity Authority | Business Genome | All data-producing applications |
| Knowledge Validation | Business Genome | Discovery Platform |
| Campaigns | Marketing Platform | Operations, Executive Intelligence |
| Content Generation | Marketing Platform | Dashboard |
| SEO | Marketing Platform | Dashboard |
| Publishing Orchestration | Marketing Platform | Operations Platform |
| Brand Assets | Marketing Platform | Commerce Platform |
| Customers | Commerce Platform | Customer Success Platform |
| Products | Commerce Platform | Manufacturing Platform, Marketing Platform |
| Quotes | Commerce Platform | Operations Platform |
| Orders | Commerce Platform | Manufacturing Platform |
| Commercial Documents | Commerce Platform | Financial Platform (future) |
| Pricing | Commerce Platform | Marketing Platform |
| Production | Manufacturing Platform | Operations Platform |
| Work Centers | Manufacturing Platform | Operations Platform |
| Machines | Manufacturing Platform | Operations Platform |
| Jobs | Manufacturing Platform | Executive Intelligence |
| Materials | Manufacturing Platform | Commerce Platform |
| Source Discovery | Discovery Platform | Business Genome |
| Evidence Acquisition | Discovery Platform | Business Genome |
| Import Orchestration | Discovery Platform | Business Genome |
| Analytics | Executive Intelligence | Executive stakeholders |
| KPIs | Executive Intelligence | Executive stakeholders |
| Executive Dashboards | Executive Intelligence | Leadership |
| Recommendations | Executive Intelligence | Marketing, Commerce, Operations |
| Forecasting | Executive Intelligence | Commerce, Manufacturing |
| Enterprise Operational Visibility | Operations Platform | Dashboard |
| Alerts | Operations Platform | Support Platform |
| Health | Operations Platform | Executive Intelligence |
| Maintenance | Operations Platform | Support Platform |
| Tickets | Support Platform | Operations Platform |
| Cases | Support Platform | Customer Success Platform |
| Knowledge Articles | Support Platform | Support staff |
| Service History | Support Platform | Customer Success Platform |
| SDKs | Developer Platform | Internal and external developers |
| Extensions | Developer Platform | All extensible applications |
| Developer Tooling | Developer Platform | Engineering teams |

## Deterministic Ownership Rule
Each capability above has exactly one authoritative owner.
