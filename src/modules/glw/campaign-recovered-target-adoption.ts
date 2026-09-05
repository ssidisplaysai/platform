import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import type { GlwCampaignCityTarget } from "@/modules/glw/campaign-types";
import type {
  GlwCampaignTarget,
  GlwCampaignTargetStatus,
} from "@/modules/glw/campaign-target-repository";
import type { GlwPageExecutionRecord } from "@/modules/glw/page-execution";

const TARGET_PERSISTENCE_NAMESPACE = "glw-campaign-target-repository";

type RepositoryState = {
  targets: GlwCampaignTarget[];
};

export type GlwRecoveredCityTargetDisposition = {
  stateCode: string;
  citySlug: string;
  cityName: string;
  status: Extract<GlwCampaignTargetStatus, "draft_ready" | "published" | "skipped">;
  jobId: string;
  wordpressObjectId: string;
  reason: string;
};

function normalizeCitySlug(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function targetKey(
  campaignId: string,
  stateCode: string,
  citySlug: string,
): string {
  return [
    campaignId,
    stateCode.trim().toUpperCase(),
    normalizeCitySlug(citySlug),
  ].join("::");
}

function stateName(stateCode: string): string | null {
  return GLW_CAMPAIGN_US_STATES.find(
    (state) => state.code === stateCode.trim().toUpperCase(),
  )?.name ?? null;
}

function matchingExecutions(input: {
  target: GlwCampaignCityTarget;
  organizationId: string;
  siteId: string;
  productId: string;
  executions: readonly GlwPageExecutionRecord[];
}): readonly GlwPageExecutionRecord[] {
  const expectedStateName = stateName(input.target.stateCode);
  if (!expectedStateName) return [];

  return input.executions.filter(
    (record) =>
      record.organizationId === input.organizationId
      && record.siteId === input.siteId
      && record.productId === input.productId
      && record.state === expectedStateName
      && record.city === input.target.cityName
      && record.status === "COMPLETE"
      && Boolean(record.wordpressObjectId),
  );
}

export function planRecoveredCityCampaignTargetAdoption(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  cityTargets: readonly GlwCampaignCityTarget[];
  referenceTarget: {
    stateCode: string;
    citySlug: string;
  };
  executions: readonly GlwPageExecutionRecord[];
  imageRequired: boolean;
}): readonly GlwRecoveredCityTargetDisposition[] {
  const referenceKey = targetKey(
    "reference",
    input.referenceTarget.stateCode,
    input.referenceTarget.citySlug,
  );

  const dispositions: GlwRecoveredCityTargetDisposition[] = [];

  for (const target of input.cityTargets) {
    const identityKey = targetKey(
      "reference",
      target.stateCode,
      target.citySlug,
    );

    if (identityKey === referenceKey) {
      continue;
    }

    const candidates = matchingExecutions({
      target,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      executions: input.executions,
    });

    if (candidates.length === 0) {
      continue;
    }

    const wordpressObjectIds = Array.from(
      new Set(
        candidates
          .map((record) => record.wordpressObjectId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const preferred = [...candidates].sort((a, b) => {
      if (a.wordpressStatus === "publish" && b.wordpressStatus !== "publish") return -1;
      if (b.wordpressStatus === "publish" && a.wordpressStatus !== "publish") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0];

    if (!preferred?.wordpressObjectId) {
      continue;
    }

    if (wordpressObjectIds.length !== 1) {
      dispositions.push({
        stateCode: target.stateCode.trim().toUpperCase(),
        citySlug: normalizeCitySlug(target.citySlug),
        cityName: target.cityName.trim(),
        status: "skipped",
        jobId: preferred.jobId,
        wordpressObjectId: preferred.wordpressObjectId,
        reason: "Recovered local executions disagree on the WordPress object identity.",
      });
      continue;
    }

    if (preferred.wordpressStatus === "publish") {
      dispositions.push({
        stateCode: target.stateCode.trim().toUpperCase(),
        citySlug: normalizeCitySlug(target.citySlug),
        cityName: target.cityName.trim(),
        status: "published",
        jobId: preferred.jobId,
        wordpressObjectId: preferred.wordpressObjectId,
        reason: "Recovered COMPLETE local execution already identifies a published WordPress target.",
      });
      continue;
    }

    if (
      preferred.wordpressStatus === "draft"
      && preferred.qaStatus === "COMPLETE"
      && (!input.imageRequired || preferred.featuredImagePresent === true)
    ) {
      dispositions.push({
        stateCode: target.stateCode.trim().toUpperCase(),
        citySlug: normalizeCitySlug(target.citySlug),
        cityName: target.cityName.trim(),
        status: "draft_ready",
        jobId: preferred.jobId,
        wordpressObjectId: preferred.wordpressObjectId,
        reason: "Recovered COMPLETE local execution satisfies the current draft readiness gates.",
      });
      continue;
    }

    dispositions.push({
      stateCode: target.stateCode.trim().toUpperCase(),
      citySlug: normalizeCitySlug(target.citySlug),
      cityName: target.cityName.trim(),
      status: "skipped",
      jobId: preferred.jobId,
      wordpressObjectId: preferred.wordpressObjectId,
      reason: "Recovered WordPress target exists but does not satisfy the current draft readiness gates; duplicate generation is blocked.",
    });
  }

  return dispositions;
}

export function applyRecoveredCityCampaignTargetAdoption(input: {
  campaignId: string;
  dispositions: readonly GlwRecoveredCityTargetDisposition[];
}): readonly GlwCampaignTarget[] {
  if (input.dispositions.length === 0) {
    const loaded = loadPersistedState<RepositoryState>({
      namespace: TARGET_PERSISTENCE_NAMESPACE,
      seedFactory: () => ({ targets: [] }),
    });
    return loaded.state.targets
      .filter((target) => target.campaignId === input.campaignId)
      .map((target) => deepClone(target));
  }

  const loaded = loadPersistedState<RepositoryState>({
    namespace: TARGET_PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ targets: [] }),
  });

  const dispositionByKey = new Map(
    input.dispositions.map((disposition) => [
      targetKey(
        input.campaignId,
        disposition.stateCode,
        disposition.citySlug,
      ),
      disposition,
    ]),
  );

  let changed = false;
  const timestamp = new Date().toISOString();

  const targets = loaded.state.targets.map((target) => {
    if (target.campaignId !== input.campaignId || !target.citySlug) {
      return target;
    }

    const disposition = dispositionByKey.get(
      targetKey(
        target.campaignId,
        target.stateCode,
        target.citySlug,
      ),
    );

    if (!disposition) {
      return target;
    }

    if (target.status !== "queued") {
      throw new Error(
        `Recovered target adoption requires queued authority for ${target.stateCode}/${target.citySlug}.`,
      );
    }

    changed = true;
    return {
      ...target,
      status: disposition.status,
      jobId: disposition.jobId,
      wordpressObjectId: disposition.wordpressObjectId,
      attemptCount: Math.max(target.attemptCount, 1),
      lastError: disposition.status === "skipped"
        ? disposition.reason
        : null,
      leaseId: null,
      leasedAt: null,
      leaseExpiresAt: null,
      dispatchDate: null,
      updatedAt: timestamp,
    };
  });

  if (changed) {
    savePersistedState({
      namespace: TARGET_PERSISTENCE_NAMESPACE,
      state: { targets },
      expectedRevision: loaded.revision,
    });
  }

  return targets
    .filter((target) => target.campaignId === input.campaignId)
    .map((target) => deepClone(target));
}
