# Enterprise Semantic Dictionary

Each concept defines canonical meaning, purpose, owner, lifecycle, relationships, invariants, prohibited interpretations, and extension guidance.

## Customer
- Meaning: Canonical enterprise meaning of Customer within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Customer decisions, governance, and analytics.
- Owner: Customer Identity (Chief Customer Officer)
- Lifecycle: Prospect->Active->Dormant->Closed
- Relationships: Parent=Account; Child=Profile|Collector|Passport; Associated=Order|Community|Support Case
- Invariants: Customer must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Customer without Identity
- Future Extension Guidance: Extend Customer through additive attributes and explicit versioning without semantic drift.

## Account
- Meaning: Canonical enterprise meaning of Account within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Account decisions, governance, and analytics.
- Owner: Customer Identity (Chief Customer Officer)
- Lifecycle: Provisioned->Active->Suspended->Closed
- Relationships: Parent=Customer; Child=Identity|Authorization; Associated=Order|Invoice|Payment
- Invariants: Account must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Account as person-level identity
- Future Extension Guidance: Extend Account through additive attributes and explicit versioning without semantic drift.

## Identity
- Meaning: Canonical enterprise meaning of Identity within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Identity decisions, governance, and analytics.
- Owner: Customer Identity (Chief Trust Officer)
- Lifecycle: Created->Verified->Active->Revoked
- Relationships: Parent=Account; Child=Registration|Authentication|Authorization; Associated=Profile|Passport
- Invariants: Identity must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Identity shared across unrelated Customers
- Future Extension Guidance: Extend Identity through additive attributes and explicit versioning without semantic drift.

## Profile
- Meaning: Canonical enterprise meaning of Profile within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Profile decisions, governance, and analytics.
- Owner: Customer Identity (Chief Customer Officer)
- Lifecycle: Created->Updated->Archived
- Relationships: Parent=Customer; Child=None; Associated=Identity|Preferences|Experience
- Invariants: Profile must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Profile treated as legal identity
- Future Extension Guidance: Extend Profile through additive attributes and explicit versioning without semantic drift.

## Product
- Meaning: Canonical enterprise meaning of Product within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Product decisions, governance, and analytics.
- Owner: Product and Catalog (Chief Product Officer)
- Lifecycle: Concepted->Approved->Active->Retired
- Relationships: Parent=Collection; Child=SKU|Variant|Digital Twin; Associated=Inventory|Campaign|Promotion
- Invariants: Product must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Multiple authoritative Product identities
- Future Extension Guidance: Extend Product through additive attributes and explicit versioning without semantic drift.

## SKU
- Meaning: Canonical enterprise meaning of SKU within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for SKU decisions, governance, and analytics.
- Owner: Product and Catalog (Chief Product Officer)
- Lifecycle: Defined->Published->Active->Discontinued
- Relationships: Parent=Product; Child=None; Associated=Variant|Inventory|Order
- Invariants: SKU must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: SKU detached from Product authority
- Future Extension Guidance: Extend SKU through additive attributes and explicit versioning without semantic drift.

## Variant
- Meaning: Canonical enterprise meaning of Variant within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Variant decisions, governance, and analytics.
- Owner: Product and Catalog (Chief Product Officer)
- Lifecycle: Defined->Active->Discontinued
- Relationships: Parent=Product; Child=None; Associated=SKU|Media Asset|Inventory
- Invariants: Variant must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Variant without parent Product
- Future Extension Guidance: Extend Variant through additive attributes and explicit versioning without semantic drift.

## Collection
- Meaning: Canonical enterprise meaning of Collection within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Collection decisions, governance, and analytics.
- Owner: Product and Catalog (Chief Product Officer)
- Lifecycle: Drafted->Published->Archived
- Relationships: Parent=None; Child=Product; Associated=Campaign|Experience
- Invariants: Collection must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Collection as inventory unit
- Future Extension Guidance: Extend Collection through additive attributes and explicit versioning without semantic drift.

## Collector
- Meaning: Canonical enterprise meaning of Collector within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Collector decisions, governance, and analytics.
- Owner: Community and Recognition (Chief Community Officer)
- Lifecycle: Identified->Engaged->Recognized
- Relationships: Parent=Customer; Child=None; Associated=Passport|Badge|Achievement
- Invariants: Collector must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Collector as standalone identity root
- Future Extension Guidance: Extend Collector through additive attributes and explicit versioning without semantic drift.

