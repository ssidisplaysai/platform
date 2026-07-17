import { describe, expect, it } from "@jest/globals";

import { DomainClassifier } from "../DomainClassifier";

describe("DomainClassifier", () => {
  it.each([
    ["Blog Cluster Queue", "Publishing"],
    ["Products", "Products"],
    ["State Queue", "States"],
    ["SEO Repair Queue", "SEO"],
    ["Image Repair Status", "Images"],
    ["Mission Control", "General"],
  ])("classifies %s as %s", (sheetName, expectedDomain) => {
    expect(new DomainClassifier().classify(sheetName)).toBe(
      expectedDomain,
    );
  });
});
