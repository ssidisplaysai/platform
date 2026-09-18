jest.mock("server-only", () => ({}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlwOwnerReviewDecisionAction } from "../GlwOwnerReviewDecisionAction";

describe("GlwOwnerReviewDecisionAction", () => {
  test("APPROVED shows approved label disabled and allows change to needs-fix", () => {
    const html = renderToStaticMarkup(
      <GlwOwnerReviewDecisionAction
        endpoint="/api/glw/visual-certifications/cert-1/decision"
        organizationId="led-display-warehouse"
        siteId="site-led-display-warehouse-production"
        currentDecision="APPROVED"
      />,
    );

    const approvedButton = html.match(/<button[^>]*>Approved ✓<\/button>/)?.[0] ?? "";
    const needsFixButton = html.match(/<button[^>]*>Change to Needs Fix<\/button>/)?.[0] ?? "";

    expect(approvedButton).toMatch(/\sdisabled(?:=|\s|>)/);
    expect(needsFixButton).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
});
