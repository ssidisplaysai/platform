import { listCategories, listProducts } from "./product-repository";
import { listSites } from "./site-repository";
import {
  FOUNDATION_INTEGRATION_PROFILE_ASSIGNMENTS,
  FOUNDATION_INTEGRATION_PROFILES,
} from "./integration-profile-fixtures";
import { evaluateIntegrationProfileReadiness } from "./integration-profile-readiness";
import {
  validateNewIntegrationProfileInput,
  validateProfileAssignments,
  validateUpdateIntegrationProfileInput,
} from "./integration-profile-validation";
import type {
  EffectiveProfileAssignment,
  IntegrationProfileAssignmentRecord,
  IntegrationProfileAssignmentTargetType,
  IntegrationProfileConfiguration,
  IntegrationProfileListFilters,
  IntegrationProfileReadinessResult,
  IntegrationProfileType,
  IntegrationProfileUsageRecord,
  IntegrationProfileValidationResult,
  NewIntegrationProfileInput,
  UpdateIntegrationProfileInput,
} from "./types";

const profileStore = new Map<string, IntegrationProfileConfiguration>();
const assignmentStore = new Map<string, IntegrationProfileAssignmentRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function createAssignmentId(input: {
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  profileType: IntegrationProfileType;
}): string {
  return `profile-assignment-${input.organizationId}-${input.targetType}-${input.targetId}-${input.profileType}`;
}

function seedStores(): void {
  profileStore.clear();
  FOUNDATION_INTEGRATION_PROFILES.forEach((profile) => {
    profileStore.set(profile.profileId, {
      ...profile,
      assignedSiteIds: [...profile.assignedSiteIds],
      references: { ...profile.references },
    });
  });

  assignmentStore.clear();
  FOUNDATION_INTEGRATION_PROFILE_ASSIGNMENTS.forEach((assignment) => {
    assignmentStore.set(assignment.assignmentId, { ...assignment });
  });
}

seedStores();

function profileMatchesFilters(
  profile: IntegrationProfileConfiguration,
  filters: IntegrationProfileListFilters,
): boolean {
  if (filters.organizationId && profile.organizationId !== filters.organizationId) {
    return false;
  }

  if (filters.profileType && profile.profileType !== filters.profileType) {
    return false;
  }

  if (filters.status && profile.status !== filters.status) {
    return false;
  }

  if (filters.enabled !== undefined && profile.enabled !== filters.enabled) {
    return false;
  }

  if (filters.siteId && !profile.assignedSiteIds.includes(filters.siteId)) {
    return false;
  }

  if (filters.query) {
    const normalizedQuery = filters.query.toLowerCase();
    const candidateText = [
      profile.profileName,
      profile.description ?? "",
      profile.profileId,
      profile.profileType,
      ...Object.values(profile.references).filter((value): value is string => Boolean(value)),
    ]
      .join(" ")
      .toLowerCase();

    if (!candidateText.includes(normalizedQuery)) {
      return false;
    }
  }

  return true;
}

function buildProfileLookup(): Map<string, IntegrationProfileConfiguration> {
  return new Map(Array.from(profileStore.values()).map((profile) => [profile.profileId, profile]));
}

function findDirectAssignment(input: {
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  profileType: IntegrationProfileType;
}): IntegrationProfileAssignmentRecord | null {
  return (
    Array.from(assignmentStore.values()).find(
      (assignment) =>
        assignment.organizationId === input.organizationId &&
        assignment.targetType === input.targetType &&
        assignment.targetId === input.targetId &&
        assignment.profileType === input.profileType,
    ) ?? null
  );
}

function findSiteAssignment(input: {
  organizationId: string;
  siteId: string;
  profileType: IntegrationProfileType;
}): IntegrationProfileAssignmentRecord | null {
  return (
    Array.from(assignmentStore.values()).find(
      (assignment) =>
        assignment.organizationId === input.organizationId &&
        assignment.targetType === "site" &&
        assignment.targetId === input.siteId &&
        assignment.profileType === input.profileType,
    ) ?? null
  );
}

function findOrganizationDefaultProfile(
  organizationId: string,
  profileType: IntegrationProfileType,
): IntegrationProfileConfiguration | null {
  return (
    Array.from(profileStore.values()).find(
      (profile) =>
        profile.organizationId === organizationId &&
        profile.profileType === profileType &&
        profile.defaultForOrganization,
    ) ?? null
  );
}

