import { createHash } from "crypto";

export const ENTERPRISE_AGENTS = [
  "Executive",
  "Operations",
  "Manufacturing",
  "Marketing",
  "Sales",
  "Finance",
  "Customer Success",
  "Human Resources",
] as const;

export type EnterpriseAgent = (typeof ENTERPRISE_AGENTS)[number];

export const ENTERPRISE_LIFECYCLE_PRESETS = {
  masterData: {
    initialState: "Draft",
    states: {
      Draft: ["Active", "Archived"],
      Active: ["Suspended", "Archived"],
      Suspended: ["Active", "Archived"],
      Archived: [],
    },
  },
  transactional: {
    initialState: "Draft",
    states: {
      Draft: ["Active", "Cancelled", "Archived"],
      Active: ["Closed", "On Hold", "Archived"],
      "On Hold": ["Active", "Archived"],
      Closed: ["Archived"],
      Cancelled: ["Archived"],
      Archived: [],
    },
  },
  operational: {
    initialState: "Draft",
    states: {
      Draft: ["Scheduled", "Archived"],
      Scheduled: ["Active", "Cancelled", "Archived"],
      Active: ["Paused", "Completed", "On Hold"],
      Paused: ["Active", "Cancelled", "Archived"],
      "On Hold": ["Active", "Cancelled", "Archived"],
      Completed: ["Archived"],
      Cancelled: ["Archived"],
      Archived: [],
    },
  },
  artifact: {
    initialState: "Draft",
    states: {
      Draft: ["Reviewed", "Active", "Archived"],
      Reviewed: ["Approved", "Rejected", "Archived"],
      Approved: ["Active", "Archived"],
      Rejected: ["Draft", "Archived"],
      Active: ["Archived"],
      Archived: [],
    },
  },
  decision: {
    initialState: "Proposed",
    states: {
      Proposed: ["Reviewed", "Rejected", "Archived"],
      Reviewed: ["Approved", "Rejected", "Archived"],
      Approved: ["Active", "Archived"],
      Rejected: ["Archived"],
      Active: ["Archived"],
      Archived: [],
    },
  },
  event: {
    initialState: "Pending",
    states: {
      Pending: ["Emitted", "Archived"],
      Emitted: ["Consumed", "Archived"],
      Consumed: ["Archived"],
      Archived: [],
    },
  },
  measurement: {
    initialState: "Draft",
    states: {
      Draft: ["Active", "Archived"],
      Active: ["Superseded", "Archived"],
      Superseded: ["Archived"],
      Archived: [],
    },
  },
} as const;

export type EnterpriseLifecyclePresetKey = keyof typeof ENTERPRISE_LIFECYCLE_PRESETS;

export const ENTERPRISE_AUTHORIZATION_BOUNDARIES = [
  "enterprise",
  "commercial",
  "operations",
  "finance",
  "people",
  "records",
  "governance",
  "logistics",
  "asset",
  "manufacturing",
  "sales",
  "customer",
  "supplier",
] as const;

export type EnterpriseAuthorizationBoundary = (typeof ENTERPRISE_AUTHORIZATION_BOUNDARIES)[number];

function enterpriseEntitySpec<T extends {
  readonly entityKey: string;
  readonly entityCode: string;
  readonly displayName: string;
  readonly pluralName: string;
  readonly description: string;
  readonly stewardshipArea: string;
  readonly lifecyclePreset: EnterpriseLifecyclePresetKey;
  readonly authorizationBoundary: EnterpriseAuthorizationBoundary;
  readonly relationshipKeys: readonly string[];
  readonly consumerAgents: readonly EnterpriseAgent[];
}>(value: T): T {
  return value;
}

function enterpriseRelationshipSpec<T extends {
  readonly relationshipKey: string;
  readonly sourceEntityKey: string;
  readonly targetEntityKey: string;
  readonly relationshipType: string;
  readonly cardinality: string;
  readonly description: string;
  readonly authorizationBoundary: EnterpriseAuthorizationBoundary;
}>(value: T): T {
  return value;
}

