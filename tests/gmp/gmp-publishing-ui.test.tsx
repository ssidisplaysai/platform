import { describe, expect, it } from "@jest/globals";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GmpDestinationHealth } from "@/components/gmp/gmp-destination-health";
import { GmpDestinationCapabilities } from "@/components/gmp/gmp-destination-capabilities";
import { GmpReleaseDependencyPlan } from "@/components/gmp/gmp-release-dependency-plan";
import { GmpPublicationTimeline } from "@/components/gmp/gmp-publication-timeline";
import { GmpVerificationDetail } from "@/components/gmp/gmp-verification-detail";
import { GmpReconciliationDifferences } from "@/components/gmp/gmp-reconciliation-differences";
import { GmpMediaDeliveryStatus } from "@/components/gmp/gmp-media-delivery-status";
import { GmpWordpressTransportStatus } from "@/components/gmp/gmp-wordpress-transport-status";
import { GmpPublishingDetailWorkspace } from "@/components/gmp/gmp-publishing-detail-workspace";

describe("gmp publishing ui components", () => {
  it("renders destination health from server contract without client recomputation", () => {
    const markup = renderToStaticMarkup(
      <GmpDestinationHealth health={{
        modelVersion: "gmp-destination-health/v1",
        generatedAt: "2026-07-26T10:00:00.000Z",
        overallHealth: { score: 92, status: "HEALTHY" },
        connectionHealth: { score: 90, status: "HEALTHY" },
        credentialHealth: { score: 100, status: "HEALTHY" },
        capabilityHealth: { score: 88, status: "HEALTHY" },
        publishingHealth: { score: 86, status: "HEALTHY" },
        verificationHealth: { score: 79, status: "DEGRADED" },
        driftHealth: { score: 81, status: "HEALTHY" },
        blockingIssues: [],
        warnings: ["recent_attempt_failure_rate_high"],
        recommendations: ["Review retries"],
      }} />,
    );

    expect(markup).toContain("gmp-destination-health/v1");
    expect(markup).toContain("Overall");
    expect(markup).toContain("92");
    expect(markup).toContain("recent_attempt_failure_rate_high");
  });

  it("renders capability matrix and policy gaps", () => {
    const markup = renderToStaticMarkup(
      <GmpDestinationCapabilities capabilities={{
        createPage: true,
        updatePage: true,
        setSeoMetadata: false,
        setCanonicalUrl: true,
        schedulePublication: false,
      }} />,
    );

    expect(markup).toContain("Capability Matrix");
    expect(markup).toContain("Set SEO Metadata");
    expect(markup).toContain("Blocking gap");
  });

  it("renders release dependency plan", () => {
    const markup = renderToStaticMarkup(
      <GmpReleaseDependencyPlan plan={{
        items: [{ releaseItemId: "item-1", publishingPackageId: "pkg-1", dependencyReferences: [], sequence: 1, status: "COMPLETED" }],
        resolvedExecutionOrder: ["item-1"],
        parallelizableGroups: [["item-1"]],
        missingDependencies: [],
        circularDependencies: false,
        blockedDependents: [],
        sequenceConflicts: [],
        validationModelVersion: "gmp-release-dependency-plan/v1",
        executionPolicy: "SINGLE_PACKAGE",
        concurrencyPolicy: "SEQUENTIAL_TOPOLOGICAL",
      }} />,
    );

    expect(markup).toContain("Release Dependency Plan");
    expect(markup).toContain("item-1");
  });

  it("renders publication timeline entries", () => {
    const markup = renderToStaticMarkup(
      <GmpPublicationTimeline entries={[{ timestamp: "2026-07-26T10:00:00.000Z", operation: "Verification", status: "VERIFIED", actor: "admin@example.com", objectReference: "ver-1", executionReference: "exec-1", outcome: "ok" }]} />,
    );

    expect(markup).toContain("Publication Timeline");
    expect(markup).toContain("Verification");
  });

  it("renders verification normalization detail", () => {
    const markup = renderToStaticMarkup(
      <GmpVerificationDetail verification={{
        verificationStatus: "MISMATCH",
        expectedState: { title: "A" },
        remoteState: { title: "B" },
        differences: [{ key: "title" }],
        blockingDifferences: [{ key: "content_fingerprint" }],
        warnings: ["non_blocking"],
        verifiedAt: "2026-07-26T10:00:00.000Z",
        verificationModelVersion: "gmp-publication-verification/v1",
        metadata: {
          normalizationModelVersion: "gmp-publication-normalization/v1",
          normalizedExpected: { title: "A" },
          normalizedRemote: { title: "B" },
        },
      }} />,
    );

    expect(markup).toContain("Verification Detail");
    expect(markup).toContain("Expected Normalized State");
    expect(markup).toContain("content_fingerprint");
  });

  it("hides force republish for non-elevated operators", () => {
    const markup = renderToStaticMarkup(
      <GmpReconciliationDifferences
        reconciliation={{ reconciliationStatus: "DRIFT_DETECTED", driftDetected: true, driftReasons: ["content"], metadata: { resolutionState: "UNRESOLVED" }, detectedAt: "2026-07-26T10:00:00.000Z" }}
        verification={{ differences: [{ key: "content" }], blockingDifferences: [] }}
        canResolve={true}
        canForceRepublish={false}
      />,
    );

    expect(markup).toContain("Force Republish (insufficient permission)");
  });

  it("renders media diagnostics and wordpress status without credentials", () => {
    const mediaMarkup = renderToStaticMarkup(
      <GmpMediaDeliveryStatus mediaManifest={{ items: [{ mediaReferenceId: "asset-1", role: "featured", required: true, checksum: "abc", uploadStatus: "SUCCEEDED" }] }} />,
    );

    const wpMarkup = renderToStaticMarkup(
      <GmpWordpressTransportStatus detail={{
        destinationType: "WORDPRESS",
        destination: { metadata: { safeSiteIdentity: "example.com" }, configuration: { seoIntegration: "yoast" } },
        capabilityProfile: { uploadMedia: true, schedulePublication: true },
        health: { connectionHealth: { status: "HEALTHY" } },
      }} />,
    );

    expect(mediaMarkup).toContain("Media Delivery Diagnostics");
    expect(wpMarkup).toContain("WordPress Transport Status");
    expect(wpMarkup).toContain("yoast");
    expect(wpMarkup).not.toContain("password");
    expect(wpMarkup).not.toContain("Authorization");
  });

  it("renders destination detail as read-only for viewer permissions", () => {
    const markup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="destination"
        projectId="proj-1"
        destinationId="dest-1"
        permissions={{
          canManageDestinations: false,
          canValidateDestinations: false,
        }}
      />,
    );

    expect(markup).not.toContain("Validate Connection");
    expect(markup).not.toContain("Test Write Capability");
    expect(markup).not.toContain("Invalidate Credential Cache");
    expect(markup).not.toContain("Edit Non-Secret Configuration");
    expect(markup).toContain("Refresh Capabilities");
    expect(markup).toContain("Refresh Health");
  });

  it("renders operational and elevated controls according to permissions", () => {
    const releaseMarkup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="release"
        projectId="proj-1"
        releaseId="rel-1"
        permissions={{
          canRetryRelease: true,
          canApproveRelease: true,
        }}
      />,
    );

    const publicationOperatorMarkup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="publication"
        projectId="proj-1"
        publicationId="pub-1"
        canForceRepublish={false}
        permissions={{
          canRetryPublication: true,
          canExecuteRollback: true,
          canReconcilePublication: true,
        }}
      />,
    );

    const publicationAdminMarkup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="publication"
        projectId="proj-1"
        publicationId="pub-1"
        canForceRepublish
        permissions={{
          canRetryPublication: true,
          canExecuteRollback: true,
          canReconcilePublication: true,
        }}
      />,
    );

    const packageMarkup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="package"
        projectId="proj-1"
        packageId="pkg-1"
        permissions={{ canApprovePackage: true }}
      />,
    );

    expect(releaseMarkup).toContain("Retry Failed Release Items");
    expect(releaseMarkup).toContain("Approve Release");
    expect(publicationOperatorMarkup).toContain("Submit Retry");
    expect(publicationOperatorMarkup).toContain("Submit Rollback");
    expect(publicationOperatorMarkup).toContain("Force Republish (insufficient permission)");
    expect(publicationAdminMarkup).toContain("Force Republish");
    expect(packageMarkup).toContain("Approve Package");
  });

  it("hides publication mutation controls when unauthorized", () => {
    const markup = renderToStaticMarkup(
      <GmpPublishingDetailWorkspace
        mode="publication"
        projectId="proj-1"
        publicationId="pub-1"
        canForceRepublish={false}
        permissions={{
          canRetryPublication: false,
          canExecuteRollback: false,
          canReconcilePublication: false,
        }}
      />,
    );

    expect(markup).not.toContain("Submit Retry");
    expect(markup).not.toContain("Submit Rollback");
    expect(markup).toContain("Read-only reconciliation view.");
  });
});
