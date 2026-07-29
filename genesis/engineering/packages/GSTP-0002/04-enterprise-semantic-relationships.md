# Relationships

| Concept | Parent Concepts | Child Concepts | Associated Concepts | Forbidden Relationships | Cross-Domain References |
|---|---|---|---|---|---|
| Customer | Account | Profile|Collector|Passport | Order|Community|Support Case | Customer without Identity | Commerce|Community|Support |
| Account | Customer | Identity|Authorization | Order|Invoice|Payment | Account as person-level identity | Commerce|Finance|Security |
| Identity | Account | Registration|Authentication|Authorization | Profile|Passport | Identity shared across unrelated Customers | Security|Community|Commerce |
| Profile | Customer | None | Identity|Preferences|Experience | Profile treated as legal identity | Community|Marketing|Experience |
| Product | Collection | SKU|Variant|Digital Twin | Inventory|Campaign|Promotion | Multiple authoritative Product identities | Commerce|Inventory|Manufacturing |
| SKU | Product | None | Variant|Inventory|Order | SKU detached from Product authority | Inventory|Commerce |
| Variant | Product | None | SKU|Media Asset|Inventory | Variant without parent Product | Inventory|Commerce |
| Collection | None | Product | Campaign|Experience | Collection as inventory unit | Marketing|Commerce |
| Collector | Customer | None | Passport|Badge|Achievement | Collector as standalone identity root | Community|Rewards |
| Passport | Customer|Identity | None | Reward|Badge|Achievement|Registration | Passport shared across multiple Identities | Rewards|Community|Security |
| Reward | Passport | None | Badge|Commission|Ledger Entry | Reward without traceable source | Finance|Community|Commerce |
| Badge | Reward | None | Achievement|Passport | Badge granted outside Reward policy | Community|Identity |
| Achievement | Badge | None | Passport|Event | Achievement detached from Badge semantics | Community|Events |
| Partner | None | Affiliate|Distributor|Supplier|Vendor | Commission|Policy | Partner treated as Customer account alias | Finance|Commerce|Governance |
| Affiliate | Partner | None | Campaign|Commission|Promotion | Affiliate without Partner lineage | Marketing|Finance |
| Retailer | Partner|Store | None | Order|Inventory|Promotion | Retailer used as distributor synonym | Commerce|Inventory |
| Distributor | Partner | None | Shipment|Territory|Invoice | Distributor without territory accountability | Logistics|Finance |
| Manufacturer | Partner | None | Supplier|Warranty|Product | Manufacturer interpreted as internal team by default | Supply Chain|Quality |
| Supplier | Partner | None | Manufacturer|Inventory|Shipment | Supplier without supply obligation semantics | Manufacturing|Inventory |
| Vendor | Partner | None | Invoice|Payment|Policy | Vendor conflated with Supplier obligations | Finance|Governance |
| Store | Region | Retailer|Order | Inventory|Event|Experience | Store used as legal entity by default | Commerce|Community |
| Region | None | Territory|Store | Distributor|Executive Metric | Region interpreted as sales team only | Finance|Operations |
| Territory | Region | Store|Distributor | Campaign|Order|Shipment | Territory without Region parent | Territory Planning|Logistics |
| Order | Cart | Invoice|Shipment|Return | Payment|Commission|Ledger Entry | Order without Customer or Account authority | Finance|Operations|Support |
| Cart | Customer | Order | Promotion|Recommendation|Configuration | Cart as persistent identity container | Marketing|Experience |
| Invoice | Order | Payment|Ledger Entry | Commission|Audit Record | Invoice without Order origin | Commerce|Audit |
| Payment | Invoice | None | Order|Ledger Entry|Commission | Payment without invoice context | Commerce|Audit |
| Commission | Order|Campaign | None | Affiliate|Ledger Entry|Payment | Commission without auditable business event | Finance|Audit |
| Campaign | Business Objective | Promotion|Event | Content|Executive Metric | Campaign treated as promotion equivalent | Analytics|Community |
| Promotion | Campaign | None | Cart|Order|Reward | Promotion without campaign authority | Commerce|Finance |
| Event | Campaign | Experience|Registration | Community|Notification | Event treated as immutable product | Marketing|Operations |
| Experience | Event | Registration|Content | Customer|Community|Media Asset | Experience as identity record | Community|Marketing |
| Community | None | Event|Content|Notification | Customer|Collector|Policy | Community as legal ownership boundary | Governance|Support |
| Content | Document | Media Asset|Notification | Campaign|Community | Content conflated with policy authority | Marketing|Community |
| Media Asset | Content | None | Product|Experience|Campaign | Media Asset as authoritative product identity | Catalog|Marketing |
| QR Asset | Digital Twin | None | Product|Experience|Registration | QR Asset resolving multiple authoritative destinations at once | Product|Security |
| Digital Twin | Product | QR Asset | Media Asset|Configuration | Digital Twin treated as physical inventory unit | Catalog|Operations |
| Registration | Identity | None | Event|Passport|Authentication | Registration interpreted as Authentication itself | Security|Community |
| Authentication | Identity | None | Authorization|Registration | Authentication used as entitlement decision | Identity|Governance |
| Authorization | Authentication | None | Policy|Task|Workflow | Authorization without policy reference | Governance|Operations |
| Inventory | Warehouse | Shipment|Return | SKU|Order|Store | Inventory modeled without SKU linkage | Commerce|Manufacturing |
| Warehouse | Region | Inventory|Shipment | Store|Order|Return | Warehouse as legal finance ledger | Logistics|Finance |
| Shipment | Order | Return|Warranty | Warehouse|Distributor|Customer | Shipment detached from Order/Inventory lineage | Commerce|Support |
| Return | Order | Warranty|Support Case | Inventory|Shipment|Invoice | Return without original order reference | Finance|Inventory |
| Warranty | Product | Support Case | Return|Manufacturer | Warranty treated as promotion discount | Manufacturing|Legal |
| Support Case | Customer | Task|Notification | Order|Warranty|Policy | Support Case as workflow engine artifact | Operations|Governance |
| Notification | Event|Support Case | None | Customer|Task|Policy | Notification as policy source of truth | Support|Marketing |
| Task | Workflow | None | Policy|Authorization|Support Case | Task as legal contract artifact | Governance|Support |
| Workflow | Capability | Task | Policy|Authorization|Application | Workflow interpreted as runtime implementation spec | Technology|Governance |
| Document | None | Policy|Content|Audit Record | Task|Workflow | Document as executable logic source | Governance|Legal |
| Policy | Document | Authorization|Audit Record | Workflow|Configuration|Feature Flag | Policy interpreted as optional guidance | Security|Operations |
| Audit Record | Policy | None | Ledger Entry|Analytics Event|Document | Audit Record as mutable event stream | Finance|Security |
| Ledger Entry | Invoice|Payment | None | Commission|Audit Record | Ledger Entry without auditable origin | Audit|Commerce |
| Analytics Event | Event | Executive Metric|Operational Metric | Business Objective|Dashboard | Analytics Event as policy authority | AI|Operations |
| Executive Metric | Business Objective | Executive Dashboard | Operational Metric|Analytics Event | Executive Metric with no objective mapping | Analytics|Finance |
| Business Objective | None | Executive Metric|Capability | Application|Campaign | Objective without accountable owner | Operations|Finance |
| Capability | Business Objective | Application|Shared Service | Workflow|Operational Metric | Capability treated as deployed system | Technology|Operations |
| Application | Capability | None | Shared Service|Configuration|Feature Flag | Application as semantic authority root | Technology|Security |
| Shared Service | Application | None | AI Agent|Search Index|Recommendation | Shared Service as domain owner replacement | Technology|Governance |
| AI Agent | Application | Recommendation|Task | Policy|Analytics Event|Search Index | AI Agent as semantic authority rewriter | Governance|Security |
| Recommendation | AI Agent | None | Search Index|Campaign|Product | Recommendation as binding business rule | Commerce|Marketing |
| Search Index | Shared Service | None | Recommendation|Content|Product | Search Index as authoritative source of truth | AI|Catalog |
| Configuration | Application | Feature Flag | Policy|Workflow|Shared Service | Configuration overriding policy authority | Governance|Security |
| Feature Flag | Configuration | None | Application|Operational Metric | Feature Flag as governance bypass | Operations|Security |
| System Health | Operational Metric | None | Application|Shared Service|Dashboard | System Health as executive objective authority | Executive Governance|Operations |
| Operational Metric | Analytics Event | System Health|Executive Dashboard | Capability|Application | Operational Metric replacing executive metric | Executive Governance|Analytics |
| Executive Dashboard | Executive Metric | None | Operational Metric|Business Objective | Dashboard as source semantic authority | Analytics|Technology |