## Passport
- Meaning: Canonical enterprise meaning of Passport within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Passport decisions, governance, and analytics.
- Owner: Identity and Participation (Chief Trust Officer)
- Lifecycle: Issued->Active->Suspended->Revoked
- Relationships: Parent=Customer|Identity; Child=None; Associated=Reward|Badge|Achievement|Registration
- Invariants: Passport must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Passport shared across multiple Identities
- Future Extension Guidance: Extend Passport through additive attributes and explicit versioning without semantic drift.

## Reward
- Meaning: Canonical enterprise meaning of Reward within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Reward decisions, governance, and analytics.
- Owner: Rewards and Incentives (Chief Growth Officer)
- Lifecycle: Defined->Granted->Redeemed->Expired
- Relationships: Parent=Passport; Child=None; Associated=Badge|Commission|Ledger Entry
- Invariants: Reward must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Reward without traceable source
- Future Extension Guidance: Extend Reward through additive attributes and explicit versioning without semantic drift.

## Badge
- Meaning: Canonical enterprise meaning of Badge within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Badge decisions, governance, and analytics.
- Owner: Rewards and Incentives (Chief Growth Officer)
- Lifecycle: Defined->Earned->Displayed->Retired
- Relationships: Parent=Reward; Child=None; Associated=Achievement|Passport
- Invariants: Badge must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Badge granted outside Reward policy
- Future Extension Guidance: Extend Badge through additive attributes and explicit versioning without semantic drift.

## Achievement
- Meaning: Canonical enterprise meaning of Achievement within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Achievement decisions, governance, and analytics.
- Owner: Rewards and Incentives (Chief Growth Officer)
- Lifecycle: Defined->Awarded->Archived
- Relationships: Parent=Badge; Child=None; Associated=Passport|Event
- Invariants: Achievement must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Achievement detached from Badge semantics
- Future Extension Guidance: Extend Achievement through additive attributes and explicit versioning without semantic drift.

## Partner
- Meaning: Canonical enterprise meaning of Partner within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Partner decisions, governance, and analytics.
- Owner: Partner Ecosystem (Chief Partnerships Officer)
- Lifecycle: Prospected->Contracted->Active->Terminated
- Relationships: Parent=None; Child=Affiliate|Distributor|Supplier|Vendor; Associated=Commission|Policy
- Invariants: Partner must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Partner treated as Customer account alias
- Future Extension Guidance: Extend Partner through additive attributes and explicit versioning without semantic drift.

## Affiliate
- Meaning: Canonical enterprise meaning of Affiliate within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Affiliate decisions, governance, and analytics.
- Owner: Partner Ecosystem (Chief Partnerships Officer)
- Lifecycle: Invited->Approved->Active->Offboarded
- Relationships: Parent=Partner; Child=None; Associated=Campaign|Commission|Promotion
- Invariants: Affiliate must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Affiliate without Partner lineage
- Future Extension Guidance: Extend Affiliate through additive attributes and explicit versioning without semantic drift.

## Retailer
- Meaning: Canonical enterprise meaning of Retailer within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Retailer decisions, governance, and analytics.
- Owner: Channel Operations (Chief Revenue Officer)
- Lifecycle: Onboarded->Active->Suspended->Offboarded
- Relationships: Parent=Partner|Store; Child=None; Associated=Order|Inventory|Promotion
- Invariants: Retailer must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Retailer used as distributor synonym
- Future Extension Guidance: Extend Retailer through additive attributes and explicit versioning without semantic drift.

## Distributor
- Meaning: Canonical enterprise meaning of Distributor within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Distributor decisions, governance, and analytics.
- Owner: Channel Operations (Chief Revenue Officer)
- Lifecycle: Contracted->Active->Suspended->Terminated
- Relationships: Parent=Partner; Child=None; Associated=Shipment|Territory|Invoice
- Invariants: Distributor must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Distributor without territory accountability
- Future Extension Guidance: Extend Distributor through additive attributes and explicit versioning without semantic drift.

