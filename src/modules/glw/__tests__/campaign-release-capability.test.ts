jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

const persisted = new Map<string, { revision: number; state: unknown }>();
class PersistenceConflict extends Error {}
jest.mock("@/modules/foundation/foundation-persistence", () => ({
  FoundationPersistenceConflictError: PersistenceConflict,
  deepClone: <T,>(value: T): T => structuredClone(value),
  loadPersistedState: <T,>(input: { namespace: string; seedFactory: () => T }) => {
    const current = persisted.get(input.namespace);
    return current ? { revision: current.revision, state: structuredClone(current.state) as T } : { revision: 0, state: input.seedFactory() };
  },
  savePersistedState: <T,>(input: { namespace: string; state: T; expectedRevision: number }) => {
    persisted.set(input.namespace, { revision: input.expectedRevision + 1, state: structuredClone(input.state) });
    return { revision: input.expectedRevision + 1 };
  },
}));

import {
  enableGlwCampaignActivationReleaseCapability,
  resolveGlwCampaignActivationReleaseCapability,
} from "../campaign-release-capability";

const scope = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure" };
const release = "a".repeat(40);

describe("GLW campaign activation release capability", () => {
  beforeEach(() => persisted.clear());

  test("fails closed when capability is missing", () => {
    expect(resolveGlwCampaignActivationReleaseCapability({ ...scope, runningReleaseSha: release })).toMatchObject({ status: "MISSING", ready: false });
  });

  test("fails closed when capability is bound to another release", () => {
    enableGlwCampaignActivationReleaseCapability({ ...scope, releaseSha: release, enabledBy: "release-manager" });
    expect(resolveGlwCampaignActivationReleaseCapability({ ...scope, runningReleaseSha: "b".repeat(40) })).toMatchObject({ status: "WRONG_RELEASE", ready: false });
  });

  test("does not treat publication capability as campaign activation authority", () => {
    persisted.set("glw-release-capability-authority-v1", { revision: 1, state: { schemaVersion: 1, capabilities: [{ capabilityId: "publication-only", scope: "ORGANIZATION_SITE", ...scope, releaseSha: release, allowedOperations: ["GLW_WORDPRESS_PUBLICATION"], status: "ENABLED", enabledAt: "2030-01-01", enabledBy: "release-manager" }] } });
    expect(resolveGlwCampaignActivationReleaseCapability({ ...scope, runningReleaseSha: release })).toMatchObject({ status: "OPERATION_NOT_ENABLED", ready: false });
  });

  test("enables only activation for the exact release and scope", () => {
    const capability = enableGlwCampaignActivationReleaseCapability({ ...scope, releaseSha: release, enabledBy: "release-manager" });
    expect(capability.allowedOperations).toEqual(["GLW_CAMPAIGN_ACTIVATION"]);
    expect(resolveGlwCampaignActivationReleaseCapability({ ...scope, runningReleaseSha: release })).toMatchObject({ status: "READY", ready: true });
    expect(resolveGlwCampaignActivationReleaseCapability({ organizationId: "ssi", siteId: "site-other", runningReleaseSha: release })).toMatchObject({ status: "MISSING", ready: false });
  });

  test("blocks direct activation before target mutation and owner-grant claim", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/activate/route.ts"), "utf8");
    const capabilityCheck = route.indexOf("requireGlwCampaignActivationReleaseCapability");
    expect(capabilityCheck).toBeGreaterThan(-1);
    expect(capabilityCheck).toBeLessThan(route.indexOf("initializeGlwCityCampaignTargets({"));
    expect(capabilityCheck).toBeLessThan(route.indexOf("claimGlwCampaignActivationGrant({"));
    expect(route.indexOf("claimGlwCampaignActivationGrant({")).toBeLessThan(route.indexOf("initializeGlwCityCampaignTargets({"));
    expect(route.indexOf("claimGlwCampaignActivationGrant({")).toBeLessThan(route.indexOf("initializeGlwCampaignTargets({"));
    expect(route.indexOf("claimGlwCampaignActivationGrant({")).toBeLessThan(route.indexOf("activateGlwCampaign(campaign.campaignId)"));
  });

  test("capability enablement grants neither publication nor owner authorization", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/release-capabilities/campaign-activation/route.ts"), "utf8");
    expect(route).toContain("const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;");
    expect(route).toContain("runningReleaseSha: releaseSha ?? \"\"");
    expect(route).toContain("Capability must target the exact running release SHA.");
    expect(route).toContain("ownerAuthorizationCreated: false");
    expect(route).toContain("publicationAuthorized: false");
    expect(route).toContain("activationPerformed: false");
    expect(route).not.toContain("createGlwCampaignActivationGrant");
  });

  test("campaign controls only enable explicit capability action when runtime SHA is projected", () => {
    const controls = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");
    expect(controls).toContain("Activation requires an exact running release SHA.");
    expect(controls).toContain("disabled={busy || !scheduler.releaseAuthority.runningReleaseSha}");
    expect(controls).toContain('operation: "ENABLE_RELEASE_CAPABILITY"');
    expect(controls).toContain("releaseSha: scheduler.releaseAuthority.runningReleaseSha");
  });

  test("runtime3004 trusted-local restart script resolves short commit input to exact SHA", () => {
    const script = readFileSync(join(process.cwd(), "scripts/restart-runtime3004-trusted-local.ps1"), "utf8");
    expect(script).toContain("rev-parse --verify");
    expect(script).toContain("GIT_COMMIT_EXACT_SHA_REQUIRED");
    expect(script).toContain("`$env:GIT_COMMIT='$resolvedGitCommit'");
    expect(script).toContain("GIT_COMMIT_INPUT=$GitCommit");
    expect(script).toContain("TRUSTED_LOCAL_OPERATOR=true");
  });

  test("scheduler projection does not auto-enable release capability in trusted-local mode", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/scheduler/route.ts"), "utf8");
    expect(route).toContain("const releaseAuthority = resolveReleaseCapability(campaign);");
    expect(route).not.toContain("enableGlwCampaignActivationReleaseCapability({");
    expect(route).not.toContain("trustedLocalAutoEnableAllowed");
  });
});