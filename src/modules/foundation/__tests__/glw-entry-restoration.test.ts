import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOUNDATION_NAVIGATION_ITEMS } from "@/modules/foundation/navigation";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getVisibleNavigationItems } from "@/modules/foundation/selectors";

describe("GLW entry-point restoration", () => {
  test("registers GLW in descriptor-driven navigation", () => {
    const glw = FOUNDATION_NAVIGATION_ITEMS.find((item) => item.id === "glw");

    expect(glw).toBeDefined();
    expect(glw?.label).toBe("LED Display Warehouse");
    expect(glw?.href).toBe("/glw");
    expect(glw?.requiredPermissions).toEqual(["workspace:view"]);
  });

  test("shows GLW navigation for signed-in viewer permissions", () => {
    const permissions = resolvePermissions(["viewer"]);
    const visible = getVisibleNavigationItems(FOUNDATION_NAVIGATION_ITEMS, permissions);

    expect(visible.some((item) => item.id === "glw")).toBe(true);
  });

  test("restores /glw route with protected shell integration", () => {
    const routePath = resolve(process.cwd(), "src/app/glw/page.tsx");

    expect(existsSync(routePath)).toBe(true);

    const source = readFileSync(routePath, "utf8");
    expect(source).toContain('import { AppShell } from "@/components/layout/app-shell";');
    expect(source).toContain("<AppShell>");
    expect(source).toContain("<GlwDashboard />");
  });

  test("restores /glw/pages route with protected shell integration", () => {
    const routePath = resolve(process.cwd(), "src/app/glw/pages/page.tsx");

    expect(existsSync(routePath)).toBe(true);

    const source = readFileSync(routePath, "utf8");
    expect(source).toContain('import { AppShell } from "@/components/layout/app-shell";');
    expect(source).toContain("<AppShell>");
    expect(source).toContain("<GlwPagesCenter />");
  });

  test("keeps GLW route links internally consistent", () => {
    const dashboardPath = resolve(process.cwd(), "src/modules/glw/GlwDashboard.tsx");
    const pagesCenterPath = resolve(process.cwd(), "src/modules/glw/GlwPagesCenter.tsx");

    const dashboardSource = readFileSync(dashboardPath, "utf8");
    const pagesCenterSource = readFileSync(pagesCenterPath, "utf8");

    expect(dashboardSource).toContain('href="/glw/pages"');
    expect(pagesCenterSource).toContain('href="/glw"');
  });
});