## Manufacturer
- Meaning: Canonical enterprise meaning of Manufacturer within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Manufacturer decisions, governance, and analytics.
- Owner: Manufacturing (Chief Operations Officer)
- Lifecycle: Qualified->Active->Suspended->Terminated
- Relationships: Parent=Partner; Child=None; Associated=Supplier|Warranty|Product
- Invariants: Manufacturer must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Manufacturer interpreted as internal team by default
- Future Extension Guidance: Extend Manufacturer through additive attributes and explicit versioning without semantic drift.

## Supplier
- Meaning: Canonical enterprise meaning of Supplier within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Supplier decisions, governance, and analytics.
- Owner: Supply Chain (Chief Operations Officer)
- Lifecycle: Qualified->Active->Suspended->Terminated
- Relationships: Parent=Partner; Child=None; Associated=Manufacturer|Inventory|Shipment
- Invariants: Supplier must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Supplier without supply obligation semantics
- Future Extension Guidance: Extend Supplier through additive attributes and explicit versioning without semantic drift.

## Vendor
- Meaning: Canonical enterprise meaning of Vendor within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Vendor decisions, governance, and analytics.
- Owner: Supply Chain (Chief Operations Officer)
- Lifecycle: Approved->Active->Suspended->Offboarded
- Relationships: Parent=Partner; Child=None; Associated=Invoice|Payment|Policy
- Invariants: Vendor must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Vendor conflated with Supplier obligations
- Future Extension Guidance: Extend Vendor through additive attributes and explicit versioning without semantic drift.

## Store
- Meaning: Canonical enterprise meaning of Store within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Store decisions, governance, and analytics.
- Owner: Channel Operations (Chief Revenue Officer)
- Lifecycle: Planned->Opened->Operating->Closed
- Relationships: Parent=Region; Child=Retailer|Order; Associated=Inventory|Event|Experience
- Invariants: Store must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Store used as legal entity by default
- Future Extension Guidance: Extend Store through additive attributes and explicit versioning without semantic drift.

## Region
- Meaning: Canonical enterprise meaning of Region within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Region decisions, governance, and analytics.
- Owner: Enterprise Geography (Chief Strategy Officer)
- Lifecycle: Defined->Active->Rebalanced->Retired
- Relationships: Parent=None; Child=Territory|Store; Associated=Distributor|Executive Metric
- Invariants: Region must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Region interpreted as sales team only
- Future Extension Guidance: Extend Region through additive attributes and explicit versioning without semantic drift.

## Territory
- Meaning: Canonical enterprise meaning of Territory within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Territory decisions, governance, and analytics.
- Owner: Enterprise Geography (Chief Strategy Officer)
- Lifecycle: Designed->Assigned->Active->Reassigned
- Relationships: Parent=Region; Child=Store|Distributor; Associated=Campaign|Order|Shipment
- Invariants: Territory must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Territory without Region parent
- Future Extension Guidance: Extend Territory through additive attributes and explicit versioning without semantic drift.

## Order
- Meaning: Canonical enterprise meaning of Order within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Order decisions, governance, and analytics.
- Owner: Commerce (Chief Commerce Officer)
- Lifecycle: Created->Confirmed->Fulfilled->Closed
- Relationships: Parent=Cart; Child=Invoice|Shipment|Return; Associated=Payment|Commission|Ledger Entry
- Invariants: Order must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Order without Customer or Account authority
- Future Extension Guidance: Extend Order through additive attributes and explicit versioning without semantic drift.

## Cart
- Meaning: Canonical enterprise meaning of Cart within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Cart decisions, governance, and analytics.
- Owner: Commerce (Chief Commerce Officer)
- Lifecycle: Created->Active->Converted/Abandoned
- Relationships: Parent=Customer; Child=Order; Associated=Promotion|Recommendation|Configuration
- Invariants: Cart must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Cart as persistent identity container
- Future Extension Guidance: Extend Cart through additive attributes and explicit versioning without semantic drift.

