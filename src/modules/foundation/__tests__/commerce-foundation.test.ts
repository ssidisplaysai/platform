import {
  createFoundationContext,
  getSitesForOrganization,
} from "@/modules/foundation/context";
import {
  FOUNDATION_COMMANDS,
  FOUNDATION_NAVIGATION_ITEMS,
  FOUNDATION_SEARCH_INDEX,
} from "@/modules/foundation/navigation";
import { resolvePermissions } from "@/modules/foundation/permissions";
import {
  getVisibleCommandPaletteActions,
  getVisibleNavigationItems,
  searchFoundationIndex,
} from "@/modules/foundation/selectors";
import { FOUNDATION_SETTINGS_SECTIONS } from "@/modules/foundation/settings";
import {
  getAuditEmptyStateMessage,
  getNotificationEmptyStateMessage,
} from "@/modules/foundation/state";

describe("GCP-0002B commerce foundation", () => {
  test("builds organization and site context with consistent defaults", () => {
    const context = createFoundationContext();

    expect(context.organizations.length).toBeGreaterThan(0);
    expect(context.sites.length).toBeGreaterThan(0);

    const selectedSite = context.sites.find(
      (site) => site.id === context.selectedSiteId,
    );

    expect(selectedSite).toBeDefined();
    expect(selectedSite?.organizationId).toBe(context.selectedOrganizationId);
  });

  test("filters sites by selected organization", () => {
    const context = createFoundationContext();
    const organizationId = "led-display-warehouse";

    const sites = getSitesForOrganization(context.sites, organizationId);

    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((site) => site.organizationId === organizationId)).toBe(
      true,
    );
  });

  test("applies permission-aware navigation visibility", () => {
    const viewerPermissions = resolvePermissions(["viewer"]);

    const visibleNavigationItems = getVisibleNavigationItems(
      FOUNDATION_NAVIGATION_ITEMS,
      viewerPermissions,
    );

    const labels = visibleNavigationItems.map((item) => item.label);

    expect(labels).toContain("Mission Control");
    expect(labels).toContain("Companies");
    expect(labels).toContain("Settings");
    expect(labels).toContain("Notifications");
    expect(labels).not.toContain("Audit");
    expect(labels).not.toContain("Enterprise Search");
  });

  test("filters command palette by permissions and query", () => {
    const operatorPermissions = resolvePermissions(["ops_manager"]);

    const filtered = getVisibleCommandPaletteActions(
      FOUNDATION_COMMANDS,
      operatorPermissions,
      "audit",
    );

    const ids = filtered.map((command) => command.id);

    expect(ids).toContain("open-audit");
    expect(ids).toContain("open-quote-audit");
    expect(ids).toContain("open-new-quote");
    expect(new Set(ids).size).toBe(ids.length);

    const viewerPermissions = resolvePermissions(["viewer"]);
    const viewerCommands = getVisibleCommandPaletteActions(
      FOUNDATION_COMMANDS,
      viewerPermissions,
      "",
    );

    expect(viewerCommands).toHaveLength(0);
  });

  test("filters enterprise search index by permissions and query", () => {
    const analystPermissions = resolvePermissions(["analyst"]);

    const results = searchFoundationIndex(
      FOUNDATION_SEARCH_INDEX,
      analystPermissions,
      "governance",
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.id === "audit-view")).toBe(true);
  });

  test("exposes settings structure with locked manage sections for non-admin users", () => {
    const operatorPermissions = resolvePermissions(["ops_manager"]);
    const canManageSettings = operatorPermissions.has("settings:manage");

    expect(canManageSettings).toBe(false);
    expect(FOUNDATION_SETTINGS_SECTIONS.length).toBeGreaterThan(0);
    expect(
      FOUNDATION_SETTINGS_SECTIONS.some((section) => section.requiresManagePermission),
    ).toBe(true);
  });

  test("returns deterministic empty-state messaging for notifications and audit", () => {
    expect(getNotificationEmptyStateMessage()).toBe(
      "No notifications yet. System and organization events will appear here.",
    );
    expect(getAuditEmptyStateMessage()).toBe(
      "No audit events yet. Governance activity will populate this stream.",
    );
  });
});
