import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, forwardOperatorMutationContext, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetFailed,
  markGlwFailedCampaignTargetDraftReady,
  reconcileGlwCampaignTargetContentReady,
  releaseExpiredGlwCampaignTargetLeases,
  requeueGlwCampaignTargetAfterPreExecutionFailure,
  reconcileGlwContentReadyTargetDraft,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  resolveGlwCampaignJobReconciliationDecision,
} from "@/modules/glw/campaign-target-reconciliation";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";
import { isOutdoorSphereCampaignScope } from "@/modules/glw/outdoor-sphere-contextual-media-policy";

function internalHeaders(
  request: NextRequest,
  organizationId: string,
  siteId: string,
): Headers {
  return forwardOperatorMutationContext(request, {
    "content-type": "application/json",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": siteId,
  });
}

function targetIdentity(target: {
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
}) {
  return {
    stateCode: target.stateCode,
    citySlug: target.citySlug ?? null,
    cityName: target.cityName ?? null,
  };
}

function asTrimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCanonicalPath(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

async function readWordPressDraftIdentity(input: {
  siteId: string;
  wordpressObjectId: string;
}) {
  const site = getSiteById(input.siteId);
  const apiBaseUrl = site?.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(site?.integrations.wordpressCredentialReference ?? null);
  if (!site || !apiBaseUrl || !credential) {
    throw new Error("DRAFT_READY_WORDPRESS_READ_AUTHORITY_REQUIRED");
  }

  const reader = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const read = await reader.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({ context: "edit", _fields: "id,status,slug,parent" }),
  });

  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
    throw new Error("DRAFT_READY_WORDPRESS_READBACK_FAILED");
  }

  const page = read.body as Record<string, unknown>;
  const wordpressObjectId = String(page.id ?? "").trim();
  const wordpressStatus = typeof page.status === "string" ? page.status.trim() : "";
  const slug = typeof page.slug === "string" ? page.slug.trim() : "";
  const parentId = String(page.parent ?? "").trim();

  if (wordpressObjectId !== input.wordpressObjectId || wordpressStatus !== "draft") {
    throw new Error("DRAFT_READY_WORDPRESS_IDENTITY_MISMATCH");
  }
  if (!slug || !/^[1-9]\d*$/.test(parentId)) {
    throw new Error("DRAFT_READY_WORDPRESS_PARENT_REQUIRED");
  }

  return {
    slug,
    parentId,
  };
}

function isOutdoorSphereTargetScope(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
}): boolean {
  return isOutdoorSphereCampaignScope({
    campaignId: input.campaignId,
    organizationId: input.organizationId,
    siteId: input.siteId,
  }) && input.productId === "prod-outdoor-digital-sphere";
}

function isExactRecoverableZeroAuthorityFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
  wordpressObjectId?: string | number | null;
  wordpressStatus?: string | null;
}): boolean {
  return job.status === "FAILED"
    && job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"
    && Boolean(job.generatedDraft)
    && !job.wordpressObjectId
    && job.wordpressStatus !== "publish";
}

function isExactRecoverableOutdoorSphereRichCompositionFailure(job: {
  status: string;
  errorCode?: string | null;
  generatedDraft?: unknown;
  wordpressObjectId?: string | number | null;
  wordpressStatus?: string | null;
}): boolean {
  return job.status === "CONTENT_READY"
    && job.errorCode === "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED"
    && Boolean(job.generatedDraft)
    && Boolean(job.wordpressObjectId)
    && job.wordpressStatus === "draft"
    && job.wordpressStatus !== "publish";
}