## Invoice
- Meaning: Canonical enterprise meaning of Invoice within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Invoice decisions, governance, and analytics.
- Owner: Finance (Chief Finance Officer)
- Lifecycle: Issued->Posted->Settled->Closed
- Relationships: Parent=Order; Child=Payment|Ledger Entry; Associated=Commission|Audit Record
- Invariants: Invoice must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Invoice without Order origin
- Future Extension Guidance: Extend Invoice through additive attributes and explicit versioning without semantic drift.

## Payment
- Meaning: Canonical enterprise meaning of Payment within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Payment decisions, governance, and analytics.
- Owner: Finance (Chief Finance Officer)
- Lifecycle: Authorized->Captured->Settled->Reconciled
- Relationships: Parent=Invoice; Child=None; Associated=Order|Ledger Entry|Commission
- Invariants: Payment must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Payment without invoice context
- Future Extension Guidance: Extend Payment through additive attributes and explicit versioning without semantic drift.

## Commission
- Meaning: Canonical enterprise meaning of Commission within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Commission decisions, governance, and analytics.
- Owner: Partner Economics (Chief Partnerships Officer)
- Lifecycle: Defined->Accrued->Approved->Paid
- Relationships: Parent=Order|Campaign; Child=None; Associated=Affiliate|Ledger Entry|Payment
- Invariants: Commission must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Commission without auditable business event
- Future Extension Guidance: Extend Commission through additive attributes and explicit versioning without semantic drift.

## Campaign
- Meaning: Canonical enterprise meaning of Campaign within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Campaign decisions, governance, and analytics.
- Owner: Marketing (Chief Growth Officer)
- Lifecycle: Planned->Active->Completed->Archived
- Relationships: Parent=Business Objective; Child=Promotion|Event; Associated=Content|Executive Metric
- Invariants: Campaign must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Campaign treated as promotion equivalent
- Future Extension Guidance: Extend Campaign through additive attributes and explicit versioning without semantic drift.

## Promotion
- Meaning: Canonical enterprise meaning of Promotion within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Promotion decisions, governance, and analytics.
- Owner: Marketing (Chief Growth Officer)
- Lifecycle: Drafted->Approved->Active->Expired
- Relationships: Parent=Campaign; Child=None; Associated=Cart|Order|Reward
- Invariants: Promotion must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Promotion without campaign authority
- Future Extension Guidance: Extend Promotion through additive attributes and explicit versioning without semantic drift.

## Event
- Meaning: Canonical enterprise meaning of Event within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Event decisions, governance, and analytics.
- Owner: Community and Experience (Chief Community Officer)
- Lifecycle: Planned->Published->Executed->Closed
- Relationships: Parent=Campaign; Child=Experience|Registration; Associated=Community|Notification
- Invariants: Event must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Event treated as immutable product
- Future Extension Guidance: Extend Event through additive attributes and explicit versioning without semantic drift.

## Experience
- Meaning: Canonical enterprise meaning of Experience within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Experience decisions, governance, and analytics.
- Owner: Community and Experience (Chief Experience Officer)
- Lifecycle: Drafted->Live->Iterated->Retired
- Relationships: Parent=Event; Child=Registration|Content; Associated=Customer|Community|Media Asset
- Invariants: Experience must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Experience as identity record
- Future Extension Guidance: Extend Experience through additive attributes and explicit versioning without semantic drift.

## Community
- Meaning: Canonical enterprise meaning of Community within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Community decisions, governance, and analytics.
- Owner: Community and Experience (Chief Community Officer)
- Lifecycle: Seeded->Growing->Mature->Transformed
- Relationships: Parent=None; Child=Event|Content|Notification; Associated=Customer|Collector|Policy
- Invariants: Community must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Community as legal ownership boundary
- Future Extension Guidance: Extend Community through additive attributes and explicit versioning without semantic drift.

## Content
- Meaning: Canonical enterprise meaning of Content within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Content decisions, governance, and analytics.
- Owner: Media and Communication (Chief Experience Officer)
- Lifecycle: Created->Reviewed->Published->Archived
- Relationships: Parent=Document; Child=Media Asset|Notification; Associated=Campaign|Community
- Invariants: Content must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Content conflated with policy authority
- Future Extension Guidance: Extend Content through additive attributes and explicit versioning without semantic drift.

