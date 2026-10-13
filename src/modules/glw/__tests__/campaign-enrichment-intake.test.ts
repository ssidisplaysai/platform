jest.mock("server-only", () => ({}));

import {
  buildGlwDraftEnrichmentIntakeTarget,
  buildGlwDraftEnrichmentResearchPlan,
} from "../campaign-enrichment-intake";

describe(
  "GLW campaign draft enrichment intake",
  () => {
    test(
      "preserves exact draft-ready target identity",
      () => {
        const target =
          buildGlwDraftEnrichmentIntakeTarget({
            targetId:
              "target-colorado",
            organizationId:
              "led-display-warehouse",
            siteId:
              "site-led-display-warehouse-production",
            productId:
              "prod-indoor-digital-sphere",
            campaignId:
              "campaign-indoor-sphere-50",
            stateCode: "co",
            productSlug:
              "indoor-digital-sphere",
            jobId:
              "ecd5e8b9-a177-4ed9-aef7-873fa7ee3e29",
            wordpressObjectId:
              19853,
          });

        expect(target.stateCode)
          .toBe("CO");

        expect(target.stateName)
          .toBe("Colorado");

        expect(target.jobId)
          .toBe(
            "ecd5e8b9-a177-4ed9-aef7-873fa7ee3e29",
          );

        expect(
          target.wordpressObjectId,
        ).toBe("19853");

        expect(target.canonicalPath)
          .toBe(
            "/indoor-digital-sphere/colorado/",
          );
      },
    );

    test(
      "fails closed when exact job identity is missing",
      () => {
        expect(() =>
          buildGlwDraftEnrichmentIntakeTarget({
            targetId:
              "target-colorado",
            organizationId:
              "led-display-warehouse",
            siteId:
              "site-led-display-warehouse-production",
            productId:
              "prod-indoor-digital-sphere",
            campaignId:
              "campaign-indoor-sphere-50",
            stateCode: "CO",
            productSlug:
              "indoor-digital-sphere",
            jobId: null,
            wordpressObjectId:
              19853,
          }),
        ).toThrow(
          /generation job ID/i,
        );
      },
    );

    test(
      "fails closed when WordPress draft identity is missing",
      () => {
        expect(() =>
          buildGlwDraftEnrichmentIntakeTarget({
            targetId:
              "target-colorado",
            organizationId:
              "led-display-warehouse",
            siteId:
              "site-led-display-warehouse-production",
            productId:
              "prod-indoor-digital-sphere",
            campaignId:
              "campaign-indoor-sphere-50",
            stateCode: "CO",
            productSlug:
              "indoor-digital-sphere",
            jobId:
              "job-colorado",
            wordpressObjectId:
              null,
          }),
        ).toThrow(
          /WordPress draft ID/i,
        );
      },
    );

    test(
      "builds research plan from exact existing draft identity",
      () => {
        const target =
          buildGlwDraftEnrichmentIntakeTarget({
            targetId:
              "target-colorado",
            organizationId:
              "led-display-warehouse",
            siteId:
              "site-led-display-warehouse-production",
            productId:
              "prod-indoor-digital-sphere",
            campaignId:
              "campaign-indoor-sphere-50",
            stateCode: "CO",
            productSlug:
              "indoor-digital-sphere",
            jobId:
              "job-colorado",
            wordpressObjectId:
              "19853",
          });

        const plan =
          buildGlwDraftEnrichmentResearchPlan({
            target,
            siteDomain:
              "https://www.leddisplaywarehouse.com/",
            productTopic:
              "Indoor Digital Sphere",
            upstreamAuthorityDomains: [
              "ssidisplays.com",
            ],
          });

        expect(plan.stateCode)
          .toBe("CO");

        expect(plan.jobId)
          .toBe("job-colorado");

        expect(plan.wordpressObjectId)
          .toBe("19853");

        expect(plan.emptyPlan.siteDomain)
          .toBe(
            "leddisplaywarehouse.com",
          );

        expect(
          plan.researchRequirements.some(
            (requirement) =>
              requirement.requirementId
              ===
              "source-product-first-party",
          ),
        ).toBe(true);

        expect(
          plan.researchRequirements.some(
            (requirement) =>
              requirement.requirementId
              ===
              "source-state-government",
          ),
        ).toBe(true);

        expect(
          plan.researchRequirements.some(
            (requirement) =>
              requirement.requirementId
              ===
              "link-upstream-source-of-truth",
          ),
        ).toBe(true);
      },
    );

    test(
      "does not grant generation or publication authority",
      () => {
        const target =
          buildGlwDraftEnrichmentIntakeTarget({
            targetId: "target-ak",
            organizationId:
              "led-display-warehouse",
            siteId:
              "site-led-display-warehouse-production",
            productId:
              "prod-indoor-digital-sphere",
            campaignId:
              "campaign-indoor-sphere-50",
            stateCode: "AK",
            productSlug:
              "indoor-digital-sphere",
            jobId: "job-ak",
            wordpressObjectId:
              "19829",
          });

        const serialized =
          JSON.stringify(
            buildGlwDraftEnrichmentResearchPlan({
              target,
              siteDomain:
                "leddisplaywarehouse.com",
              productTopic:
                "Indoor Digital Sphere",
              upstreamAuthorityDomains: [
                "ssidisplays.com",
              ],
            }),
          );

        expect(serialized)
          .not.toContain(
            '"publicationIntent":"publish"',
          );

        expect(serialized)
          .not.toContain(
            "SCHEDULED_PUBLISH",
          );
      },
    );
  },
);