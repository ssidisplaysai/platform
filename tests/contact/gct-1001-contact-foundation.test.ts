import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  ContactError,
  createGenesisContactRuntime,
  type ContactActorContext,
  type ContactPlatformDependencies,
} from "@/platform/contact";

function actor(actorId = "svc.contact"): ContactActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

function dependencies(): ContactPlatformDependencies {
  const health = async () => ({ status: "HEALTHY" as const, detail: "ok" });
  return {
    identity: {
      async resolveIdentity(actorId: string) {
        return { actorId, actorName: actorId };
      },
    },
    authorization: {
      async authorize() {
        return { allowed: true };
      },
    },
    organization: {
      async organizationExists(input) {
        return input.organizationId.startsWith("org-");
      },
    },
    messaging: { inspectHealth: health },
    workflow: { inspectHealth: health },
    scheduling: { inspectHealth: health },
    notifications: { inspectHealth: health },
    ai: { inspectHealth: health },
  };
}

describe("GCT-1001 Genesis Contact Platform foundation", () => {
  it("registers contacts and enforces duplicate contact method keys", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-methods-"));
    try {
      const runtime = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const contact = await runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Ada", legalFamilyName: "Lovelace" },
        actor: actor(),
      });

      await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: { type: "EMAIL", value: "Ada@example.com", primary: true, verified: true },
      });

      await expect(runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: contact.tenantId,
        actor: actor(),
        method: { type: "EMAIL", value: "ada@example.com" },
      })).rejects.toBeInstanceOf(ContactError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("validates organization affiliations and tenant isolation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-affiliations-"));
    try {
      const runtime = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const contact = await runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Rosa", legalFamilyName: "Diaz" },
        actor: actor(),
      });

      const affiliation = await runtime.affiliations.addAffiliation({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        organizationId: "org-sales",
        role: "CUSTOMER",
        actor: actor(),
        primary: true,
      });

      expect(affiliation.primary).toBe(true);

      await expect(runtime.affiliations.addAffiliation({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        organizationId: "bad-org",
        role: "PARTNER",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);

      await expect(runtime.affiliations.addAffiliation({
        contactId: contact.contactId,
        tenantId: "tenant-b",
        organizationId: "org-sales",
        role: "PARTNER",
        actor: actor(),
      })).rejects.toBeInstanceOf(ContactError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("captures consent and computes communication eligibility", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-consent-"));
    try {
      const runtime = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const contact = await runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Nina", legalFamilyName: "Simone" },
        actor: actor(),
      });

      await runtime.methods.addMethod({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        method: { type: "EMAIL", value: "nina@example.com", verified: true, valid: true },
      });

      await runtime.preferences.setPreference({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        channelPreferences: { EMAIL: "ALLOWED" },
      });

      await runtime.consent.captureConsent({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        type: "EMAIL_MARKETING",
        status: "GRANTED",
        actor: actor(),
      });

      const eligible = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });

      expect(eligible.eligible).toBe(true);
      expect(eligible.blockedByConsent).toBe(false);

      await runtime.consent.withdrawConsent({
        contactId: contact.contactId,
        tenantId: "tenant-a",
        type: "EMAIL_MARKETING",
        actor: actor(),
      });

      const blocked = await runtime.eligibility.evaluate({
        contactId: contact.contactId,
        channel: "EMAIL",
        actor: actor(),
      });

      expect(blocked.eligible).toBe(false);
      expect(blocked.blockedByConsent).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("merges same-tenant contacts with idempotency and rejects cross-tenant merges", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-merge-"));
    try {
      const runtime = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const source = await runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Grace", legalFamilyName: "Hopper" },
        actor: actor(),
      });
      const target = await runtime.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Rear", legalFamilyName: "Admiral" },
        actor: actor(),
      });

      const mergedA = await runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-1",
      });
      const mergedB = await runtime.merge.merge({
        sourceContactId: source.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-1",
      });

      expect(mergedA.mergeRecordId).toBe(mergedB.mergeRecordId);
      expect(runtime.registry.getContact(source.contactId)?.status).toBe("MERGED");

      const crossTenant = await runtime.registry.registerContact({
        tenantId: "tenant-b",
        organizationId: "org-b",
        type: "PERSON",
        name: { legalGivenName: "Cross", legalFamilyName: "Tenant" },
        actor: actor(),
      });

      await expect(runtime.merge.merge({
        sourceContactId: crossTenant.contactId,
        targetContactId: target.contactId,
        tenantId: "tenant-a",
        actor: actor(),
        idempotencyKey: "merge-2",
      })).rejects.toBeInstanceOf(ContactError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists contact state across runtime restarts and exposes observability", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gct-1001-persistence-"));
    try {
      const runtimeA = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const created = await runtimeA.registry.registerContact({
        tenantId: "tenant-a",
        organizationId: "org-a",
        type: "PERSON",
        name: { legalGivenName: "Persist", legalFamilyName: "Case" },
        actor: actor(),
      });

      const runtimeB = await createGenesisContactRuntime({ rootDir, dependencies: dependencies() });
      const found = runtimeB.registry.getContact(created.contactId);
      const observability = await runtimeB.observability();

      expect(found?.contactId).toBe(created.contactId);
      expect(observability.capability).toBe("platform.contact");
      expect(observability.metrics.registeredContacts).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