## Media Asset
- Meaning: Canonical enterprise meaning of Media Asset within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Media Asset decisions, governance, and analytics.
- Owner: Media and Communication (Chief Experience Officer)
- Lifecycle: Created->Approved->Published->Retired
- Relationships: Parent=Content; Child=None; Associated=Product|Experience|Campaign
- Invariants: Media Asset must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Media Asset as authoritative product identity
- Future Extension Guidance: Extend Media Asset through additive attributes and explicit versioning without semantic drift.

## QR Asset
- Meaning: Canonical enterprise meaning of QR Asset within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for QR Asset decisions, governance, and analytics.
- Owner: Digital Identity Assets (Chief Trust Officer)
- Lifecycle: Issued->Active->Rotated->Retired
- Relationships: Parent=Digital Twin; Child=None; Associated=Product|Experience|Registration
- Invariants: QR Asset must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: QR Asset resolving multiple authoritative destinations at once
- Future Extension Guidance: Extend QR Asset through additive attributes and explicit versioning without semantic drift.

## Digital Twin
- Meaning: Canonical enterprise meaning of Digital Twin within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Digital Twin decisions, governance, and analytics.
- Owner: Digital Identity Assets (Chief Trust Officer)
- Lifecycle: Provisioned->Active->Updated->Retired
- Relationships: Parent=Product; Child=QR Asset; Associated=Media Asset|Configuration
- Invariants: Digital Twin must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Digital Twin treated as physical inventory unit
- Future Extension Guidance: Extend Digital Twin through additive attributes and explicit versioning without semantic drift.

## Registration
- Meaning: Canonical enterprise meaning of Registration within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Registration decisions, governance, and analytics.
- Owner: Identity and Participation (Chief Trust Officer)
- Lifecycle: Initiated->Verified->Completed->Revoked
- Relationships: Parent=Identity; Child=None; Associated=Event|Passport|Authentication
- Invariants: Registration must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Registration interpreted as Authentication itself
- Future Extension Guidance: Extend Registration through additive attributes and explicit versioning without semantic drift.

## Authentication
- Meaning: Canonical enterprise meaning of Authentication within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Authentication decisions, governance, and analytics.
- Owner: Security (Chief Information Security Officer)
- Lifecycle: Requested->Verified->Granted->Expired
- Relationships: Parent=Identity; Child=None; Associated=Authorization|Registration
- Invariants: Authentication must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Authentication used as entitlement decision
- Future Extension Guidance: Extend Authentication through additive attributes and explicit versioning without semantic drift.

## Authorization
- Meaning: Canonical enterprise meaning of Authorization within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Authorization decisions, governance, and analytics.
- Owner: Security (Chief Information Security Officer)
- Lifecycle: Evaluated->Granted->Adjusted->Revoked
- Relationships: Parent=Authentication; Child=None; Associated=Policy|Task|Workflow
- Invariants: Authorization must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Authorization without policy reference
- Future Extension Guidance: Extend Authorization through additive attributes and explicit versioning without semantic drift.

## Inventory
- Meaning: Canonical enterprise meaning of Inventory within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Inventory decisions, governance, and analytics.
- Owner: Supply Chain (Chief Operations Officer)
- Lifecycle: Recorded->Allocated->Adjusted->Reconciled
- Relationships: Parent=Warehouse; Child=Shipment|Return; Associated=SKU|Order|Store
- Invariants: Inventory must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Inventory modeled without SKU linkage
- Future Extension Guidance: Extend Inventory through additive attributes and explicit versioning without semantic drift.

## Warehouse
- Meaning: Canonical enterprise meaning of Warehouse within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Warehouse decisions, governance, and analytics.
- Owner: Supply Chain (Chief Operations Officer)
- Lifecycle: Planned->Operational->Optimized->Decommissioned
- Relationships: Parent=Region; Child=Inventory|Shipment; Associated=Store|Order|Return
- Invariants: Warehouse must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Warehouse as legal finance ledger
- Future Extension Guidance: Extend Warehouse through additive attributes and explicit versioning without semantic drift.

## Shipment
- Meaning: Canonical enterprise meaning of Shipment within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Shipment decisions, governance, and analytics.
- Owner: Logistics (Chief Operations Officer)
- Lifecycle: Planned->InTransit->Delivered->Closed
- Relationships: Parent=Order; Child=Return|Warranty; Associated=Warehouse|Distributor|Customer
- Invariants: Shipment must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Shipment detached from Order/Inventory lineage
- Future Extension Guidance: Extend Shipment through additive attributes and explicit versioning without semantic drift.