export const ENTERPRISE_ENTITY_SPECS = [
  enterpriseEntitySpec({ entityKey: "organization", entityCode: "ORG", displayName: "Organization", pluralName: "Organizations", description: "Canonical enterprise organization root.", stewardshipArea: "enterprise_governance", lifecyclePreset: "masterData", authorizationBoundary: "enterprise", relationshipKeys: ["organization-business-units", "organization-facilities", "organization-departments", "organization-customers", "organization-vendors", "organization-projects"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "business_unit", entityCode: "BU", displayName: "Business Unit", pluralName: "Business Units", description: "Canonical business unit within an organization.", stewardshipArea: "enterprise_governance", lifecyclePreset: "masterData", authorizationBoundary: "enterprise", relationshipKeys: ["organization-business-units", "business-unit-departments", "business-unit-employees"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "facility", entityCode: "FAC", displayName: "Facility", pluralName: "Facilities", description: "Canonical physical location used by the enterprise.", stewardshipArea: "operations", lifecyclePreset: "masterData", authorizationBoundary: "operations", relationshipKeys: ["organization-facilities", "facility-warehouse", "facility-machine"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "department", entityCode: "DPT", displayName: "Department", pluralName: "Departments", description: "Canonical organizational department.", stewardshipArea: "enterprise_governance", lifecyclePreset: "masterData", authorizationBoundary: "enterprise", relationshipKeys: ["organization-departments", "business-unit-departments", "department-employees"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "employee", entityCode: "EMP", displayName: "Employee", pluralName: "Employees", description: "Canonical employee record shared by the enterprise.", stewardshipArea: "people", lifecyclePreset: "masterData", authorizationBoundary: "people", relationshipKeys: ["business-unit-employees", "department-employees", "employee-roles", "task-employee"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "role", entityCode: "ROL", displayName: "Role", pluralName: "Roles", description: "Canonical role definition used for enterprise authorization and staffing.", stewardshipArea: "enterprise_governance", lifecyclePreset: "masterData", authorizationBoundary: "governance", relationshipKeys: ["employee-roles"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "customer", entityCode: "CUS", displayName: "Customer", pluralName: "Customers", description: "Canonical customer entity shared across agents and applications.", stewardshipArea: "customer_relationship", lifecyclePreset: "masterData", authorizationBoundary: "customer", relationshipKeys: ["organization-customers", "customer-contacts", "customer-opportunities", "customer-quotes", "customer-sales-orders", "subscription-customer"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "contact", entityCode: "CON", displayName: "Contact", pluralName: "Contacts", description: "Canonical contact record for customers and vendors.", stewardshipArea: "customer_relationship", lifecyclePreset: "masterData", authorizationBoundary: "customer", relationshipKeys: ["customer-contacts", "vendor-contacts"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "vendor", entityCode: "VEN", displayName: "Vendor", pluralName: "Vendors", description: "Canonical vendor record used by procurement and operations.", stewardshipArea: "procurement", lifecyclePreset: "masterData", authorizationBoundary: "supplier", relationshipKeys: ["organization-vendors", "vendor-contacts", "vendor-purchase-orders"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "supplier", entityCode: "SUP", displayName: "Supplier", pluralName: "Suppliers", description: "Canonical supplier entity used for purchasing and sourcing.", stewardshipArea: "procurement", lifecyclePreset: "masterData", authorizationBoundary: "supplier", relationshipKeys: ["vendor-suppliers", "supplier-purchase-orders"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "product", entityCode: "PRD", displayName: "Product", pluralName: "Products", description: "Canonical product definition used across sales, operations, and finance.", stewardshipArea: "product_management", lifecyclePreset: "masterData", authorizationBoundary: "commercial", relationshipKeys: ["product-family-products", "product-quotes", "product-sales-orders", "product-inventory-items"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "product_family", entityCode: "PFM", displayName: "Product Family", pluralName: "Product Families", description: "Canonical product family grouping for products and reporting.", stewardshipArea: "product_management", lifecyclePreset: "masterData", authorizationBoundary: "commercial", relationshipKeys: ["product-family-products"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "service", entityCode: "SRV", displayName: "Service", pluralName: "Services", description: "Canonical service definition used for quoting and project execution.", stewardshipArea: "service_management", lifecyclePreset: "masterData", authorizationBoundary: "commercial", relationshipKeys: ["service-projects"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "project", entityCode: "PRJ", displayName: "Project", pluralName: "Projects", description: "Canonical project record shared by enterprise applications.", stewardshipArea: "project_management", lifecyclePreset: "transactional", authorizationBoundary: "enterprise", relationshipKeys: ["organization-projects", "project-quotes", "project-work-orders", "project-manufacturing-orders", "project-documents", "project-shipment"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "opportunity", entityCode: "OPP", displayName: "Opportunity", pluralName: "Opportunities", description: "Canonical sales opportunity record.", stewardshipArea: "sales", lifecyclePreset: "decision", authorizationBoundary: "sales", relationshipKeys: ["customer-opportunities", "opportunity-quotes"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "quote", entityCode: "QTE", displayName: "Quote", pluralName: "Quotes", description: "Canonical sales quote record.", stewardshipArea: "sales", lifecyclePreset: "transactional", authorizationBoundary: "sales", relationshipKeys: ["customer-quotes", "product-quotes", "opportunity-quotes", "quote-sales-orders", "project-quotes"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "sales_order", entityCode: "SO", displayName: "Sales Order", pluralName: "Sales Orders", description: "Canonical sales order record.", stewardshipArea: "sales_fulfillment", lifecyclePreset: "transactional", authorizationBoundary: "sales", relationshipKeys: ["customer-sales-orders", "quote-sales-orders", "sales-order-shipments"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "purchase_order", entityCode: "PO", displayName: "Purchase Order", pluralName: "Purchase Orders", description: "Canonical purchase order record.", stewardshipArea: "procurement", lifecyclePreset: "transactional", authorizationBoundary: "supplier", relationshipKeys: ["vendor-purchase-orders", "supplier-purchase-orders", "purchase-order-shipments"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "work_order", entityCode: "WO", displayName: "Work Order", pluralName: "Work Orders", description: "Canonical work order record for operational execution.", stewardshipArea: "operations", lifecyclePreset: "operational", authorizationBoundary: "operations", relationshipKeys: ["project-work-orders", "work-order-machine", "work-order-asset", "task-work-order"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "manufacturing_order", entityCode: "MO", displayName: "Manufacturing Order", pluralName: "Manufacturing Orders", description: "Canonical manufacturing order record.", stewardshipArea: "manufacturing", lifecyclePreset: "operational", authorizationBoundary: "manufacturing", relationshipKeys: ["project-manufacturing-orders", "manufacturing-order-machine", "manufacturing-order-inventory-item"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "inventory_item", entityCode: "INV", displayName: "Inventory Item", pluralName: "Inventory Items", description: "Canonical inventory item record.", stewardshipArea: "supply_chain", lifecyclePreset: "masterData", authorizationBoundary: "logistics", relationshipKeys: ["product-inventory-items", "manufacturing-order-inventory-item", "inventory-item-warehouse"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "warehouse", entityCode: "WH", displayName: "Warehouse", pluralName: "Warehouses", description: "Canonical warehouse record.", stewardshipArea: "supply_chain", lifecyclePreset: "masterData", authorizationBoundary: "logistics", relationshipKeys: ["facility-warehouse", "inventory-item-warehouse"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "asset", entityCode: "AST", displayName: "Asset", pluralName: "Assets", description: "Canonical enterprise asset record.", stewardshipArea: "asset_management", lifecyclePreset: "masterData", authorizationBoundary: "asset", relationshipKeys: ["project-assets", "work-order-asset", "asset-machine", "asset-vehicle"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "machine", entityCode: "MAC", displayName: "Machine", pluralName: "Machines", description: "Canonical production or operational machine record.", stewardshipArea: "operations", lifecyclePreset: "masterData", authorizationBoundary: "operations", relationshipKeys: ["facility-machine", "work-order-machine", "manufacturing-order-machine", "asset-machine"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "vehicle", entityCode: "VEH", displayName: "Vehicle", pluralName: "Vehicles", description: "Canonical fleet vehicle record.", stewardshipArea: "logistics", lifecyclePreset: "masterData", authorizationBoundary: "logistics", relationshipKeys: ["asset-vehicle", "vehicle-shipment"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "shipment", entityCode: "SHP", displayName: "Shipment", pluralName: "Shipments", description: "Canonical shipment record.", stewardshipArea: "logistics", lifecyclePreset: "transactional", authorizationBoundary: "logistics", relationshipKeys: ["sales-order-shipments", "purchase-order-shipments", "vehicle-shipment"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "invoice", entityCode: "INVX", displayName: "Invoice", pluralName: "Invoices", description: "Canonical invoice record.", stewardshipArea: "finance", lifecyclePreset: "transactional", authorizationBoundary: "finance", relationshipKeys: ["invoice-payment", "payment-invoice"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "payment", entityCode: "PAY", displayName: "Payment", pluralName: "Payments", description: "Canonical payment record.", stewardshipArea: "finance", lifecyclePreset: "transactional", authorizationBoundary: "finance", relationshipKeys: ["invoice-payment", "payment-invoice"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "contract", entityCode: "CTR", displayName: "Contract", pluralName: "Contracts", description: "Canonical contract record.", stewardshipArea: "legal", lifecyclePreset: "artifact", authorizationBoundary: "governance", relationshipKeys: ["contract-subscription"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "subscription", entityCode: "SUB", displayName: "Subscription", pluralName: "Subscriptions", description: "Canonical subscription record.", stewardshipArea: "finance", lifecyclePreset: "transactional", authorizationBoundary: "finance", relationshipKeys: ["subscription-customer", "contract-subscription"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "document", entityCode: "DOC", displayName: "Document", pluralName: "Documents", description: "Canonical document and record artifact.", stewardshipArea: "records_management", lifecyclePreset: "artifact", authorizationBoundary: "records", relationshipKeys: ["project-documents", "document-work-order", "knowledge-artifact-document"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "knowledge_artifact", entityCode: "KAR", displayName: "Knowledge Artifact", pluralName: "Knowledge Artifacts", description: "Canonical knowledge record used by the enterprise knowledge graph.", stewardshipArea: "knowledge_management", lifecyclePreset: "artifact", authorizationBoundary: "records", relationshipKeys: ["knowledge-artifact-document"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "kpi", entityCode: "KPI", displayName: "KPI", pluralName: "KPIs", description: "Canonical KPI record.", stewardshipArea: "performance_management", lifecyclePreset: "measurement", authorizationBoundary: "governance", relationshipKeys: ["kpi-goal"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "goal", entityCode: "GOL", displayName: "Goal", pluralName: "Goals", description: "Canonical enterprise goal record.", stewardshipArea: "performance_management", lifecyclePreset: "decision", authorizationBoundary: "governance", relationshipKeys: ["kpi-goal"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "recommendation", entityCode: "REC", displayName: "Recommendation", pluralName: "Recommendations", description: "Canonical recommendation record.", stewardshipArea: "decision_intelligence", lifecyclePreset: "decision", authorizationBoundary: "governance", relationshipKeys: ["recommendation-risk", "recommendation-approval"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "risk", entityCode: "RSK", displayName: "Risk", pluralName: "Risks", description: "Canonical enterprise risk record.", stewardshipArea: "risk_management", lifecyclePreset: "decision", authorizationBoundary: "governance", relationshipKeys: ["recommendation-risk"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "approval", entityCode: "APR", displayName: "Approval", pluralName: "Approvals", description: "Canonical approval record.", stewardshipArea: "governance", lifecyclePreset: "decision", authorizationBoundary: "governance", relationshipKeys: ["recommendation-approval", "approval-task"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "task", entityCode: "TSK", displayName: "Task", pluralName: "Tasks", description: "Canonical task record.", stewardshipArea: "work_management", lifecyclePreset: "operational", authorizationBoundary: "enterprise", relationshipKeys: ["task-employee", "task-work-order", "event-task", "approval-task"], consumerAgents: ENTERPRISE_AGENTS }),
  enterpriseEntitySpec({ entityKey: "event", entityCode: "EVT", displayName: "Event", pluralName: "Events", description: "Canonical event record emitted across the enterprise graph.", stewardshipArea: "event_management", lifecyclePreset: "event", authorizationBoundary: "enterprise", relationshipKeys: ["event-task"], consumerAgents: ENTERPRISE_AGENTS }),
] as const;

export const ENTERPRISE_RELATIONSHIP_SPECS = [
  enterpriseRelationshipSpec({ relationshipKey: "organization-business-units", sourceEntityKey: "organization", targetEntityKey: "business_unit", relationshipType: "owns", cardinality: "one-to-many", description: "Organizations own business units.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "organization-facilities", sourceEntityKey: "organization", targetEntityKey: "facility", relationshipType: "owns", cardinality: "one-to-many", description: "Organizations own facilities.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "organization-departments", sourceEntityKey: "organization", targetEntityKey: "department", relationshipType: "owns", cardinality: "one-to-many", description: "Organizations own departments.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "organization-customers", sourceEntityKey: "organization", targetEntityKey: "customer", relationshipType: "serves", cardinality: "one-to-many", description: "Organizations serve customers.", authorizationBoundary: "customer" }),
  enterpriseRelationshipSpec({ relationshipKey: "organization-vendors", sourceEntityKey: "organization", targetEntityKey: "vendor", relationshipType: "engages", cardinality: "one-to-many", description: "Organizations engage vendors.", authorizationBoundary: "supplier" }),
  enterpriseRelationshipSpec({ relationshipKey: "organization-projects", sourceEntityKey: "organization", targetEntityKey: "project", relationshipType: "owns", cardinality: "one-to-many", description: "Organizations own projects.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "business-unit-departments", sourceEntityKey: "business_unit", targetEntityKey: "department", relationshipType: "contains", cardinality: "one-to-many", description: "Business units contain departments.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "business-unit-employees", sourceEntityKey: "business_unit", targetEntityKey: "employee", relationshipType: "assigns", cardinality: "one-to-many", description: "Business units assign employees.", authorizationBoundary: "people" }),
  enterpriseRelationshipSpec({ relationshipKey: "facility-warehouse", sourceEntityKey: "facility", targetEntityKey: "warehouse", relationshipType: "hosts", cardinality: "one-to-many", description: "Facilities host warehouses.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "facility-machine", sourceEntityKey: "facility", targetEntityKey: "machine", relationshipType: "hosts", cardinality: "one-to-many", description: "Facilities host machines.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "department-employees", sourceEntityKey: "department", targetEntityKey: "employee", relationshipType: "contains", cardinality: "one-to-many", description: "Departments contain employees.", authorizationBoundary: "people" }),
  enterpriseRelationshipSpec({ relationshipKey: "employee-roles", sourceEntityKey: "employee", targetEntityKey: "role", relationshipType: "holds", cardinality: "many-to-many", description: "Employees hold roles.", authorizationBoundary: "governance" }),
  enterpriseRelationshipSpec({ relationshipKey: "customer-contacts", sourceEntityKey: "customer", targetEntityKey: "contact", relationshipType: "has", cardinality: "one-to-many", description: "Customers have contacts.", authorizationBoundary: "customer" }),
  enterpriseRelationshipSpec({ relationshipKey: "customer-opportunities", sourceEntityKey: "customer", targetEntityKey: "opportunity", relationshipType: "generates", cardinality: "one-to-many", description: "Customers generate opportunities.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "customer-quotes", sourceEntityKey: "customer", targetEntityKey: "quote", relationshipType: "receives", cardinality: "one-to-many", description: "Customers receive quotes.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "customer-sales-orders", sourceEntityKey: "customer", targetEntityKey: "sales_order", relationshipType: "places", cardinality: "one-to-many", description: "Customers place sales orders.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "vendor-contacts", sourceEntityKey: "vendor", targetEntityKey: "contact", relationshipType: "has", cardinality: "one-to-many", description: "Vendors have contacts.", authorizationBoundary: "supplier" }),
  enterpriseRelationshipSpec({ relationshipKey: "vendor-purchase-orders", sourceEntityKey: "vendor", targetEntityKey: "purchase_order", relationshipType: "receives", cardinality: "one-to-many", description: "Vendors receive purchase orders.", authorizationBoundary: "supplier" }),
  enterpriseRelationshipSpec({ relationshipKey: "vendor-suppliers", sourceEntityKey: "vendor", targetEntityKey: "supplier", relationshipType: "represents", cardinality: "one-to-one", description: "Vendors may represent suppliers.", authorizationBoundary: "supplier" }),
  enterpriseRelationshipSpec({ relationshipKey: "supplier-purchase-orders", sourceEntityKey: "supplier", targetEntityKey: "purchase_order", relationshipType: "fulfills", cardinality: "one-to-many", description: "Suppliers fulfill purchase orders.", authorizationBoundary: "supplier" }),
  enterpriseRelationshipSpec({ relationshipKey: "product-family-products", sourceEntityKey: "product_family", targetEntityKey: "product", relationshipType: "groups", cardinality: "one-to-many", description: "Product families group products.", authorizationBoundary: "commercial" }),
  enterpriseRelationshipSpec({ relationshipKey: "product-quotes", sourceEntityKey: "product", targetEntityKey: "quote", relationshipType: "appears_on", cardinality: "many-to-many", description: "Products appear on quotes.", authorizationBoundary: "commercial" }),
  enterpriseRelationshipSpec({ relationshipKey: "product-sales-orders", sourceEntityKey: "product", targetEntityKey: "sales_order", relationshipType: "appears_on", cardinality: "many-to-many", description: "Products appear on sales orders.", authorizationBoundary: "commercial" }),
  enterpriseRelationshipSpec({ relationshipKey: "product-inventory-items", sourceEntityKey: "product", targetEntityKey: "inventory_item", relationshipType: "maps_to", cardinality: "one-to-many", description: "Products map to inventory items.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "service-projects", sourceEntityKey: "service", targetEntityKey: "project", relationshipType: "supports", cardinality: "one-to-many", description: "Services support projects.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-quotes", sourceEntityKey: "project", targetEntityKey: "quote", relationshipType: "originates", cardinality: "one-to-many", description: "Projects originate quotes.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-work-orders", sourceEntityKey: "project", targetEntityKey: "work_order", relationshipType: "contains", cardinality: "one-to-many", description: "Projects contain work orders.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-manufacturing-orders", sourceEntityKey: "project", targetEntityKey: "manufacturing_order", relationshipType: "contains", cardinality: "one-to-many", description: "Projects contain manufacturing orders.", authorizationBoundary: "manufacturing" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-documents", sourceEntityKey: "project", targetEntityKey: "document", relationshipType: "contains", cardinality: "one-to-many", description: "Projects contain documents.", authorizationBoundary: "records" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-assets", sourceEntityKey: "project", targetEntityKey: "asset", relationshipType: "assigns", cardinality: "one-to-many", description: "Projects assign assets.", authorizationBoundary: "asset" }),
  enterpriseRelationshipSpec({ relationshipKey: "project-shipment", sourceEntityKey: "project", targetEntityKey: "shipment", relationshipType: "references", cardinality: "one-to-many", description: "Projects reference shipments.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "opportunity-quotes", sourceEntityKey: "opportunity", targetEntityKey: "quote", relationshipType: "produces", cardinality: "one-to-many", description: "Opportunities produce quotes.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "quote-sales-orders", sourceEntityKey: "quote", targetEntityKey: "sales_order", relationshipType: "converts_to", cardinality: "one-to-many", description: "Quotes convert to sales orders.", authorizationBoundary: "sales" }),
  enterpriseRelationshipSpec({ relationshipKey: "sales-order-shipments", sourceEntityKey: "sales_order", targetEntityKey: "shipment", relationshipType: "fulfills_with", cardinality: "one-to-many", description: "Sales orders fulfill with shipments.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "purchase-order-shipments", sourceEntityKey: "purchase_order", targetEntityKey: "shipment", relationshipType: "receives", cardinality: "one-to-many", description: "Purchase orders receive shipments.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "work-order-machine", sourceEntityKey: "work_order", targetEntityKey: "machine", relationshipType: "assigned_to", cardinality: "many-to-one", description: "Work orders are assigned to machines.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "work-order-asset", sourceEntityKey: "work_order", targetEntityKey: "asset", relationshipType: "assigned_to", cardinality: "many-to-one", description: "Work orders are assigned to assets.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "manufacturing-order-machine", sourceEntityKey: "manufacturing_order", targetEntityKey: "machine", relationshipType: "scheduled_on", cardinality: "many-to-one", description: "Manufacturing orders are scheduled on machines.", authorizationBoundary: "manufacturing" }),
  enterpriseRelationshipSpec({ relationshipKey: "manufacturing-order-inventory-item", sourceEntityKey: "manufacturing_order", targetEntityKey: "inventory_item", relationshipType: "consumes", cardinality: "many-to-many", description: "Manufacturing orders consume inventory items.", authorizationBoundary: "manufacturing" }),
  enterpriseRelationshipSpec({ relationshipKey: "inventory-item-warehouse", sourceEntityKey: "inventory_item", targetEntityKey: "warehouse", relationshipType: "stored_in", cardinality: "many-to-one", description: "Inventory items are stored in warehouses.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "asset-machine", sourceEntityKey: "asset", targetEntityKey: "machine", relationshipType: "represents", cardinality: "one-to-many", description: "Assets may represent machines.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "asset-vehicle", sourceEntityKey: "asset", targetEntityKey: "vehicle", relationshipType: "represents", cardinality: "one-to-many", description: "Assets may represent vehicles.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "vehicle-shipment", sourceEntityKey: "vehicle", targetEntityKey: "shipment", relationshipType: "moves", cardinality: "one-to-many", description: "Vehicles move shipments.", authorizationBoundary: "logistics" }),
  enterpriseRelationshipSpec({ relationshipKey: "invoice-payment", sourceEntityKey: "invoice", targetEntityKey: "payment", relationshipType: "settled_by", cardinality: "one-to-many", description: "Invoices are settled by payments.", authorizationBoundary: "finance" }),
  enterpriseRelationshipSpec({ relationshipKey: "payment-invoice", sourceEntityKey: "payment", targetEntityKey: "invoice", relationshipType: "settles", cardinality: "many-to-one", description: "Payments settle invoices.", authorizationBoundary: "finance" }),
  enterpriseRelationshipSpec({ relationshipKey: "contract-subscription", sourceEntityKey: "contract", targetEntityKey: "subscription", relationshipType: "governs", cardinality: "one-to-many", description: "Contracts govern subscriptions.", authorizationBoundary: "finance" }),
  enterpriseRelationshipSpec({ relationshipKey: "subscription-customer", sourceEntityKey: "subscription", targetEntityKey: "customer", relationshipType: "serves", cardinality: "many-to-one", description: "Subscriptions serve customers.", authorizationBoundary: "customer" }),
  enterpriseRelationshipSpec({ relationshipKey: "document-work-order", sourceEntityKey: "document", targetEntityKey: "work_order", relationshipType: "documents", cardinality: "one-to-many", description: "Documents support work orders.", authorizationBoundary: "records" }),
  enterpriseRelationshipSpec({ relationshipKey: "knowledge-artifact-document", sourceEntityKey: "knowledge_artifact", targetEntityKey: "document", relationshipType: "derived_from", cardinality: "one-to-many", description: "Knowledge artifacts derive from documents.", authorizationBoundary: "records" }),
  enterpriseRelationshipSpec({ relationshipKey: "kpi-goal", sourceEntityKey: "kpi", targetEntityKey: "goal", relationshipType: "measures", cardinality: "many-to-one", description: "KPIs measure goals.", authorizationBoundary: "governance" }),
  enterpriseRelationshipSpec({ relationshipKey: "recommendation-risk", sourceEntityKey: "recommendation", targetEntityKey: "risk", relationshipType: "mitigates", cardinality: "many-to-many", description: "Recommendations mitigate risks.", authorizationBoundary: "governance" }),
  enterpriseRelationshipSpec({ relationshipKey: "recommendation-approval", sourceEntityKey: "recommendation", targetEntityKey: "approval", relationshipType: "requires", cardinality: "many-to-many", description: "Recommendations require approvals.", authorizationBoundary: "governance" }),
  enterpriseRelationshipSpec({ relationshipKey: "task-employee", sourceEntityKey: "task", targetEntityKey: "employee", relationshipType: "assigned_to", cardinality: "many-to-one", description: "Tasks are assigned to employees.", authorizationBoundary: "people" }),
  enterpriseRelationshipSpec({ relationshipKey: "task-work-order", sourceEntityKey: "task", targetEntityKey: "work_order", relationshipType: "supports", cardinality: "many-to-one", description: "Tasks support work orders.", authorizationBoundary: "operations" }),
  enterpriseRelationshipSpec({ relationshipKey: "event-task", sourceEntityKey: "event", targetEntityKey: "task", relationshipType: "triggers", cardinality: "many-to-one", description: "Events trigger tasks.", authorizationBoundary: "enterprise" }),
  enterpriseRelationshipSpec({ relationshipKey: "approval-task", sourceEntityKey: "approval", targetEntityKey: "task", relationshipType: "authorizes", cardinality: "many-to-one", description: "Approvals authorize tasks.", authorizationBoundary: "governance" }),
] as const;

export type EnterpriseEntitySpec = (typeof ENTERPRISE_ENTITY_SPECS)[number];
export type EnterpriseRelationshipSpec = (typeof ENTERPRISE_RELATIONSHIP_SPECS)[number];
export type EnterpriseEntityKey = EnterpriseEntitySpec["entityKey"];
export type EnterpriseRelationshipKey = EnterpriseRelationshipSpec["relationshipKey"];

export interface EnterpriseLifecycleState {
  readonly state: string;
  readonly transitions: readonly string[];
}

export interface EnterpriseLifecycleDefinition {
  readonly initialState: string;
  readonly states: Readonly<Record<string, readonly string[]>>;
}

export interface EnterpriseEntityDefinition {
  readonly enterpriseEntityId: string;
  readonly entityKey: EnterpriseEntityKey;
  readonly entityCode: string;
  readonly displayName: string;
  readonly pluralName: string;
  readonly description: string;
  readonly stewardshipArea: string;
  readonly lifecyclePreset: EnterpriseLifecyclePresetKey;
  readonly lifecycle: EnterpriseLifecycleDefinition;
  readonly authorizationBoundary: EnterpriseAuthorizationBoundary;
  readonly consumerAgents: readonly EnterpriseAgent[];
  readonly relationshipKeys: readonly EnterpriseRelationshipKey[];
  readonly version: string;
  readonly checksum: string;
  readonly immutableLineage: string;
}

export interface EnterpriseRelationshipDefinition {
  readonly enterpriseRelationshipId: string;
  readonly relationshipKey: EnterpriseRelationshipKey;
  readonly sourceEntityKey: EnterpriseEntityKey;
  readonly targetEntityKey: EnterpriseEntityKey;
  readonly relationshipType: string;
  readonly cardinality: string;
  readonly description: string;
  readonly authorizationBoundary: EnterpriseAuthorizationBoundary;
  readonly version: string;
  readonly checksum: string;
  readonly immutableLineage: string;
}

export interface EnterpriseEntityVersionRecord {
  readonly enterpriseEntityVersionId: string;
  readonly entityKey: EnterpriseEntityKey;
  readonly version: string;
  readonly checksum: string;
  readonly definitionSnapshot: EnterpriseEntityDefinition;
  readonly createdAt: string;
  readonly immutableLineage: string;
}

export interface EnterpriseValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly entityKey?: EnterpriseEntityKey;
  readonly relationshipKey?: EnterpriseRelationshipKey;
}

export interface EnterpriseValidationResult {
  readonly enterpriseValidationId: string;
  readonly scope: string;
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly summary: string;
  readonly issues: readonly EnterpriseValidationIssue[];
  readonly createdAt: string;
  readonly immutableLineage: string;
}

export interface EnterpriseAuditLineageRecord {
  readonly enterpriseAuditLineageId: string;
  readonly entityKey: EnterpriseEntityKey;
  readonly actorId: string;
  readonly eventType: string;
  readonly summary: string;
  readonly relatedEntityKeys: readonly EnterpriseEntityKey[];
  readonly occurredAt: string;
  readonly immutableLineage: string;
}

export interface EnterpriseHealthSnapshot {
  readonly enterpriseHealthId: string;
  readonly status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  readonly totalEntities: number;
  readonly totalRelationships: number;
  readonly validationIssueCount: number;
  readonly duplicateOwnershipCount: number;
  readonly generatedAt: string;
  readonly immutableLineage: string;
}

export interface EnterpriseDomainCatalog {
  readonly entities: readonly EnterpriseEntityDefinition[];
  readonly relationships: readonly EnterpriseRelationshipDefinition[];
  readonly versions: readonly EnterpriseEntityVersionRecord[];
  readonly validation: EnterpriseValidationResult;
  readonly health: EnterpriseHealthSnapshot;
  readonly auditLineage: readonly EnterpriseAuditLineageRecord[];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`;
}

export function stableEnterpriseChecksum(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function enterpriseId(prefix: string, value: unknown): string {
  return `${prefix}_${stableEnterpriseChecksum(value).slice(0, 24)}_v1`;
}

export function createEnterpriseLifecycleDefinition(preset: EnterpriseLifecyclePresetKey): EnterpriseLifecycleDefinition {
  const lifecycle = ENTERPRISE_LIFECYCLE_PRESETS[preset];
  return {
    initialState: lifecycle.initialState,
    states: lifecycle.states,
  };
}

export function createEnterpriseEntityDefinition(spec: EnterpriseEntitySpec): EnterpriseEntityDefinition {
  const lifecycle = createEnterpriseLifecycleDefinition(spec.lifecyclePreset);
  const checksum = stableEnterpriseChecksum({
    entityKey: spec.entityKey,
    entityCode: spec.entityCode,
    displayName: spec.displayName,
    pluralName: spec.pluralName,
    description: spec.description,
    stewardshipArea: spec.stewardshipArea,
    lifecyclePreset: spec.lifecyclePreset,
    lifecycle,
    authorizationBoundary: spec.authorizationBoundary,
    consumerAgents: spec.consumerAgents,
    relationshipKeys: spec.relationshipKeys,
  });

  return {
    enterpriseEntityId: enterpriseId("ged-entity", spec.entityKey),
    entityKey: spec.entityKey as EnterpriseEntityKey,
    entityCode: spec.entityCode,
    displayName: spec.displayName,
    pluralName: spec.pluralName,
    description: spec.description,
    stewardshipArea: spec.stewardshipArea,
    lifecyclePreset: spec.lifecyclePreset,
    lifecycle,
    authorizationBoundary: spec.authorizationBoundary,
    consumerAgents: spec.consumerAgents,
    relationshipKeys: spec.relationshipKeys as readonly EnterpriseRelationshipKey[],
    version: "1.0.0",
    checksum,
    immutableLineage: enterpriseId("ged-lineage", { entityKey: spec.entityKey, checksum }),
  };
}

export function createEnterpriseRelationshipDefinition(spec: EnterpriseRelationshipSpec): EnterpriseRelationshipDefinition {
  const checksum = stableEnterpriseChecksum(spec);
  return {
    enterpriseRelationshipId: enterpriseId("ged-relationship", spec.relationshipKey),
    relationshipKey: spec.relationshipKey as EnterpriseRelationshipKey,
    sourceEntityKey: spec.sourceEntityKey as EnterpriseEntityKey,
    targetEntityKey: spec.targetEntityKey as EnterpriseEntityKey,
    relationshipType: spec.relationshipType,
    cardinality: spec.cardinality,
    description: spec.description,
    authorizationBoundary: spec.authorizationBoundary,
    version: "1.0.0",
    checksum,
    immutableLineage: enterpriseId("ged-lineage", { relationshipKey: spec.relationshipKey, checksum }),
  };
}

export function buildEnterpriseCatalog(): EnterpriseDomainCatalog {
  const entities = ENTERPRISE_ENTITY_SPECS.map(createEnterpriseEntityDefinition);
  const relationships = ENTERPRISE_RELATIONSHIP_SPECS.map(createEnterpriseRelationshipDefinition);
  const versions = entities.map((entity) => ({
    enterpriseEntityVersionId: enterpriseId("ged-entity-version", { entityKey: entity.entityKey, version: entity.version }),
    entityKey: entity.entityKey,
    version: entity.version,
    checksum: entity.checksum,
    definitionSnapshot: entity,
    createdAt: new Date(0).toISOString(),
    immutableLineage: entity.immutableLineage,
  }));
  const validation = validateEnterpriseDomainCatalog(entities, relationships);
  const health = createEnterpriseHealthSnapshot(entities, relationships, validation);
  const auditLineage = entities.map((entity) => ({
    enterpriseAuditLineageId: enterpriseId("ged-audit", { entityKey: entity.entityKey, version: entity.version }),
    entityKey: entity.entityKey,
    actorId: "system",
    eventType: "CATALOG_SEEDED",
    summary: `${entity.displayName} registered in the canonical enterprise catalog.`,
    relatedEntityKeys: entity.relationshipKeys.map((relationshipKey) => {
      const relationship = relationships.find((entry) => entry.relationshipKey === relationshipKey);
      return relationship?.targetEntityKey ?? entity.entityKey;
    }),
    occurredAt: new Date(0).toISOString(),
    immutableLineage: entity.immutableLineage,
  }));

  return { entities, relationships, versions, validation, health, auditLineage };
}

export function validateEnterpriseDomainCatalog(
  entities: readonly EnterpriseEntityDefinition[],
  relationships: readonly EnterpriseRelationshipDefinition[],
): EnterpriseValidationResult {
  const issues: EnterpriseValidationIssue[] = [];
  const entityKeys = new Set<string>();
  const entityCodes = new Set<string>();
  const relationshipKeys = new Set<string>();

  for (const entity of entities) {
    if (entityKeys.has(entity.entityKey)) {
      issues.push({ code: "DUPLICATE_ENTITY_KEY", message: `Duplicate entity key detected: ${entity.entityKey}`, entityKey: entity.entityKey });
    }
    entityKeys.add(entity.entityKey);

    if (entityCodes.has(entity.entityCode)) {
      issues.push({ code: "DUPLICATE_ENTITY_CODE", message: `Duplicate entity code detected: ${entity.entityCode}`, entityKey: entity.entityKey });
    }
    entityCodes.add(entity.entityCode);

    if (entity.consumerAgents.length === 0) {
      issues.push({ code: "MISSING_CONSUMER_AGENTS", message: `Entity has no consumer agents: ${entity.entityKey}`, entityKey: entity.entityKey });
    }
  }

  for (const relationship of relationships) {
    if (relationshipKeys.has(relationship.relationshipKey)) {
      issues.push({ code: "DUPLICATE_RELATIONSHIP_KEY", message: `Duplicate relationship key detected: ${relationship.relationshipKey}`, relationshipKey: relationship.relationshipKey });
    }
    relationshipKeys.add(relationship.relationshipKey);

    if (!entityKeys.has(relationship.sourceEntityKey)) {
      issues.push({ code: "MISSING_RELATIONSHIP_SOURCE", message: `Unknown source entity key: ${relationship.sourceEntityKey}`, relationshipKey: relationship.relationshipKey });
    }
    if (!entityKeys.has(relationship.targetEntityKey)) {
      issues.push({ code: "MISSING_RELATIONSHIP_TARGET", message: `Unknown target entity key: ${relationship.targetEntityKey}`, relationshipKey: relationship.relationshipKey });
    }
  }

  const status = issues.length === 0 ? "PASS" : issues.some((issue) => issue.code.startsWith("DUPLICATE") || issue.code.startsWith("MISSING")) ? "FAIL" : "WARN";

  return {
    enterpriseValidationId: enterpriseId("ged-validation", { entityCount: entities.length, relationshipCount: relationships.length, issueCount: issues.length }),
    scope: "GED-0001 canonical enterprise domain model",
    status,
    summary: status === "PASS" ? "Canonical enterprise domain catalog is valid." : `${issues.length} validation issue(s) found.`,
    issues,
    createdAt: new Date(0).toISOString(),
    immutableLineage: enterpriseId("ged-lineage", { scope: "validation", status, issueCount: issues.length }),
  };
}

export function createEnterpriseHealthSnapshot(
  entities: readonly EnterpriseEntityDefinition[],
  relationships: readonly EnterpriseRelationshipDefinition[],
  validation: EnterpriseValidationResult,
): EnterpriseHealthSnapshot {
  return {
    enterpriseHealthId: enterpriseId("ged-health", { entityCount: entities.length, relationshipCount: relationships.length }),
    status: validation.status === "PASS" ? "HEALTHY" : validation.status === "WARN" ? "DEGRADED" : "UNHEALTHY",
    totalEntities: entities.length,
    totalRelationships: relationships.length,
    validationIssueCount: validation.issues.length,
    duplicateOwnershipCount: 0,
    generatedAt: new Date(0).toISOString(),
    immutableLineage: enterpriseId("ged-lineage", { scope: "health", entities: entities.length, relationships: relationships.length }),
  };
}