export function listIntegrationProfiles(
  filters: IntegrationProfileListFilters = {},
): readonly IntegrationProfileConfiguration[] {
  return Array.from(profileStore.values()).filter((profile) => profileMatchesFilters(profile, filters));
}

export function listIntegrationProfileAssignments(): readonly IntegrationProfileAssignmentRecord[] {
  return Array.from(assignmentStore.values());
}

export function getIntegrationProfileById(profileId: string): IntegrationProfileConfiguration | null {
  return profileStore.get(profileId) ?? null;
}

export function createIntegrationProfile(input: NewIntegrationProfileInput): {
  validation: IntegrationProfileValidationResult;
  profile: IntegrationProfileConfiguration | null;
} {
  const validation = validateNewIntegrationProfileInput(input);
  if (!validation.valid) {
    return { validation, profile: null };
  }

  if (profileStore.has(input.profileId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "profileId", message: "Profile ID already exists." }],
      },
      profile: null,
    };
  }

  const timestamp = nowIso();
  const profile: IntegrationProfileConfiguration = {
    ...input,
    assignedSiteIds: [...input.assignedSiteIds],
    references: { ...input.references },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  profileStore.set(profile.profileId, profile);
  return { validation, profile };
}

export function updateIntegrationProfile(
  profileId: string,
  patch: UpdateIntegrationProfileInput,
): {
  validation: IntegrationProfileValidationResult;
  profile: IntegrationProfileConfiguration | null;
} {
  const existing = profileStore.get(profileId);
  if (!existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "profileId", message: "Profile not found." }],
      },
      profile: null,
    };
  }

  const validation = validateUpdateIntegrationProfileInput(existing, patch);
  if (!validation.valid) {
    return { validation, profile: null };
  }

  const updated: IntegrationProfileConfiguration = {
    ...existing,
    ...patch,
    references: {
      ...existing.references,
      ...(patch.references ?? {}),
    },
    assignedSiteIds: patch.assignedSiteIds ? [...patch.assignedSiteIds] : [...existing.assignedSiteIds],
    updatedAt: nowIso(),
  };

  profileStore.set(profileId, updated);
  return { validation, profile: updated };
}

export function evaluateProfileReadiness(profileId: string): IntegrationProfileReadinessResult | null {
  const profile = profileStore.get(profileId);
  if (!profile) {
    return null;
  }

  return evaluateIntegrationProfileReadiness({
    profile,
    profileLookup: buildProfileLookup(),
  });
}

export function evaluateAllProfileReadiness(
  filters: IntegrationProfileListFilters = {},
): readonly IntegrationProfileReadinessResult[] {
  const profileLookup = buildProfileLookup();
  return listIntegrationProfiles(filters).map((profile) =>
    evaluateIntegrationProfileReadiness({
      profile,
      profileLookup,
    }),
  );
}

export function validateProfileAssignmentIntegrity(): IntegrationProfileValidationResult {
  return validateProfileAssignments(
    listIntegrationProfileAssignments(),
    listIntegrationProfiles(),
  );
}

export function getEffectiveProfileAssignments(input: {
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  siteId: string | null;
}): readonly EffectiveProfileAssignment[] {
  const profileTypes: IntegrationProfileType[] = [
    "publishing",
    "wordpress",
    "workflow",
    "prompt",
    "image",
    "seo",
    "brand",
    "analytics",
  ];

  return profileTypes.map((profileType) => {
    const direct = findDirectAssignment({
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
      profileType,
    });

    if (direct) {
      return {
        profileType,
        directProfileId: direct.profileId,
        inheritedProfileId: null,
        effectiveProfileId: direct.profileId,
        inheritanceSource: "direct",
      };
    }

    if (input.targetType !== "site" && input.siteId) {
      const inherited = findSiteAssignment({
        organizationId: input.organizationId,
        siteId: input.siteId,
        profileType,
      });

      if (inherited) {
        return {
          profileType,
          directProfileId: null,
          inheritedProfileId: inherited.profileId,
          effectiveProfileId: inherited.profileId,
          inheritanceSource: "site",
        };
      }
    }

    const defaultProfile = findOrganizationDefaultProfile(input.organizationId, profileType);
    if (defaultProfile) {
      return {
        profileType,
        directProfileId: null,
        inheritedProfileId: defaultProfile.profileId,
        effectiveProfileId: defaultProfile.profileId,
        inheritanceSource: "organization_default",
      };
    }

    return {
      profileType,
      directProfileId: null,
      inheritedProfileId: null,
      effectiveProfileId: null,
      inheritanceSource: "none",
    };
  });
}

