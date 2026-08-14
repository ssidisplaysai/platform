import { describe, expect, it, jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}), { virtual: true });

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}), { virtual: true });

import {
  GLW_PAGES_GENERATE_HREF,
  isCreateModeQueryEnabled,
  resolveIsCreateMode,
} from "@/components/glw/glw-page-generation-workspace";
import { isCreateModeEnabled } from "@/app/glw/(protected)/pages/page";

describe("GLW pages Generate Page UI", () => {
  it("wires Generate Page to explicit /glw/pages create-mode navigation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/glw/glw-page-generation-workspace.tsx"),
      "utf8",
    );

    expect(GLW_PAGES_GENERATE_HREF).toBe("/glw/pages?create=1");
    expect(source).toContain("<Link");
    expect(source).toContain("href={GLW_PAGES_GENERATE_HREF}");
  });

  it("keeps create UI closed for /glw/pages and opens it for /glw/pages?create=1 on server parsing", () => {
    expect(isCreateModeEnabled(undefined)).toBe(false);
    expect(isCreateModeEnabled("0")).toBe(false);
    expect(isCreateModeEnabled("1")).toBe(true);
    expect(isCreateModeEnabled(["1"])).toBe(true);
  });

  it("keeps create UI closed for /glw/pages and opens it for /glw/pages?create=1 on client query resolution", () => {
    expect(isCreateModeQueryEnabled(null)).toBe(false);
    expect(isCreateModeQueryEnabled("0")).toBe(false);
    expect(isCreateModeQueryEnabled("1")).toBe(true);

    expect(resolveIsCreateMode({ createParam: null, initialCreateMode: false })).toBe(false);
    expect(resolveIsCreateMode({ createParam: "1", initialCreateMode: false })).toBe(true);
  });

});
