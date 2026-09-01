import {
  GLW_RESEARCH_SIDECAR_COLORADO,
  GLW_RESEARCH_SIDECAR_CONFIRMATION,
  GLW_RESEARCH_SIDECAR_WORKFLOW_ID,
  validateGlwResearchSidecarInput,
} from "../research-sidecar-authority";

function exactRequest() {
  return {
    organizationId:
      "led-display-warehouse",
    siteId:
      "site-led-display-warehouse-production",
    campaignId:
      "campaign-indoor-digital-sphere",
    productId:
      "prod-indoor-digital-sphere",
    ...GLW_RESEARCH_SIDECAR_COLORADO,
  };
}

describe(
  "GLW research sidecar authority",
  () => {
    test(
      "preserves the certified workflow identity",
      () => {
        expect(
          GLW_RESEARCH_SIDECAR_WORKFLOW_ID,
        ).toBe("E3ZgpwAu98DwpUzO");
      },
    );

    test(
      "accepts only the exact Colorado canary envelope",
      () => {
        expect(
          validateGlwResearchSidecarInput({
            confirm:
              GLW_RESEARCH_SIDECAR_CONFIRMATION,
            request:
              exactRequest(),
          }),
        ).toEqual(exactRequest());
      },
    );

    test.each([
      undefined,
      {},
      {
        confirm:
          GLW_RESEARCH_SIDECAR_CONFIRMATION,
        request: {
          ...exactRequest(),
          stateCode: "CA",
        },
      },
      {
        confirm:
          GLW_RESEARCH_SIDECAR_CONFIRMATION,
        request: {
          ...exactRequest(),
          canonicalPath:
            "/indoor-digital-sphere/california/",
        },
      },
      {
        confirm:
          GLW_RESEARCH_SIDECAR_CONFIRMATION,
        request: {
          ...exactRequest(),
          jobId: "wrong-job",
        },
      },
      {
        confirm:
          GLW_RESEARCH_SIDECAR_CONFIRMATION,
        request: {
          ...exactRequest(),
          wordpressObjectId: "1",
        },
      },
      {
        confirm: "EXECUTE_ALL",
        request:
          exactRequest(),
      },
      {
        confirm:
          GLW_RESEARCH_SIDECAR_CONFIRMATION,
        request: {
          ...exactRequest(),
          extra: "not-allowed",
        },
      },
    ])(
      "rejects unauthorized or malformed input %#",
      (input) => {
        expect(
          () =>
            validateGlwResearchSidecarInput(
              input,
            ),
        ).toThrow();
      },
    );
  },
);