## Return
- Meaning: Canonical enterprise meaning of Return within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Return decisions, governance, and analytics.
- Owner: Support and Assurance (Chief Support Officer)
- Lifecycle: Requested->Approved->Received->Resolved
- Relationships: Parent=Order; Child=Warranty|Support Case; Associated=Inventory|Shipment|Invoice
- Invariants: Return must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Return without original order reference
- Future Extension Guidance: Extend Return through additive attributes and explicit versioning without semantic drift.

## Warranty
- Meaning: Canonical enterprise meaning of Warranty within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Warranty decisions, governance, and analytics.
- Owner: Support and Assurance (Chief Support Officer)
- Lifecycle: Issued->Active->Claimed->Expired
- Relationships: Parent=Product; Child=Support Case; Associated=Return|Manufacturer
- Invariants: Warranty must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Warranty treated as promotion discount
- Future Extension Guidance: Extend Warranty through additive attributes and explicit versioning without semantic drift.

## Support Case
- Meaning: Canonical enterprise meaning of Support Case within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Support Case decisions, governance, and analytics.
- Owner: Support and Assurance (Chief Support Officer)
- Lifecycle: Opened->Triaged->Resolved->Closed
- Relationships: Parent=Customer; Child=Task|Notification; Associated=Order|Warranty|Policy
- Invariants: Support Case must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Support Case as workflow engine artifact
- Future Extension Guidance: Extend Support Case through additive attributes and explicit versioning without semantic drift.

## Notification
- Meaning: Canonical enterprise meaning of Notification within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Notification decisions, governance, and analytics.
- Owner: Communication Operations (Chief Experience Officer)
- Lifecycle: Drafted->Queued->Sent->Archived
- Relationships: Parent=Event|Support Case; Child=None; Associated=Customer|Task|Policy
- Invariants: Notification must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Notification as policy source of truth
- Future Extension Guidance: Extend Notification through additive attributes and explicit versioning without semantic drift.

## Task
- Meaning: Canonical enterprise meaning of Task within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Task decisions, governance, and analytics.
- Owner: Operations Governance (Chief Operations Officer)
- Lifecycle: Created->Assigned->Completed->Archived
- Relationships: Parent=Workflow; Child=None; Associated=Policy|Authorization|Support Case
- Invariants: Task must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Task as legal contract artifact
- Future Extension Guidance: Extend Task through additive attributes and explicit versioning without semantic drift.

## Workflow
- Meaning: Canonical enterprise meaning of Workflow within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Workflow decisions, governance, and analytics.
- Owner: Operations Governance (Chief Operations Officer)
- Lifecycle: Defined->Approved->Active->Retired
- Relationships: Parent=Capability; Child=Task; Associated=Policy|Authorization|Application
- Invariants: Workflow must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Workflow interpreted as runtime implementation spec
- Future Extension Guidance: Extend Workflow through additive attributes and explicit versioning without semantic drift.

## Document
- Meaning: Canonical enterprise meaning of Document within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Document decisions, governance, and analytics.
- Owner: Knowledge Governance (Chief Governance Officer)
- Lifecycle: Drafted->Reviewed->Approved->Archived
- Relationships: Parent=None; Child=Policy|Content|Audit Record; Associated=Task|Workflow
- Invariants: Document must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Document as executable logic source
- Future Extension Guidance: Extend Document through additive attributes and explicit versioning without semantic drift.

## Policy
- Meaning: Canonical enterprise meaning of Policy within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Policy decisions, governance, and analytics.
- Owner: Governance (Chief Governance Officer)
- Lifecycle: Drafted->Ratified->Enforced->Sunset
- Relationships: Parent=Document; Child=Authorization|Audit Record; Associated=Workflow|Configuration|Feature Flag
- Invariants: Policy must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Policy interpreted as optional guidance
- Future Extension Guidance: Extend Policy through additive attributes and explicit versioning without semantic drift.