function isExactRecoverableCanonicalIdentityFailure(input: {
  target: {
    status: string;
    lastError?: string | null;
    wordpressObjectId?: string | number | null;
  };
  job: {
    status: string;
    externalExecutionId?: string | null;
    generatedDraft?: unknown;
    wordpressObjectId?: string | number | null;
    wordpressStatus?: string | null;
  };
}): boolean {
  return input.target.status === "failed"
    && input.target.lastError === "DRAFT_READY_CANONICAL_PATH_REQUIRED"
    && !input.target.wordpressObjectId
    && input.job.status === "COMPLETE"
    && Boolean(input.job.generatedDraft)
    && Boolean(input.job.wordpressObjectId)
    && input.job.wordpressStatus === "draft"
    && input.job.wordpressStatus !== "publish";
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      campaignId: string;
    }>;
  },
) {
  const auth = authorizeRequest(request, "schedules:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId } = await context.params;

  const body = await request.json().catch(() => null) as {
    confirm?: string;
    targetId?: string;
    jobId?: string;
    executionId?: string;
  } | null;

  if (body?.confirm !== "RECONCILE_EXISTING_DRAFT_BATCH") {
    return NextResponse.json(
      {
        error:
          "Explicit reconciliation confirmation is required.",
      },
      {
        status: 400,
      },
    );
  }

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId,
  );

  if (!campaign) {
    return NextResponse.json(
      {
        error: "Campaign was not found.",
      },
      {
        status: 404,
      },
    );
  }
  if (campaign.organizationId !== scope.organizationId || (scope.siteId && campaign.siteId !== scope.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releasedExpiredLeaseCount = releaseExpiredGlwCampaignTargetLeases(campaignId);

  const expectedTargetId = asTrimmed(body?.targetId);
  const expectedJobId = asTrimmed(body?.jobId);
  const expectedExecutionId = asTrimmed(body?.executionId);

  if (expectedTargetId && (!expectedJobId || !expectedExecutionId)) {
    return NextResponse.json({
      error: "Exact target continuation requires targetId, jobId, and executionId.",
    }, { status: 400 });
  }

  const allTargets = listGlwCampaignTargets(campaignId);
  let reconcilableTargets =
    allTargets.filter(
      (target) =>
        (
          target.status === "running"
          || target.status === "content_ready"
          || target.status === "failed"
        )
        && Boolean(target.jobId),
    );

  if (expectedTargetId) {
    const selected = allTargets.find((target) => target.targetId === expectedTargetId) ?? null;
    if (!selected || selected.campaignId !== campaignId) {
      return NextResponse.json({ error: "Selected target does not belong to the exact campaign." }, { status: 409 });
    }
    if (!selected.jobId || selected.jobId !== expectedJobId) {
      return NextResponse.json({ error: "Selected target does not match the exact existing job." }, { status: 409 });
    }
    if (selected.wordpressObjectId) {
      return NextResponse.json({ error: "Selected target already has a conflicting WordPress identity." }, { status: 409 });
    }
    const selectedJob = await glwPageExecutionRepository.getById(selected.jobId);
    if (!selectedJob) {
      return NextResponse.json({ error: "Selected target job was not found." }, { status: 409 });
    }
    if ((selectedJob.externalExecutionId ?? "") !== expectedExecutionId) {
      return NextResponse.json({ error: "Selected target execution identity does not match the exact existing execution." }, { status: 409 });
    }
    const selectedIsRecoverablePartialDraftTarget = (selected.status === "failed" || selected.status === "content_ready")
      && isExactRecoverableOutdoorSphereRichCompositionFailure(selectedJob);
    const selectedIsRecoverableFailedTarget = (selected.status === "failed" || selected.status === "content_ready" || selected.status === "running")
      && isExactRecoverableZeroAuthorityFailure(selectedJob);
    const selectedIsRecoverableCanonicalIdentityFailedTarget = isExactRecoverableCanonicalIdentityFailure({
      target: selected,
      job: selectedJob,
    });
    if (selected.status === "failed" && !selectedIsRecoverableFailedTarget && !selectedIsRecoverablePartialDraftTarget && !selectedIsRecoverableCanonicalIdentityFailedTarget) {
      return NextResponse.json({ error: "Selected failed target is not recoverable for exact continuation." }, { status: 409 });
    }
    if (selected.status === "content_ready" && selectedJob.status === "FAILED" && !selectedIsRecoverableFailedTarget && !selectedIsRecoverablePartialDraftTarget) {
      return NextResponse.json({ error: "Selected content-ready target has a failed job that is not recoverable for exact continuation." }, { status: 409 });
    }
    if (selected.status === "running" && selectedJob.status === "FAILED" && !selectedIsRecoverableFailedTarget) {
      return NextResponse.json({ error: "Selected running target has a failed job that is not recoverable for exact continuation." }, { status: 409 });
    }
    if (selected.status !== "failed" && selected.status !== "content_ready" && selected.status !== "running") {
      return NextResponse.json({ error: "Selected target is not in a continuable content-ready state." }, { status: 409 });
    }
    if (selectedJob.wordpressStatus === "publish") {
      return NextResponse.json({ error: "Published targets cannot continue through draft continuation." }, { status: 409 });
    }
    if (selectedJob.wordpressObjectId && !selectedIsRecoverablePartialDraftTarget && !selectedIsRecoverableCanonicalIdentityFailedTarget) {
      return NextResponse.json({ error: "Conflicting existing WordPress identity detected on the selected job." }, { status: 409 });
    }

    let selectedReconcilableTarget = selected;
    if (selected.status === "running" && selectedJob.status === "CONTENT_READY" && selected.leaseId) {
      try {
        const updated = reconcileGlwCampaignTargetContentReady({
          campaignId,
          targetId: selected.targetId,
          stateCode: selected.stateCode,
          citySlug: selected.citySlug,
          jobId: selected.jobId,
          leaseId: selected.leaseId,
          externalExecutionId: selectedJob.externalExecutionId ?? "",
        });
        selectedReconcilableTarget = updated.target;
      } catch {
        return NextResponse.json({
          error: "Selected target lease is still active and cannot continue until it expires.",
        }, { status: 409 });
      }
    }

    reconcilableTargets = [selectedReconcilableTarget];
  }

  const origin = request.nextUrl.origin;

  const results: Array<Record<string, unknown>> = [];

  for (const target of reconcilableTargets) {
    const jobId = target.jobId!;

    try {
      const refreshUrl = new URL(
        "/api/glw/page-generation",
        origin,
      );

      refreshUrl.searchParams.set(
        "jobId",
        jobId,
      );

      refreshUrl.searchParams.set(
        "refresh",
        "true",
      );

      const refreshResponse = await fetch(
        refreshUrl,
        {
          method: "GET",
          headers: internalHeaders(
            request,
            target.organizationId,
            target.siteId,
          ),
          cache: "no-store",
        },
      );

      const refreshPayload =
        await refreshResponse.json();

      let job = refreshPayload.job;

      if (!job) {
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "error",
          error:
            refreshPayload.error
            ?? "Recovery returned no generation job.",
        });

        continue;
      }

      let decision =
        resolveGlwCampaignJobReconciliationDecision(
          job,
        );

      const exactRecoverableFailedContinuation = Boolean(
        expectedTargetId
        && (target.status === "failed" || target.status === "content_ready" || target.status === "running")
        && target.jobId === expectedJobId
        && (job.externalExecutionId ?? "") === expectedExecutionId
        && !target.wordpressObjectId
        && isExactRecoverableZeroAuthorityFailure(job),
      );
      const exactRecoverablePartialDraftContinuation = Boolean(
        expectedTargetId
        && (target.status === "failed" || target.status === "content_ready")
        && target.jobId === expectedJobId
        && (job.externalExecutionId ?? "") === expectedExecutionId
        && isExactRecoverableOutdoorSphereRichCompositionFailure(job),
      );

      let effectiveTarget = target;

      if (decision.action === "continue" && target.status === "running" && job.status === "CONTENT_READY" && job.externalExecutionId) {
        if (expectedTargetId && (target.targetId !== expectedTargetId || target.jobId !== expectedJobId || job.externalExecutionId !== expectedExecutionId)) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "error",
            error: "Selected target execution identity does not match the exact existing execution.",
          });
          continue;
        }

        let updated;
        try {
          updated = reconcileGlwCampaignTargetContentReady({
            campaignId,
            targetId: target.targetId,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
            jobId,
            leaseId: target.leaseId ?? "",
            externalExecutionId: job.externalExecutionId,
          });
        } catch {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "error",
            error: "Selected target lease is still active and cannot continue until it expires.",
          });
          continue;
        }

        effectiveTarget = updated.target;

        if (!expectedTargetId) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "content_ready",
            targetStatus: updated.target.status,
            attemptCount: updated.target.attemptCount,
            leaseHistory: updated.leaseHistory,
          });
          continue;
        }
      }

      if (decision.action === "continue" || exactRecoverableFailedContinuation || exactRecoverablePartialDraftContinuation) {
        const { form } =
          buildGlwCampaignProductionGenerationForm({
            campaign,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
          });

        if (form.publicationIntent !== "draft") {
          throw new Error(
            "Campaign reconciliation rejected non-draft generation authority.",
          );
        }

        const continueResponse = await fetch(
          new URL(
            "/api/glw/page-generation",
            origin,
          ),
          {
            method: "POST",
            headers: internalHeaders(
              request,
              target.organizationId,
              target.siteId,
            ),
            body: JSON.stringify({
              form,
              action: "continue",
              jobId,
              targetId: effectiveTarget.targetId,
              executionId: expectedTargetId ? expectedExecutionId : (job.externalExecutionId ?? null),
            }),
            cache: "no-store",
          },
        );

        const continuePayload =
          await continueResponse.json();

        if (!continueResponse.ok || continuePayload?.ok !== true) {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: continueResponse.status,
            error:
              continuePayload.error
              ?? continuePayload.issues
              ?? "Exact job continuation did not reach durable WordPress draft persistence.",
          });

          continue;
        }

        job = continuePayload.job;

        decision =
          resolveGlwCampaignJobReconciliationDecision(
            job,
          );

        if (expectedTargetId && decision.action !== "draft_ready") {
          results.push({
            ...targetIdentity(target),
            jobId,
            action: "continue_error",
            httpStatus: 409,
            error: "Exact content-ready continuation did not produce a durable draft-ready result.",
          });
          continue;
        }
      }

      if (decision.action === "draft_ready") {
        const canonicalIdentityRequired = isOutdoorSphereTargetScope({
          campaignId,
          organizationId: campaign.organizationId,
          siteId: campaign.siteId,
          productId: campaign.productId,
        });

        let canonicalIdentity: {
          canonicalPath: string;
          applicationPath: string;
          canonicalParentId: string;
        } | undefined;

        if (canonicalIdentityRequired) {
          const { form } =
            buildGlwCampaignProductionGenerationForm({
              campaign,
              stateCode: target.stateCode,
              citySlug: target.citySlug,
            });

          const canonicalPathFromForm = normalizeCanonicalPath(form.canonicalPath ?? "");
          const canonicalPathFromJob = normalizeCanonicalPath(job.slug ?? "");
          if (!canonicalPathFromForm) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_CANONICAL_PATH_REQUIRED",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          const readback = await readWordPressDraftIdentity({
            siteId: campaign.siteId,
            wordpressObjectId: decision.wordpressObjectId,
          });
          const expectedSlug = canonicalPathFromForm.split("/").filter(Boolean).at(-1) ?? "";
          if (!expectedSlug || readback.slug !== expectedSlug) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_WORDPRESS_SLUG_MISMATCH",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          if (canonicalPathFromJob && canonicalPathFromJob !== canonicalPathFromForm) {
            const updatedFailed =
              markGlwCampaignTargetFailed({
                campaignId,
                stateCode: target.stateCode,
                citySlug: target.citySlug,
                jobId,
                error: "DRAFT_READY_CANONICAL_PATH_REQUIRED",
              });
            results.push({
              ...targetIdentity(target),
              jobId,
              action: "failed",
              error: updatedFailed.lastError,
            });
            continue;
          }

          canonicalIdentity = {
            canonicalPath: canonicalPathFromForm,
            applicationPath: canonicalPathFromForm,
            canonicalParentId: readback.parentId,
          };
        }

        const updateInput = {
          campaignId,
          stateCode: effectiveTarget.stateCode,
          citySlug: effectiveTarget.citySlug,
          jobId,
          wordpressObjectId:
            decision.wordpressObjectId,
          canonicalIdentity,
        };

        const updated =
          effectiveTarget.status === "content_ready"
            ? reconcileGlwContentReadyTargetDraft({
                ...updateInput,
                targetId: effectiveTarget.targetId,
              })
            : effectiveTarget.status === "failed"
            ? markGlwFailedCampaignTargetDraftReady(updateInput)
            : markGlwCampaignTargetDraftReady(updateInput);

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "draft_ready",
          wordpressObjectId:
            updated.wordpressObjectId,
          canonicalPath: updated.canonicalPath ?? null,
          applicationPath: updated.applicationPath ?? null,
          canonicalParentId: updated.canonicalParentId ?? null,
          executionIdAfter: job.externalExecutionId ?? null,
        });

        continue;
      }

      if (decision.action === "failed") {
        const updated =
          markGlwCampaignTargetFailed({
            campaignId,
            stateCode: target.stateCode,
            citySlug: target.citySlug,
            jobId,
            error: decision.error,
          });

        results.push({
          ...targetIdentity(target),
          jobId,
          action: "failed",
          error: updated.lastError,
        });

        continue;
      }

      if (decision.action === "requeue") {
        const updated = requeueGlwCampaignTargetAfterPreExecutionFailure({
          campaignId,
          stateCode: target.stateCode,
          citySlug: target.citySlug,
          jobId,
          error: decision.error,
        });
        results.push({
          ...targetIdentity(target),
          jobId,
          action: "requeued",
          error: updated.lastError,
        });
        continue;
      }

      results.push({
        ...targetIdentity(target),
        jobId,
        action: "wait",
        generationStatus: job.status,
      });
    }
    catch (error) {
      results.push({
        ...targetIdentity(target),
        jobId,
        action: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown reconciliation error.",
      });
    }
  }

  if (expectedTargetId) {
    const selectedResult = results[0] ?? null;
    if (!selectedResult) {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
        error: "Exact content-ready continuation failed before durable WordPress draft persistence.",
      }, { status: 409 });
    }

    if (selectedResult.action === "wait") {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
      });
    }

    if (selectedResult.action !== "draft_ready") {
      return NextResponse.json({
        campaignId,
        reconciledTargetCount: reconcilableTargets.length,
        releasedExpiredLeaseCount,
        results,
        publicationIntent: "draft",
        publicationPerformed: false,
        error: selectedResult?.error ?? "Exact content-ready continuation failed before durable WordPress draft persistence.",
      }, { status: 409 });
    }
  }

  return NextResponse.json({
    campaignId,
    reconciledTargetCount:
      reconcilableTargets.length,
    releasedExpiredLeaseCount,
    results,
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}
