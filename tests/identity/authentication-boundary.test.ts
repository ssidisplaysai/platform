import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("gid-1002 authentication boundary", () => {
  it("does not introduce authorization or federation implementation", () => {
    const root = join(process.cwd(), "src", "platform", "identity", "services");
    const files = readdirSync(root).filter((file) => file.endsWith(".ts"));
    const bannedPatterns = [
      /authorize\(/,
      /policyresolver/i,
      /permissions?/i,
      /sso/i,
      /federation/i,
      /openid/i,
      /oauth/i,
      /saml/i,
    ];

    for (const file of files) {
      const content = readFileSync(join(root, file), "utf8");
      for (const pattern of bannedPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
