import { describe, expect, it } from "@jest/globals";
import { buildEnterpriseCatalog, ENTERPRISE_ENTITY_SPECS, ENTERPRISE_RELATIONSHIP_SPECS } from "@/lib/ged/enterprise-domain-models";

describe("ged domain model", () => {
  it("defines the canonical enterprise catalog without duplicates", () => {
    const catalog = buildEnterpriseCatalog();

    expect(catalog.entities).toHaveLength(ENTERPRISE_ENTITY_SPECS.length);
    expect(catalog.relationships).toHaveLength(ENTERPRISE_RELATIONSHIP_SPECS.length);
    expect(catalog.validation.status).toBe("PASS");
    expect(catalog.health.status).toBe("HEALTHY");

    const entityKeys = new Set(catalog.entities.map((entry) => entry.entityKey));
    const entityCodes = new Set(catalog.entities.map((entry) => entry.entityCode));
    expect(entityKeys.size).toBe(catalog.entities.length);
    expect(entityCodes.size).toBe(catalog.entities.length);

    for (const relationship of catalog.relationships) {
      expect(entityKeys.has(relationship.sourceEntityKey)).toBe(true);
      expect(entityKeys.has(relationship.targetEntityKey)).toBe(true);
    }
  });

  it("includes the required shared enterprise entities", () => {
    const catalog = buildEnterpriseCatalog();
    const entityKeys = new Set(catalog.entities.map((entry) => entry.entityKey));

    for (const required of [
      "organization",
      "business_unit",
      "facility",
      "department",
      "employee",
      "role",
      "customer",
      "contact",
      "vendor",
      "supplier",
      "product",
      "product_family",
      "service",
      "project",
      "opportunity",
      "quote",
      "sales_order",
      "purchase_order",
      "work_order",
      "manufacturing_order",
      "inventory_item",
      "warehouse",
      "asset",
      "machine",
      "vehicle",
      "shipment",
      "invoice",
      "payment",
      "contract",
      "subscription",
      "document",
      "knowledge_artifact",
      "kpi",
      "goal",
      "recommendation",
      "risk",
      "approval",
      "task",
      "event",
    ]) {
      expect(entityKeys.has(required)).toBe(true);
    }
  });
});
