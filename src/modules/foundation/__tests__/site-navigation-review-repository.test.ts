import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("site navigation review repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "navigation-review-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior; fs.rmSync(directory, { recursive: true, force: true }); });

  test("preserves navigation revisions and requires explicit publication gates", async () => {
    const repository = await import("../site-navigation-review-repository");
    const proposal = repository.saveSiteNavigationReview({ organizationId: "org", siteId: "site", buildSessionId: "build", assemblyId: "assembly", status: "READY_FOR_OWNER_REVIEW", items: [{ label: "Products", href: "/products/", children: [{ label: "Counters", href: "/counters/" }] }], footerLinks: [{ label: "Contact", href: "/contact/" }], ownerInstructions: null, createdBy: "owner" });
    const approved = repository.decideSiteNavigationReview({ organizationId: "org", siteId: "site", buildSessionId: "build", navigationReviewId: proposal.navigationReviewId, decision: "APPROVE", actor: "owner" });
    const ready = repository.advanceSiteNavigationPublicationGate({ organizationId: "org", siteId: "site", buildSessionId: "build", navigationReviewId: approved.navigationReviewId, transition: "CONFIRM_READINESS", actor: "owner" });
    const authorized = repository.advanceSiteNavigationPublicationGate({ organizationId: "org", siteId: "site", buildSessionId: "build", navigationReviewId: ready.navigationReviewId, transition: "AUTHORIZE_PUBLICATION", actor: "owner" });
    expect(authorized).toMatchObject({ status: "PUBLICATION_AUTHORIZED", revision: 1, items: proposal.items, footerLinks: proposal.footerLinks });
    expect(repository.listSiteNavigationReviews({ organizationId: "org", siteId: "site", buildSessionId: "build" })).toHaveLength(1);
  });
});
