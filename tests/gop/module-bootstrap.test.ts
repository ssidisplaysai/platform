import { describe, expect, it } from "@jest/globals";
import { bootstrapGenesisModules } from "@/platform/gop/runtime/module-bootstrap";
import type { GenesisModuleManifest } from "@/platform/gop/contracts";

function buildManifest(overrides: Partial<GenesisModuleManifest> = {}): GenesisModuleManifest {
  return {
    moduleId: "glw.core",
    name: "GLW",
    enabled: true,
    order: 10,
    navigation: [
      { label: "Dashboard", href: "/glw", icon: "dashboard", order: 10, enabled: true },
      { label: "Pages", href: "/glw/pages", icon: "pages", order: 20, enabled: true },
    ],
    routes: [
      { label: "Dashboard", href: "/glw" },
      { label: "Pages", href: "/glw/pages" },
    ],
    permissions: [],
    supportedJobTypes: ["PAGE_GENERATION"],
    ...overrides,
  };
}

describe("gop module bootstrap", () => {
  it("sorts navigation deterministically", () => {
    const result = bootstrapGenesisModules([
      buildManifest(),
      buildManifest({
        moduleId: "glw.tools",
        name: "Tools",
        order: 20,
        navigation: [
          { label: "Settings", href: "/glw/settings", icon: "settings", order: 40, enabled: true },
          { label: "Blogs", href: "/glw/blogs", icon: "blogs", order: 30, enabled: true },
        ],
        routes: [
          { label: "Settings", href: "/glw/settings" },
          { label: "Blogs", href: "/glw/blogs" },
        ],
      }),
    ]);

    expect(result.navigation.map((item) => item.href)).toEqual([
      "/glw",
      "/glw/pages",
      "/glw/blogs",
      "/glw/settings",
    ]);
  });

  it("rejects duplicate module ids", () => {
    const result = bootstrapGenesisModules([
      buildManifest(),
      buildManifest(),
    ]);

    expect(result.issues.some((issue) => issue.code === "DUPLICATE_MODULE_ID")).toBe(true);
  });

  it("rejects duplicate route ownership", () => {
    const result = bootstrapGenesisModules([
      buildManifest(),
      buildManifest({
        moduleId: "glw.other",
        routes: [{ label: "Pages", href: "/glw/pages" }],
        navigation: [{ label: "Pages", href: "/glw/pages", icon: "pages", enabled: true }],
      }),
    ]);

    expect(result.issues.some((issue) => issue.code === "DUPLICATE_ROUTE_OWNERSHIP")).toBe(true);
  });

  it("rejects invalid job types", () => {
    const invalid = buildManifest({
      moduleId: "invalid.module",
      supportedJobTypes: ["NOT_A_JOB_TYPE"] as unknown as GenesisModuleManifest["supportedJobTypes"],
    });

    const result = bootstrapGenesisModules([invalid]);

    expect(result.issues.some((issue) => issue.code === "INVALID_JOB_TYPE")).toBe(true);
    expect(result.enabledModules).toHaveLength(0);
  });
});
