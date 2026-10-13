jest.mock("server-only", () => ({}));

import { PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY } from "../projectorenclosure-holiday-seo-authority";
import { loadProjectorEnclosureSeoAuthority } from "../projectorenclosure-seo-authority";

const workbookAuthority = loadProjectorEnclosureSeoAuthority();

describe("ProjectorEnclosure holiday SEO authority", () => {
  test("records the owner-approved residential holiday canonical without workbook lineage", () => {
    expect(PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY).toMatchObject({
      authorityType: "OWNER_APPROVED_CANONICAL_SEO_AUTHORITY",
      canonicalPostId: 11828,
      primaryKeyword: "projector enclosure for holiday projection mapping",
      secondaryKeyword: "holiday projection mapping enclosure",
      workbookLineageClaimed: false,
    });
    expect(workbookAuthority.findExactKeyword(PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY.primaryKeyword)).toBeNull();
    expect(workbookAuthority.findExactKeyword(PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY.secondaryKeyword)).toBeNull();
  });

  test("preserves separate commercial, product, and future house-mapping owners", () => {
    expect(PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY.relatedOwners).toEqual({
      commercialHolidayPostId: 12812,
      commercialArchitecturalPostId: 12809,
      homelineProductPageId: 11852,
      futureHouseMappingKeywords: [
        "projector enclosure for house projection mapping",
        "house projection mapping enclosure",
      ],
    });
    for (const keyword of PROJECTOR_ENCLOSURE_HOLIDAY_SEO_AUTHORITY.relatedOwners.futureHouseMappingKeywords) {
      expect(workbookAuthority.findExactKeyword(keyword)?.pageTarget).toBe("Projection Mapping");
    }
  });
});