function listKnownUsageTargets(): readonly {
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  siteId: string | null;
}[] {
  const sites = listSites().map((site) => ({
    organizationId: site.organizationId,
    targetType: "site" as const,
    targetId: site.siteId,
    siteId: site.siteId,
  }));

  const products = listProducts().map((product) => ({
    organizationId: product.organizationId,
    targetType: "product" as const,
    targetId: product.productId,
    siteId: product.primarySiteId,
  }));

  const categories = listCategories().map((category) => ({
    organizationId: category.organizationId,
    targetType: "category" as const,
    targetId: category.categoryId,
    siteId: category.siteAssignments[0] ?? null,
  }));

  const explicit = Array.from(assignmentStore.values())
    .filter((assignment) => assignment.targetType === "page_template" || assignment.targetType === "blog_template" || assignment.targetType === "media")
    .map((assignment) => ({
      organizationId: assignment.organizationId,
      targetType: assignment.targetType,
      targetId: assignment.targetId,
      siteId: assignment.siteId,
    }));

  return [...sites, ...products, ...categories, ...explicit];
}

export function getProfileUsage(profileId: string): readonly IntegrationProfileUsageRecord[] {
  const usage: IntegrationProfileUsageRecord[] = [];

  Array.from(assignmentStore.values())
    .filter((assignment) => assignment.profileId === profileId)
    .forEach((assignment) => {
      usage.push({
        profileId,
        targetType: assignment.targetType,
        targetId: assignment.targetId,
        siteId: assignment.siteId,
        inherited: false,
      });
    });

  const inheritedTargets = listKnownUsageTargets();
  inheritedTargets.forEach((target) => {
    const effectiveAssignments = getEffectiveProfileAssignments(target);
    effectiveAssignments
      .filter(
        (assignment) =>
          assignment.effectiveProfileId === profileId &&
          assignment.inheritanceSource !== "direct",
      )
      .forEach(() => {
        const key = `${target.targetType}:${target.targetId}:${target.siteId ?? "none"}`;
        const exists = usage.some(
          (entry) =>
            entry.targetType === target.targetType &&
            entry.targetId === target.targetId &&
            entry.siteId === target.siteId,
        );

        if (!exists) {
          usage.push({
            profileId,
            targetType: target.targetType,
            targetId: target.targetId,
            siteId: target.siteId,
            inherited: true,
          });
        }

        void key;
      });
  });

  return usage;
}

export function upsertProfileAssignment(input: {
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  siteId: string | null;
  profileType: IntegrationProfileType;
  profileId: string;
  notes: string | null;
}): {
  validation: IntegrationProfileValidationResult;
  assignment: IntegrationProfileAssignmentRecord | null;
} {
  const profile = profileStore.get(input.profileId);
  if (!profile) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "profileId", message: "Profile not found." }],
      },
      assignment: null,
    };
  }

  if (profile.organizationId !== input.organizationId) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "organizationId", message: "Organization scope violation." }],
      },
      assignment: null,
    };
  }

  if (profile.profileType !== input.profileType) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "profileType", message: "Profile type mismatch for assignment." }],
      },
      assignment: null,
    };
  }

  const existingDirect = findDirectAssignment({
    organizationId: input.organizationId,
    targetType: input.targetType,
    targetId: input.targetId,
    profileType: input.profileType,
  });

  if (existingDirect) {
    assignmentStore.delete(existingDirect.assignmentId);
  }

  const assignmentId = createAssignmentId(input);
  const timestamp = nowIso();
  const existing = assignmentStore.get(assignmentId);

  const assignment: IntegrationProfileAssignmentRecord = {
    assignmentId,
    organizationId: input.organizationId,
    targetType: input.targetType,
    targetId: input.targetId,
    siteId: input.siteId,
    profileType: input.profileType,
    profileId: input.profileId,
    inherited: false,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    notes: input.notes,
  };

  assignmentStore.set(assignmentId, assignment);
  return {
    validation: { valid: true, issues: [] },
    assignment,
  };
}

export function resetIntegrationProfileRepositoryForTests(): void {
  seedStores();
}
