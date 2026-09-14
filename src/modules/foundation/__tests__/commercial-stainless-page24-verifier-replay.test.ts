import { createHash } from "node:crypto";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function originalShell(html: string) {
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? "";
  const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? "";
  return `${header}\n${footer}`;
}

function exactGlobalShell(html: string) {
  const header = html.match(/<header class=["']wp-block-template-part["'][^>]*>[\s\S]*?<\/header>/i)?.[0] ?? "";
  const footers = [...html.matchAll(/<footer class=["']wp-block-template-part["'][^>]*>[\s\S]*?<\/footer>/gi)];
  return `${header}\n${footers.at(-1)?.[0] ?? ""}`;
}

const globalHeader = '<header class="wp-block-template-part">GLOBAL HEADER</header>';
const globalFooter = '<footer class="wp-block-template-part">GLOBAL FOOTER</footer>';
const before = `${globalHeader}<main><div class="gvs-page"><header>LEGACY BODY HEADER</header><nav>LEGACY BODY NAV</nav><footer>LEGACY BODY FOOTER</footer></div></main>${globalFooter}`;
const promoted = `${globalHeader}<main><style>.wr-hero{min-height:610px}</style><div class="wr-page"><section class="wr-hero"><h1>Request a Quote</h1></section></div></main>${globalFooter}`;

describe("Commercial Stainless Page 24 verifier forensic replay", () => {
  test("the original shell hash changes when the legacy body footer is removed", () => {
    expect(sha256(originalShell(before))).not.toBe(sha256(originalShell(promoted)));
    expect(originalShell(before)).toContain("LEGACY BODY FOOTER");
  });

  test("the exact WordPress template-part shell remains identical", () => {
    expect(sha256(exactGlobalShell(before))).toBe(sha256(exactGlobalShell(promoted)));
    expect(exactGlobalShell(before)).not.toContain("LEGACY BODY FOOTER");
  });

  test("the original whitespace detector rejects the approved 610px hero", () => {
    const originalLegacyGiantWhitespace = /min-height:\s*(?:[5-9]\d\d|\d{4,})px/i.test(promoted);
    expect(originalLegacyGiantWhitespace).toBe(true);
    expect(promoted).toContain("wr-page");
    expect(promoted).not.toContain("gvs-page");
  });
});