## Audit Record
- Meaning: Canonical enterprise meaning of Audit Record within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Audit Record decisions, governance, and analytics.
- Owner: Governance (Chief Governance Officer)
- Lifecycle: Captured->Validated->Retained->Archived
- Relationships: Parent=Policy; Child=None; Associated=Ledger Entry|Analytics Event|Document
- Invariants: Audit Record must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Audit Record as mutable event stream
- Future Extension Guidance: Extend Audit Record through additive attributes and explicit versioning without semantic drift.

## Ledger Entry
- Meaning: Canonical enterprise meaning of Ledger Entry within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Ledger Entry decisions, governance, and analytics.
- Owner: Finance (Chief Finance Officer)
- Lifecycle: Created->Posted->Reconciled->Closed
- Relationships: Parent=Invoice|Payment; Child=None; Associated=Commission|Audit Record
- Invariants: Ledger Entry must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Ledger Entry without auditable origin
- Future Extension Guidance: Extend Ledger Entry through additive attributes and explicit versioning without semantic drift.

## Analytics Event
- Meaning: Canonical enterprise meaning of Analytics Event within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Analytics Event decisions, governance, and analytics.
- Owner: Analytics (Chief Data Officer)
- Lifecycle: Emitted->Validated->Aggregated->Archived
- Relationships: Parent=Event; Child=Executive Metric|Operational Metric; Associated=Business Objective|Dashboard
- Invariants: Analytics Event must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Analytics Event as policy authority
- Future Extension Guidance: Extend Analytics Event through additive attributes and explicit versioning without semantic drift.

## Executive Metric
- Meaning: Canonical enterprise meaning of Executive Metric within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Executive Metric decisions, governance, and analytics.
- Owner: Executive Governance (Chief Strategy Officer)
- Lifecycle: Defined->Tracked->Reviewed->Retired
- Relationships: Parent=Business Objective; Child=Executive Dashboard; Associated=Operational Metric|Analytics Event
- Invariants: Executive Metric must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Executive Metric with no objective mapping
- Future Extension Guidance: Extend Executive Metric through additive attributes and explicit versioning without semantic drift.

## Business Objective
- Meaning: Canonical enterprise meaning of Business Objective within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Business Objective decisions, governance, and analytics.
- Owner: Executive Governance (Chief Strategy Officer)
- Lifecycle: Defined->Approved->Active->Closed
- Relationships: Parent=None; Child=Executive Metric|Capability; Associated=Application|Campaign
- Invariants: Business Objective must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Objective without accountable owner
- Future Extension Guidance: Extend Business Objective through additive attributes and explicit versioning without semantic drift.

## Capability
- Meaning: Canonical enterprise meaning of Capability within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Capability decisions, governance, and analytics.
- Owner: Enterprise Architecture (Chief Architecture Officer)
- Lifecycle: Defined->Mapped->Enabled->Retired
- Relationships: Parent=Business Objective; Child=Application|Shared Service; Associated=Workflow|Operational Metric
- Invariants: Capability must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Capability treated as deployed system
- Future Extension Guidance: Extend Capability through additive attributes and explicit versioning without semantic drift.

## Application
- Meaning: Canonical enterprise meaning of Application within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Application decisions, governance, and analytics.
- Owner: Enterprise Architecture (Chief Architecture Officer)
- Lifecycle: Planned->Approved->Active->Retired
- Relationships: Parent=Capability; Child=None; Associated=Shared Service|Configuration|Feature Flag
- Invariants: Application must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Application as semantic authority root
- Future Extension Guidance: Extend Application through additive attributes and explicit versioning without semantic drift.

## Shared Service
- Meaning: Canonical enterprise meaning of Shared Service within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Shared Service decisions, governance, and analytics.
- Owner: Enterprise Architecture (Chief Architecture Officer)
- Lifecycle: Defined->Provided->Versioned->Retired
- Relationships: Parent=Application; Child=None; Associated=AI Agent|Search Index|Recommendation
- Invariants: Shared Service must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Shared Service as domain owner replacement
- Future Extension Guidance: Extend Shared Service through additive attributes and explicit versioning without semantic drift.

