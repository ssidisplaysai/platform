# Business Genome Domain Map

Program: BGP-0001  
Status: FOUNDATION

## Domain to Object Mapping
1. Organization: Company, Business Unit, Department, Division, Location, Facility, Warehouse
2. Manufacturing: Machine, Production Line, Work Cell
3. Inventory and Supply: Inventory Item, Material, Component, Assembly, Bill of Materials, Supplier, Vendor
4. Customer and Commercial: Customer, Contact, Account, Opportunity, Project, Contract, Quote, Order, Invoice Reference
5. Product: Product, Product Family, Configuration, SKU, Variant, Accessory, Warranty, Service
6. Knowledge: Document, Drawing, Specification, Procedure, Policy, Standard, Training, Knowledge Article
7. Evidence: Evidence Source, Evidence Record, Evidence Collection, Evidence Chain, Evidence Version
8. People: Employee, Role, Skill, Certification, Team
9. Marketing: Brand, Campaign, Audience, Asset, Channel, Content, SEO Entity
10. Operations: Workflow, Process, Task, Approval, Event, Decision
11. Risk and Compliance: Risk, Compliance Requirement, Regulation, Audit, Finding, Corrective Action
12. Technology: Application, API, Integration, Database, Infrastructure Asset, Security Policy
13. Enterprise Metrics: KPI, Objective, Measurement, Scorecard

## Cross-Domain Relationship Highlights
1. Organization owns Manufacturing and Inventory objects.
2. Product depends_on Inventory and Supplier objects.
3. Operations references Knowledge and Compliance objects.
4. Metrics measures outcomes of Marketing, Operations, and Manufacturing.
5. Technology supports_by all operational domains.

## Domain Statistics
1. Domains: 13
2. Canonical object types mapped: 78
