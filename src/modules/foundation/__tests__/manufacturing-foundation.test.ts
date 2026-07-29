import {
  getManufacturingComponentById,
  initializeManufacturingFoundation,
  listManufacturingAuditEvents,
  listManufacturingPublishedEvents,
  registerManufacturingComponent,
  resetManufacturingRepositoryForTests,
  reviseManufacturingComponent,
  searchManufacturingFoundation,
  transitionManufacturingComponentStatus,
  updateManufacturingComponent,
} from "@/modules/foundation/manufacturing-repository";
import { resolveManufacturingPermissions, hasManufacturingPermission } from "@/modules/foundation/manufacturing-authorization";
import { loadPersistedState } from "@/modules/foundation/foundation-persistence";

describe("GMP-0001A manufacturing foundation", () => {
  beforeEach(() => {
    resetManufacturingRepositoryForTests();
  });

  test("initializes foundation and registers component with audit and event contracts", () => {
    const init = initializeManufacturingFoundation({
      organizationId: "led-display-warehouse",
      actor: "mfg-admin",
    });

    expect(init.validation.valid).toBe(true);
    expect(init.initialized).toBe(true);

    const created = registerManufacturingComponent({
      organizationId: "led-display-warehouse",
      siteReference: "site-led-display-warehouse-production",
      componentType: "repository",
      componentKey: "manufacturing-repository-contract",
      displayName: "Manufacturing Repository Contract",
      description: "Persistence and repository contract for future manufacturing aggregates.",
      metadata: { package: "GMP-0001A" },
      actor: "mfg-admin",
    });

    expect(created.validation.valid).toBe(true);
    expect(created.component).toBeTruthy();
    expect(created.component?.componentNumber.startsWith("MFG-FND-")).toBe(true);
    expect(created.component?.owningApplicationId).toBe("gmp");

    const componentId = created.component?.componentId as string;
    const audit = listManufacturingAuditEvents(componentId);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.type === "component_registered")).toBe(true);

    const events = listManufacturingPublishedEvents(componentId);
    expect(events.some((event) => event.type === "ManufacturingComponentRegistered")).toBe(true);
  });

  test("supports deterministic lifecycle transitions, revisions, and persistence contracts", () => {
    const created = registerManufacturingComponent({
      organizationId: "led-display-warehouse",
      siteReference: null,
      componentType: "lifecycle",
      componentKey: "manufacturing-lifecycle-framework",
      displayName: "Manufacturing Lifecycle Framework",
      description: "Deterministic lifecycle transition framework for manufacturing aggregates.",
      metadata: { package: "GMP-0001A" },
      actor: "mfg-admin",
    });

    const componentId = created.component?.componentId as string;

    const activated = transitionManufacturingComponentStatus({
      componentId,
      actor: "mfg-admin",
      status: "active",
    });

    expect(activated.validation.valid).toBe(true);
    expect(activated.component?.status).toBe("active");

    const revised = reviseManufacturingComponent({
      componentId,
      actor: "mfg-admin",
      reason: "Baseline lifecycle contract revision",
      changedFields: ["lifecycleContractVersion"],
    });

    expect(revised.validation.valid).toBe(true);
    expect(revised.revision?.revisionNumber).toBeGreaterThan(1);

    const updated = updateManufacturingComponent({
      componentId,
      patch: {
        description: "Lifecycle framework with revision and audit integration.",
        metadata: { package: "GMP-0001A", release: "v1" },
      },
      actor: "mfg-admin",
    });

    expect(updated.validation.valid).toBe(true);
    expect(updated.component?.version).toBeGreaterThan(1);

    const persisted = loadPersistedState({
      namespace: "manufacturing-foundation-repository",
      seedFactory: () => ({
        components: [],
        auditEvents: [],
        publishedEvents: [],
        sequenceByOrganization: {},
      }),
    });

    expect(Array.isArray(persisted.state.components)).toBe(true);
    expect(persisted.state.components.some((entry) => entry.componentId === componentId)).toBe(true);
  });

  test("integrates authorization and selector framework without execution aggregates", () => {
    const permissions = resolveManufacturingPermissions(["platform_admin", "ops_manager"]);
    expect(permissions.has("manufacturing:create")).toBe(true);
    expect(hasManufacturingPermission({ roles: ["analyst"], permission: "manufacturing:view_audit" })).toBe(true);
    expect(hasManufacturingPermission({ roles: ["viewer"], permission: "manufacturing:read" })).toBe(false);

    const first = registerManufacturingComponent({
      organizationId: "led-display-warehouse",
      siteReference: null,
      componentType: "search",
      componentKey: "manufacturing-search-contract",
      displayName: "Manufacturing Search Contract",
      description: "Search integration contract for future manufacturing aggregates.",
      metadata: { package: "GMP-0001A" },
      actor: "mfg-admin",
    });

    expect(first.validation.valid).toBe(true);

    const search = searchManufacturingFoundation({
      organizationId: "led-display-warehouse",
      query: "search",
    });

    expect(search.length).toBeGreaterThan(0);
    expect(search[0]?.componentType).toBe("search");

    const record = getManufacturingComponentById(first.component?.componentId as string);
    expect(record?.componentType).toBe("search");
    expect(record?.metadata.package).toBe("GMP-0001A");
  });
});
