import "server-only";

import { companies } from "@/data/companies/companies";
import type { Company, CompanyStatus } from "@/types/models/Company";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";

const PERSISTENCE_NAMESPACE = "organization-repository";
const DEFAULT_MODULES: readonly string[] = ["dashboard", "projects"];
const DEFAULT_ACCENT_COLOR = "#ef4444";

type OrganizationRepositoryState = {
  organizations: Company[];
};

type NewOrganizationInput = {
  id: string;
  name: string;
  status: CompanyStatus;
  shortName?: string | null;
  description?: string | null;
  slug?: string | null;
  accentColor?: string | null;
  modules?: readonly string[];
};

const organizationStore = new Map<string, Company>();
let stateRevision = 0;

function nowIsoName(value: string): string {
  return value.trim();
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createSeedState(): OrganizationRepositoryState {
  return {
    organizations: companies.map((company) => deepClone(company)),
  };
}

function applyState(state: OrganizationRepositoryState): void {
  organizationStore.clear();
  state.organizations.forEach((organization) => {
    organizationStore.set(organization.id, deepClone(organization));
  });
}

function snapshotState(): OrganizationRepositoryState {
  return {
    organizations: Array.from(organizationStore.values()).map((organization) => deepClone(organization)),
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<OrganizationRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<OrganizationRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

loadStateFromPersistence();

function normalizeModules(value: readonly string[] | undefined): readonly string[] {
  if (!value || value.length === 0) {
    return [...DEFAULT_MODULES];
  }
  const normalized = value
    .map((module) => module.trim())
    .filter((module) => module.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...DEFAULT_MODULES];
}

export function listOrganizations(): readonly Company[] {
  loadStateFromPersistence();
  return Array.from(organizationStore.values()).map((organization) => deepClone(organization));
}

export function getOrganizationById(organizationId: string): Company | null {
  loadStateFromPersistence();
  return organizationStore.get(organizationId) ?? null;
}

export function createOrganization(input: NewOrganizationInput): {
  organization: Company | null;
  issues: Array<{ field: string; message: string }>;
} {
  loadStateFromPersistence();

  const id = toSlug(input.id);
  const name = nowIsoName(input.name);
  const slug = toSlug(input.slug ?? id);
  const shortName = nowIsoName(input.shortName ?? name).slice(0, 64);
  const description = nowIsoName(input.description ?? `${name} organization.`);
  const modules = normalizeModules(input.modules);
  const status = input.status;

  const issues: Array<{ field: string; message: string }> = [];

  if (!id) issues.push({ field: "id", message: "Organization ID is required." });
  if (!name) issues.push({ field: "name", message: "Organization display name is required." });
  if (status !== "active") {
    issues.push({ field: "status", message: "Only active organizations can be created through this operator path." });
  }
  if (!slug) issues.push({ field: "slug", message: "Organization slug is required." });

  if (organizationStore.has(id)) {
    issues.push({ field: "id", message: "Organization ID already exists." });
  }

  const existingSlug = Array.from(organizationStore.values()).find((organization) => organization.slug === slug);
  if (existingSlug) {
    issues.push({ field: "slug", message: "Organization slug already exists." });
  }

  if (issues.length > 0) {
    return { organization: null, issues };
  }

  const organization: Company = {
    id,
    slug,
    name,
    shortName,
    description,
    status,
    accentColor: input.accentColor?.trim() || DEFAULT_ACCENT_COLOR,
    modules,
  };

  organizationStore.set(organization.id, organization);
  persistCurrentState();
  return { organization, issues: [] };
}

export function reloadOrganizationRepositoryFromPersistence(): void {
  loadStateFromPersistence();
}

export function resetOrganizationRepositoryForTests(): void {
  const reset = resetPersistedState<OrganizationRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
}
