import { readFileSync } from "node:fs";
import { join } from "node:path";

const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwReferenceGoLiveReadiness.tsx"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/glw/campaigns/[campaignId]/page.tsx"), "utf8");

test("campaign detail exposes exact CA media approval and honest host certification blocker", () => {
  for (const marker of ["Approve CA Media 15338", "OWNER APPROVAL REQUIRED", "WordPress browser-preview session authority unavailable", "operatorMutationHeaders", "expectedLineageFingerprint"]) expect(ui).toContain(marker);
  expect(page).toContain("getGlwReferenceMediaAuthority");
  expect(page).toContain("<GlwReferenceGoLiveReadiness");
});