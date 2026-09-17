jest.mock("server-only", () => ({}));
jest.mock("../reference-aware-image-service", () => ({ generateGenesisFeaturedImageWithCampaignReferences: jest.fn() }));
jest.mock("@/modules/foundation/generated-contextual-media-repository", () => ({ bindGeneratedContextualMediaWordPress: jest.fn(), findSuccessfulGeneratedContextualMedia: jest.fn(), saveSuccessfulGeneratedContextualMedia: jest.fn() }));
jest.mock("@/modules/foundation/site-page-media-assignment", () => ({ listSitePageMediaAssignments: jest.fn(() => []), saveSitePageMediaAssignment: jest.fn((input) => input) }));
jest.mock("@/modules/foundation/wordpress-media-writer", () => ({ uploadGenesisWordPressGeneratedMedia: jest.fn() }));

import { createContextualMediaProductionDependencies, inertContextualMediaDependencies } from "../contextual-media-production-dependencies";

test("production dependencies reuse existing provider, persistence, assignment, and WordPress paths", () => {
  const deps = createContextualMediaProductionDependencies({ site: { integrations: {} } as never, siteName: "Site", productName: "Product", patchPresentation: jest.fn(), certify: jest.fn() });
  expect(Object.keys(deps)).toEqual(["findSuccessfulGeneration", "generate", "persistGeneration", "persistAssignment", "uploadMedia", "patchPresentation", "certify"]);
  expect(() => inertContextualMediaDependencies().generate({} as never)).toThrow("DRY_RUN_SIDE_EFFECT_FORBIDDEN");
});