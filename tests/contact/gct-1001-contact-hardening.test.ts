import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, jest } from "@jest/globals";
import {
  ContactError,
  FileContactStore,
  createDefaultContactPersistedState,
  createGenesisContactRuntime,
  type ContactActorContext,
  type ContactPersistedState,
  type ContactPlatformDependencies,
  type ContactStore,
} from "@/platform/contact";

function actor(actorId = "svc.contact"): ContactActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

function createDependencies(options?: {
  tenantExists?: (tenantId: string) => boolean;
  organizationExists?: (tenantId: string, organizationId: string) => boolean;
}) {
  const dependencyCalls = {
    identity: 0,
    authorization: 0,
    organizationExists: 0,
    messagingHealth: 0,
    workflowHealth: 0,
    schedulingHealth: 0,
    notificationsHealth: 0,
    aiHealth: 0,
  };

  const tenantExists = options?.tenantExists ?? ((tenantId: string) => tenantId.startsWith("tenant-"));
  const organizationExists = options?.organizationExists ?? ((tenantId: string, organizationId: string) => {
    if (organizationId === "org-cross") {
      return tenantId === "tenant-b";
    }
    return organizationId.startsWith("org-");
  });

  const dependencies: ContactPlatformDependencies = {
    identity: {
      async resolveIdentity(actorId: string) {
        dependencyCalls.identity += 1;
        return { actorId, actorName: actorId };
      },
    },
    authorization: {
      async authorize(input) {
        dependencyCalls.authorization += 1;
        if (!tenantExists(input.tenantId)) {
          return { allowed: false, reason: "tenant not recognized" };
        }
        return { allowed: true };
      },
    },
    organization: {
      async organizationExists(input) {
        dependencyCalls.organizationExists += 1;
        return organizationExists(input.tenantId, input.organizationId);
      },
    },
    messaging: {
      async inspectHealth() {
        dependencyCalls.messagingHealth += 1;
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    },
    workflow: {
      async inspectHealth() {
        dependencyCalls.workflowHealth += 1;
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    },
    scheduling: {
      async inspectHealth() {
        dependencyCalls.schedulingHealth += 1;
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    },
    notifications: {
      async inspectHealth() {
        dependencyCalls.notificationsHealth += 1;
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    },
    ai: {
      async inspectHealth() {
        dependencyCalls.aiHealth += 1;
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    },
  };

  return { dependencies, dependencyCalls };
}

async function runtimeFor(rootDir: string, options?: {
  tenantExists?: (tenantId: string) => boolean;
  organizationExists?: (tenantId: string, organizationId: string) => boolean;
  store?: ContactStore;
}) {
  const setup = createDependencies({
    tenantExists: options?.tenantExists,
    organizationExists: options?.organizationExists,
  });
  const runtime = await createGenesisContactRuntime({
    rootDir,
    dependencies: setup.dependencies,
    store: options?.store,
  });
  return { runtime, dependencyCalls: setup.dependencyCalls };
}

async function registerDefaultContact(runtime: Awaited<ReturnType<typeof createGenesisContactRuntime>>, input?: {
  tenantId?: string;
  organizationId?: string;
  name?: { given: string; family: string };
}) {
  return runtime.registry.registerContact({
    tenantId: input?.tenantId ?? "tenant-a",
    organizationId: input?.organizationId ?? "org-a",
    type: "PERSON",
    name: {
      legalGivenName: input?.name?.given ?? "Case",
      legalFamilyName: input?.name?.family ?? "Contact",
    },
    actor: actor(),
  });
}

describe("GCT-1001 contact hardening matrix", () => {
  it("validates tenant and organization references during registration", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-tenant-org-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      await expect(runtime.registry.registerContact({
        tenantId: "unknown",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Bad", legalFamilyName: "Tenant" },
        actor: actor(),
      })).rejects.toThrow("tenant not recognized");

      await expect(runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "invalid",
        type: "PERSON",
        name: { legalGivenName: "Bad", legalFamilyName: "Org" },
        actor: actor(),
      })).rejects.toThrow("organization reference invalid");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("prevents duplicate contact IDs and supports metadata/settings updates", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-registry-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const created = await runtime.registry.registerContact({
        contactId: "contact-fixed",
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "A", legalFamilyName: "B" },
        actor: actor(),
      });

      await expect(runtime.registry.registerContact({
        contactId: "contact-fixed",
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "C", legalFamilyName: "D" },
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      const updated = await runtime.registry.updateContact({
        contactId: created.contactId,
        tenantId: created.tenantId,
        actor: actor("svc.update"),
        metadata: { owner: "team-a" },
        settings: { outreachEnabled: true },
      });

      expect(updated.metadata.owner).toBe("team-a");
      expect(updated.settings.outreachEnabled).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("normalizes methods, enforces duplicates, and preserves primary uniqueness", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-methods-hardening-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const contact = await registerDefaultContact(runtime);

      const emailA = await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "EMAIL",
          value: "  USER@Example.COM ",
          primary: true,
          verified: false,
          valid: true,
          effectiveFrom: "2026-01-01T00:00:00.000Z",
        },
      });

      const emailB = await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "EMAIL",
          value: "other@example.com",
          primary: true,
          verified: true,
          valid: true,
          effectiveTo: "2026-12-31T23:59:59.999Z",
        },
      });

      const phone = await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "PHONE",
          value: "+1 (555) 010-2000",
          verified: false,
          valid: true,
        },
      });

      expect(emailA.type === "EMAIL" ? emailA.email.normalizedValue : "").toBe("user@example.com");
      expect(phone.type === "PHONE" ? phone.phone.normalizedValue : "").toBe("+15550102000");

      await expect(runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "EMAIL",
          value: "user@example.com",
        },
      })).rejects.toBeInstanceOf(ContactError);

      await expect(runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "PHONE",
          value: "+1 555 010 2000",
        },
      })).rejects.toBeInstanceOf(ContactError);

      const current = runtime.registry.getContact(contact.contactId);
      const primaryEmails = current?.methods.filter((item) => item.type === "EMAIL" && item.email.primary) ?? [];
      expect(primaryEmails).toHaveLength(1);
      expect(primaryEmails[0].type === "EMAIL" ? primaryEmails[0].email.methodId : "").toBe(
        emailB.type === "EMAIL" ? emailB.email.methodId : "",
      );

      await runtime.methods.setPrimaryMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        methodId: emailA.type === "EMAIL" ? emailA.email.methodId : "",
        actor: actor("svc.primary"),
      });
      await runtime.methods.setVerification({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        methodId: phone.type === "PHONE" ? phone.phone.methodId : "",
        verified: true,
        actor: actor("svc.verify"),
      });
      await runtime.methods.setValidity({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        methodId: phone.type === "PHONE" ? phone.phone.methodId : "",
        valid: false,
        actor: actor("svc.validity"),
      });

      const refreshed = runtime.registry.getContact(contact.contactId);
      const refreshedPrimary = refreshed?.methods.filter((item) => item.type === "EMAIL" && item.email.primary) ?? [];
      expect(refreshedPrimary).toHaveLength(1);
      expect(refreshedPrimary[0].type === "EMAIL" ? refreshedPrimary[0].email.methodId : "").toBe(
        emailA.type === "EMAIL" ? emailA.email.methodId : "",
      );

      const updatedPhone = refreshed?.methods.find((item) => item.type === "PHONE");
      expect(updatedPhone?.type === "PHONE" ? updatedPhone.phone.verified : false).toBe(true);
      expect(updatedPhone?.type === "PHONE" ? updatedPhone.phone.valid : true).toBe(false);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("captures consent lifecycle and deterministic eligibility outcomes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-consent-hardening-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const contact = await registerDefaultContact(runtime);
      const email = await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: { type: "EMAIL", value: "eligibility@example.com", verified: false, valid: true },
      });

      await runtime.preferences.setPreference({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        channelPreferences: { EMAIL: "ALLOWED" },
        preferredLanguage: "en-US",
      });

      const deniedBeforeVerification = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });
      expect(deniedBeforeVerification.eligible).toBe(false);

      await runtime.methods.setVerification({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        methodId: email.type === "EMAIL" ? email.email.methodId : "",
        verified: true,
        actor: actor(),
      });

      const granted = await runtime.consent.captureConsent({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        type: "EMAIL_MARKETING",
        status: "GRANTED",
        jurisdiction: "US-CA",
        captureSource: "web-form",
        evidenceReference: "evidence:consent:1",
        actor: actor(),
      });

      await runtime.methods.attachConsentReference({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        methodId: email.type === "EMAIL" ? email.email.methodId : "",
        consentRecordId: granted.consentRecordId,
        actor: actor(),
      });

      const allowed = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });
      const allowedRepeat = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });
      expect(allowed.eligible).toBe(true);
      expect({ ...allowed, evaluatedAt: "stable" }).toEqual({ ...allowedRepeat, evaluatedAt: "stable" });

      await runtime.consent.withdrawConsent({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        type: "EMAIL_MARKETING",
        actor: actor(),
        evidenceReference: "evidence:consent:withdrawal",
      });

      await expect(runtime.consent.withdrawConsent({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        type: "EMAIL_MARKETING",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      const blockedAfterWithdrawal = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });
      expect(blockedAfterWithdrawal.eligible).toBe(false);

      const postal = await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: {
          type: "POSTAL",
          line1: "1 Main St",
          city: "Nashville",
          countryCode: "US",
          valid: true,
        },
      });
      expect(postal.type).toBe("POSTAL");

      const grantedProcessing = await runtime.consent.captureConsent({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        type: "DATA_PROCESSING",
        status: "GRANTED",
        expiresAt: "2001-01-01T00:00:00.000Z",
        actor: actor(),
      });
      expect(grantedProcessing.status).toBe("GRANTED");

      const postalDeniedByExpired = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "POSTAL",
        actor: actor(),
      });
      expect(postalDeniedByExpired.eligible).toBe(false);
      expect(postalDeniedByExpired.reasons).toContain("consent_expired");

      const expired = await runtime.consent.expireConsent({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        type: "DATA_PROCESSING",
        actor: actor(),
      });
      expect(expired.status).toBe("EXPIRED");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces lifecycle transitions and merge-target policies with audit evidence", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-lifecycle-hardening-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const source = await registerDefaultContact(runtime, { name: { given: "Life", family: "Cycle" } });
      const target = await registerDefaultContact(runtime, { name: { given: "Merge", family: "Target" } });

      const validFromActive = ["INACTIVE", "ARCHIVED", "BLOCKED", "DECEASED"] as const;
      for (const to of validFromActive) {
        const active = await runtime.registry.updateContact({
          contactId: source.contactId,
          tenantId: source.tenantId,
          actor: actor(),
          status: "ACTIVE",
        });
        expect(active.status).toBe("ACTIVE");

        const transitioned = await runtime.lifecycle.transition({
          contactId: source.contactId,
          tenantId: source.tenantId,
          to,
          actor: actor("svc.lifecycle"),
        });
        expect(transitioned.status).toBe(to);
      }

      await expect(runtime.lifecycle.transition({
        contactId: source.contactId,
        tenantId: source.tenantId,
        to: "MERGED",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      await expect(runtime.lifecycle.transition({
        contactId: source.contactId,
        tenantId: source.tenantId,
        to: "MERGED",
        mergeTargetContactId: "missing-target",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      await runtime.registry.updateContact({
        contactId: source.contactId,
        tenantId: source.tenantId,
        actor: actor(),
        status: "ACTIVE",
      });

      const merged = await runtime.lifecycle.transition({
        contactId: source.contactId,
        tenantId: source.tenantId,
        to: "MERGED",
        mergeTargetContactId: target.contactId,
        actor: actor(),
      });
      expect(merged.status).toBe("MERGED");

      await expect(runtime.registry.reactivateContact(source.contactId, source.tenantId, actor())).rejects.toBeInstanceOf(ContactError);

      const archived = await runtime.registry.updateContact({
        contactId: target.contactId,
        tenantId: target.tenantId,
        actor: actor(),
        status: "ARCHIVED",
      });
      expect(archived.status).toBe("ARCHIVED");
      expect(runtime.registry.getContact(target.contactId)?.status).toBe("ARCHIVED");

      const audit = runtime.audit.list(200);
      expect(audit.some((item) => item.message.includes("lifecycle transition"))).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces affiliation tenant boundaries and preserves organization ownership", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-affiliation-hardening-"));
    try {
      const orgState = {
        ownedBy: "organization-platform",
        map: new Map<string, { tenantId: string }>([
          ["org-a", { tenantId: "tenant-a" }],
          ["org-b", { tenantId: "tenant-b" }],
        ]),
      };

      const { runtime, dependencyCalls } = await runtimeFor(rootDir, {
        organizationExists: (tenantId, organizationId) => {
          const row = orgState.map.get(organizationId);
          return Boolean(row && row.tenantId === tenantId);
        },
      });

      const contact = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      const beforeOwnership = orgState.ownedBy;

      await runtime.affiliations.addAffiliation({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        organizationId: "org-a",
        role: "CUSTOMER",
        actor: actor(),
      });

      await expect(runtime.affiliations.addAffiliation({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        organizationId: "org-b",
        role: "CUSTOMER",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      expect(orgState.ownedBy).toBe(beforeOwnership);
      expect(dependencyCalls.organizationExists).toBeGreaterThanOrEqual(2);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("provides deterministic dedup scoring with tenant isolation and false-positive boundaries", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-dedup-hardening-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const base = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a", name: { given: "Dora", family: "Lane" } });
      const candidate = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a", name: { given: "Dora", family: "Lane" } });
      await registerDefaultContact(runtime, { tenantId: "tenant-b", organizationId: "org-b", name: { given: "Dora", family: "Lane" } });

      await runtime.methods.addMethod({
        contactId: base.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "dup@example.com", verified: true, valid: true },
      });
      await runtime.methods.addMethod({
        contactId: candidate.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "dup@example.com", verified: true, valid: true },
      });
      await runtime.identity.linkIdentity({
        contactId: base.contactId,
        tenantId: "tenant-a",
        identityProvider: "crm",
        subjectId: "123",
        externalIdentifier: "EXT-1",
        actor: actor(),
      });
      await runtime.identity.linkIdentity({
        contactId: candidate.contactId,
        tenantId: "tenant-a",
        identityProvider: "crm",
        subjectId: "123",
        externalIdentifier: "EXT-1",
        actor: actor(),
      });

      const first = await runtime.deduplication.detectCandidates({ contactId: base.contactId, tenantId: "tenant-a" });
      const second = await runtime.deduplication.detectCandidates({ contactId: base.contactId, tenantId: "tenant-a" });
      expect(first).toEqual(second);
      expect(first[0]?.reasons).toContain("shared_normalized_email");
      expect(first[0]?.reasons).toContain("shared_identity_link");
      expect(first[0]?.reasons).toContain("shared_external_identifier");

      const tenantBMatches = await runtime.deduplication.detectCandidates({ contactId: base.contactId, tenantId: "tenant-b" });
      expect(tenantBMatches).toHaveLength(0);

      const statusBefore = runtime.registry.getContact(base.contactId)?.status;
      await runtime.deduplication.detectCandidates({ contactId: base.contactId, tenantId: "tenant-a" });
      expect(runtime.registry.getContact(base.contactId)?.status).toBe(statusBefore);

      const lowSignal = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a", name: { given: "Dora", family: "Lane" } });
      const falsePositive = await runtime.deduplication.detectCandidates({
        contactId: lowSignal.contactId,
        tenantId: "tenant-a",
        threshold: 50,
      });
      expect(falsePositive).toHaveLength(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("merges contacts safely with conflict handling, idempotency rejection, and data preservation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-merge-hardening-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const source = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      const target = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      const otherTenant = await registerDefaultContact(runtime, { tenantId: "tenant-b", organizationId: "org-b" });

      await runtime.methods.addMethod({
        contactId: source.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "source@example.com", verified: true, valid: true },
      });
      await runtime.methods.addMethod({
        contactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "PHONE", value: "+1 777 000 0000", verified: true, valid: true },
      });
      await runtime.affiliations.addAffiliation({
        contactId: source.contactId,
        tenantId: "tenant-a",
        organizationId: "org-a",
        role: "CUSTOMER",
        actor: actor(),
      });
      await runtime.preferences.setPreference({
        contactId: source.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        channelPreferences: { EMAIL: "ALLOWED" },
      });
      await runtime.consent.captureConsent({
        contactId: source.contactId,
        tenantId: "tenant-a",
        type: "EMAIL_MARKETING",
        status: "GRANTED",
        actor: actor(),
      });

      await expect(runtime.merge.merge({
        sourceContactId: otherTenant.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "cross-tenant-reject",
      })).rejects.toBeInstanceOf(ContactError);

      const mergedA = await runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-idempotent-1",
      });
      await expect(runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-idempotent-1",
      })).rejects.toBeInstanceOf(ContactError);
      expect(mergedA.mergeRecordId.length).toBeGreaterThan(0);

      const mergedSource = runtime.registry.getContact(source.contactId);
      const mergedTarget = runtime.registry.getContact(target.contactId);
      expect(mergedSource?.status).toBe("MERGED");
      expect(mergedTarget?.methods.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(mergedTarget?.affiliations.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(mergedTarget?.preferences.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(mergedTarget?.consentHistory.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(mergedTarget?.mergeHistory.length ?? 0).toBeGreaterThanOrEqual(1);

      const conflictSource = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      const conflictTarget = await registerDefaultContact(runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      await runtime.methods.addMethod({
        contactId: conflictSource.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "conflict@example.com", verified: true, valid: true },
      });
      await runtime.methods.addMethod({
        contactId: conflictTarget.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "conflict@example.com", verified: true, valid: true },
      });

      await expect(runtime.merge.merge({
        sourceContactId: conflictSource.contactId,
        targetContactId: conflictTarget.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-conflict",
      })).rejects.toBeInstanceOf(ContactError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists idempotency across restart, rejects duplicate merge, and records audit and metrics evidence", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-merge-idempotency-restart-"));
    try {
      const first = await runtimeFor(rootDir);
      const source = await registerDefaultContact(first.runtime, { tenantId: "tenant-a", organizationId: "org-a" });
      const target = await registerDefaultContact(first.runtime, { tenantId: "tenant-a", organizationId: "org-a" });

      await first.runtime.methods.addMethod({
        contactId: source.contactId,
        tenantId: source.tenantId,
        actor: actor(),
        method: { type: "EMAIL", value: "source-restart@example.com", verified: true, valid: true },
      });

      const idempotencyKey = "merge-restart-key-1";
      const merged = await first.runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey,
      });
      expect(merged.mergeRecordId.length).toBeGreaterThan(0);

      const restarted = await runtimeFor(rootDir);
      await expect(restarted.runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey,
      })).rejects.toBeInstanceOf(ContactError);

      const audit = restarted.runtime.audit.list(300);
      expect(audit.some((item) => item.eventType === "MERGE_IDEMPOTENCY_REJECTED")).toBe(true);

      const metrics = restarted.runtime.metrics.snapshot();
      expect(metrics.mergeIdempotencyRecords).toBeGreaterThanOrEqual(1);
      expect(metrics.mergeIdempotencyRejections).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("cleans up expired idempotency keys and keeps deterministic lookup behavior", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-merge-idempotency-cleanup-"));
    try {
      const boot = await runtimeFor(rootDir, {});
      const statePath = join(rootDir, "contact", "contact-state.v1.json");
      const snapshot = boot.runtime.coordinator.snapshot();
      snapshot.mergeIdempotencyRecords.push({
        idempotencyKey: "expired-idempotency-key",
        tenantId: "tenant-a",
        sourceContactId: "contact-source",
        targetContactId: "contact-target",
        mergeRecordId: "merge-expired",
        createdAt: "2020-01-01T00:00:00.000Z",
        expiresAt: "2020-01-01T00:00:01.000Z",
      });
      await writeFile(statePath, JSON.stringify(snapshot, null, 2), "utf8");

      const restarted = await runtimeFor(rootDir);
      const metricsAfterLoad = restarted.runtime.metrics.snapshot();
      expect(metricsAfterLoad.mergeIdempotencyRecords).toBe(0);
      expect(metricsAfterLoad.mergeIdempotencyExpiredCleanups).toBeGreaterThanOrEqual(1);

      const cleanupCount = await restarted.runtime.coordinator.cleanupExpiredMergeIdempotencyRecords();
      expect(cleanupCount).toBe(0);
      expect(restarted.runtime.coordinator.findMergeIdempotencyRecord({
        idempotencyKey: "expired-idempotency-key",
        tenantId: "tenant-a",
        sourceContactId: "contact-source",
        targetContactId: "contact-target",
      })).toBeUndefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed on corrupt persistence and maintains continuity on valid restart", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-recovery-hardening-"));
    try {
      const valid = await runtimeFor(rootDir);
      const contact = await registerDefaultContact(valid.runtime);
      await valid.runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: { type: "EMAIL", value: "persist@example.com", verified: true, valid: true },
      });

      const restarted = await runtimeFor(rootDir);
      expect(restarted.runtime.registry.getContact(contact.contactId)?.contactId).toBe(contact.contactId);
      expect(restarted.runtime.audit.list(100).length).toBeGreaterThan(0);
      expect(restarted.runtime.metrics.snapshot().registeredContacts).toBeGreaterThanOrEqual(1);

      const statePath = join(rootDir, "contact", "contact-state.v1.json");
      const duplicateState: ContactPersistedState = createDefaultContactPersistedState();
      duplicateState.contacts.push(
        {
          contactId: "dup",
          tenantId: "tenant-a",
          organizationId: "org-a",
          type: "PERSON",
          status: "ACTIVE",
          personName: {
            legalGivenName: "A",
            legalFamilyName: "B",
            displayName: "A B",
            normalizedFullName: "a b",
          },
          classifications: [],
          methods: [],
          affiliations: [],
          preferences: [],
          consentHistory: [],
          identityLinks: [],
          mergeHistory: [],
          metadata: {},
          settings: {},
          createdAt: new Date().toISOString(),
          createdBy: "seed",
          updatedAt: new Date().toISOString(),
          updatedBy: "seed",
          version: 1,
          versionHistory: [{ version: 1, changedAt: new Date().toISOString(), actorId: "seed", changeSummary: "seed" }],
        },
        {
          contactId: "dup",
          tenantId: "tenant-a",
          organizationId: "org-a",
          type: "PERSON",
          status: "ACTIVE",
          personName: {
            legalGivenName: "C",
            legalFamilyName: "D",
            displayName: "C D",
            normalizedFullName: "c d",
          },
          classifications: [],
          methods: [],
          affiliations: [],
          preferences: [],
          consentHistory: [],
          identityLinks: [],
          mergeHistory: [],
          metadata: {},
          settings: {},
          createdAt: new Date().toISOString(),
          createdBy: "seed",
          updatedAt: new Date().toISOString(),
          updatedBy: "seed",
          version: 1,
          versionHistory: [{ version: 1, changedAt: new Date().toISOString(), actorId: "seed", changeSummary: "seed" }],
        },
      );
      await writeFile(statePath, JSON.stringify(duplicateState, null, 2), "utf8");

      await expect(runtimeFor(rootDir)).rejects.toBeInstanceOf(ContactError);

      const crossTenantState: ContactPersistedState = createDefaultContactPersistedState();
      crossTenantState.contacts.push({
        contactId: "cross-1",
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        status: "ACTIVE",
        personName: {
          legalGivenName: "X",
          legalFamilyName: "Y",
          displayName: "X Y",
          normalizedFullName: "x y",
        },
        classifications: [],
        methods: [],
        affiliations: [
          {
            affiliationId: "aff-1",
            contactId: "cross-1",
            tenantId: "tenant-b",
            organizationId: "org-b",
            role: "CUSTOMER",
            primary: true,
          },
        ],
        preferences: [],
        consentHistory: [],
        identityLinks: [],
        mergeHistory: [],
        metadata: {},
        settings: {},
        createdAt: new Date().toISOString(),
        createdBy: "seed",
        updatedAt: new Date().toISOString(),
        updatedBy: "seed",
        version: 1,
        versionHistory: [{ version: 1, changedAt: new Date().toISOString(), actorId: "seed", changeSummary: "seed" }],
      });
      await writeFile(statePath, JSON.stringify(crossTenantState, null, 2), "utf8");

      await expect(runtimeFor(rootDir)).rejects.toBeInstanceOf(ContactError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("surfaces audit persistence failure and evaluates subsystem health boundaries", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-audit-health-"));
    try {
      let state = createDefaultContactPersistedState();
      const failingStore: ContactStore = {
        async load() {
          return structuredClone(state);
        },
        async save(next) {
          if (next.audits.length > 0) {
            throw new Error("forced_audit_save_failure");
          }
          state = structuredClone(next);
        },
      };

      const { runtime, dependencyCalls } = await runtimeFor(rootDir, { store: failingStore });
      await expect(registerDefaultContact(runtime)).rejects.toBeInstanceOf(ContactError);

      const health = await runtime.health.snapshot();
      expect(health.checks.some((item) => item.name === "configuration")).toBe(true);
      expect(dependencyCalls.messagingHealth).toBeGreaterThan(0);
      expect(dependencyCalls.workflowHealth).toBeGreaterThan(0);
      expect(dependencyCalls.schedulingHealth).toBeGreaterThan(0);
      expect(dependencyCalls.notificationsHealth).toBeGreaterThan(0);
      expect(dependencyCalls.aiHealth).toBeGreaterThan(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps contact behavior deterministic for same-tenant repeated operations", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-determinism-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      const contact = await registerDefaultContact(runtime);

      await runtime.classifications.addClassification({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        classification: "CUSTOMER",
        actor: actor(),
      });
      await runtime.classifications.addClassification({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        classification: "CUSTOMER",
        actor: actor(),
      });

      const snapshotA = runtime.registry.getContact(contact.contactId);
      const snapshotB = runtime.registry.getContact(contact.contactId);
      expect(snapshotA).toEqual(snapshotB);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exposes mission control compatibility via contact observability contract", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-observability-contract-"));
    try {
      const { runtime } = await runtimeFor(rootDir);
      await registerDefaultContact(runtime);

      const observability = await runtime.observability();
      expect(observability.capability).toBe("platform.contact");
      expect(observability.metadata.contractVersion).toBe("1.0.0");
      expect(typeof observability.metrics.registeredContacts).toBe("number");
      expect(observability.health.status === "HEALTHY" || observability.health.status === "DEGRADED").toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