## AI Agent
- Meaning: Canonical enterprise meaning of AI Agent within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for AI Agent decisions, governance, and analytics.
- Owner: AI Governance (Chief AI Officer)
- Lifecycle: Declared->Approved->Active->Sunset
- Relationships: Parent=Application; Child=Recommendation|Task; Associated=Policy|Analytics Event|Search Index
- Invariants: AI Agent must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: AI Agent as semantic authority rewriter
- Future Extension Guidance: Extend AI Agent through additive attributes and explicit versioning without semantic drift.

## Recommendation
- Meaning: Canonical enterprise meaning of Recommendation within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Recommendation decisions, governance, and analytics.
- Owner: AI Governance (Chief AI Officer)
- Lifecycle: Generated->Ranked->Delivered->Expired
- Relationships: Parent=AI Agent; Child=None; Associated=Search Index|Campaign|Product
- Invariants: Recommendation must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Recommendation as binding business rule
- Future Extension Guidance: Extend Recommendation through additive attributes and explicit versioning without semantic drift.

## Search Index
- Meaning: Canonical enterprise meaning of Search Index within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Search Index decisions, governance, and analytics.
- Owner: Information Retrieval (Chief Data Officer)
- Lifecycle: Built->Published->Refreshed->Retired
- Relationships: Parent=Shared Service; Child=None; Associated=Recommendation|Content|Product
- Invariants: Search Index must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Search Index as authoritative source of truth
- Future Extension Guidance: Extend Search Index through additive attributes and explicit versioning without semantic drift.

## Configuration
- Meaning: Canonical enterprise meaning of Configuration within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Configuration decisions, governance, and analytics.
- Owner: Technology Governance (Chief Technology Officer)
- Lifecycle: Defined->Approved->Applied->Deprecated
- Relationships: Parent=Application; Child=Feature Flag; Associated=Policy|Workflow|Shared Service
- Invariants: Configuration must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Configuration overriding policy authority
- Future Extension Guidance: Extend Configuration through additive attributes and explicit versioning without semantic drift.

## Feature Flag
- Meaning: Canonical enterprise meaning of Feature Flag within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Feature Flag decisions, governance, and analytics.
- Owner: Technology Governance (Chief Technology Officer)
- Lifecycle: Created->Enabled->Evaluated->Retired
- Relationships: Parent=Configuration; Child=None; Associated=Application|Operational Metric
- Invariants: Feature Flag must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Feature Flag as governance bypass
- Future Extension Guidance: Extend Feature Flag through additive attributes and explicit versioning without semantic drift.

## System Health
- Meaning: Canonical enterprise meaning of System Health within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for System Health decisions, governance, and analytics.
- Owner: Technology Operations (Chief Technology Officer)
- Lifecycle: Observed->Assessed->Stabilized->Archived
- Relationships: Parent=Operational Metric; Child=None; Associated=Application|Shared Service|Dashboard
- Invariants: System Health must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: System Health as executive objective authority
- Future Extension Guidance: Extend System Health through additive attributes and explicit versioning without semantic drift.

## Operational Metric
- Meaning: Canonical enterprise meaning of Operational Metric within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Operational Metric decisions, governance, and analytics.
- Owner: Technology Operations (Chief Technology Officer)
- Lifecycle: Defined->Tracked->Reviewed->Retired
- Relationships: Parent=Analytics Event; Child=System Health|Executive Dashboard; Associated=Capability|Application
- Invariants: Operational Metric must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Operational Metric replacing executive metric
- Future Extension Guidance: Extend Operational Metric through additive attributes and explicit versioning without semantic drift.

## Executive Dashboard
- Meaning: Canonical enterprise meaning of Executive Dashboard within STONER semantic authority.
- Business Purpose: Establishes consistent enterprise interpretation for Executive Dashboard decisions, governance, and analytics.
- Owner: Executive Governance (Chief Strategy Officer)
- Lifecycle: Designed->Published->Reviewed->Retired
- Relationships: Parent=Executive Metric; Child=None; Associated=Operational Metric|Business Objective
- Invariants: Executive Dashboard must remain traceable to its canonical owner and semantic identity lineage.
- Prohibited Interpretations: Dashboard as source semantic authority
- Future Extension Guidance: Extend Executive Dashboard through additive attributes and explicit versioning without semantic drift.
