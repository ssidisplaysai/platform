jest.mock("server-only", () => ({}));

import { bindHeaderNavigation, buildApprovedFooterBlocks, buildApprovedNavigationBlocks } from "../wordpress-theme-shell-repair";

const items = [
  { label: "Commercial Stainless Counters", href: "/commercial-stainless-counters/", children: [] },
  { label: "Products & Solutions", href: "/commercial-stainless-counters/", children: [{ label: "Commercial Worktables & Prep Tables", href: "/commercial-worktables-and-prep-tables/" }] },
];

describe("CSC WordPress theme shell repair", () => {
  test("serializes canonical semantic navigation blocks without placeholders or scripts", () => {
    const content = buildApprovedNavigationBlocks(items);
    expect(content).toContain("wp:navigation-submenu");
    expect(content).toContain("Commercial Worktables & Prep Tables");
    expect(content).toContain("https://commercialstainlesscounters.com/commercial-worktables-and-prep-tables/");
    expect(content).not.toMatch(/href=|<script|<style|"#"|http:\/\//);
  });

  test("binds exactly one existing header navigation block to the owned resource", () => {
    const source = '<!-- wp:group --><div><!-- wp:navigation {"overlayMenu":"mobile"} /--></div><!-- /wp:group -->';
    expect(bindHeaderNavigation(source, 81)).toContain('"overlayMenu":"mobile","ref":81');
    expect(() => bindHeaderNavigation("<!-- wp:site-title /-->", 81)).toThrow("THEME_SHELL_HEADER_NAVIGATION_BLOCK_COUNT:0");
  });

  test("builds a minimal approved footer without Twenty Twenty-Five demo artifacts", () => {
    const content = buildApprovedFooterBlocks([{ label: "About", href: "/about/" }, { label: "Request a Quote", href: "/request-a-quote/" }]);
    expect(content).not.toContain("wp:site-title");
    expect(content).toContain("https://commercialstainlesscounters.com/about/");
    expect(content).not.toMatch(/Blog|FAQs|Authors|Events|Shop|Patterns|Themes|Twenty Twenty-Five|Designed with WordPress|"#"/);
  });
});