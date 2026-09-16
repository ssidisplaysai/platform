import { evaluateCustomerFacingCopyQuality } from "../customer-facing-copy-quality";

describe("customer-facing copy quality", () => {
  test.each([
    "Owner-approved visual authority supports this page.",
    "The authority mapping confirms this claim.",
    "PRODUCT_AUTHORITY and CONTEXTUAL_IN_USE are available.",
    "No approved dataset exists for this comparison.",
    "This unknown fact requires proper authority.",
    "Claim governance uses the candidate SHA fingerprint.",
  ])("blocks internal governance language: %s", (copy) => {
    expect(evaluateCustomerFacingCopyQuality(copy)).toMatchObject({ pass: false, internalGovernanceLanguageExposed: expect.any(Number) });
  });

  test("passes natural customer-facing project copy", () => {
    expect(evaluateCustomerFacingCopyQuality("Explore an Outdoor Digital Sphere concept for your location, audience, content goals, and project timeline.")).toEqual({ contract: "GENESIS_CUSTOMER_FACING_COPY_QUALITY_V1", internalGovernanceLanguageExposed: 0, matchedPatterns: [], pass: true });
  });
});
