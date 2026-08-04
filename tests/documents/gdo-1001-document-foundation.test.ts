import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  DocumentError,
  createGenesisDocumentRuntime,
  type DocumentActorContext,
  type DocumentPlatformDependencies,
} from "@/platform/documents";

function actor(actorId = "svc.documents"): DocumentActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

function dependencies(): DocumentPlatformDependencies {
  return {
    assets: {
      async assetExists(input) {
        return input.assetId.startsWith("asset-") || input.assetId.startsWith("asset_");
      },
    },
    organization: {
      async organizationExists(input) {
        return input.organizationId.startsWith("org-");
      },
    },
    contacts: {
      async contactExists(input) {
        return input.contactId.startsWith("contact-");
      },
    },
    workflow: {
      async canStartWorkflow() {
        return true;
      },
    },
    ai: {
      async canGenerate() {
        return true;
      },
    },
  };
}

function baseContent(title: string) {
  return {
    schemaVersion: "1.0.0" as const,
    sections: [{ sectionId: "s1", title, body: `${title} body` }],
    fields: { title },
  };
}

describe("GDO-1001 Genesis Document Platform foundation", () => {
  it("supports template rendering, revisions, approvals, signatures, metadata, lifecycle, relationships, and asset references", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gdo-1001-core-"));
    try {
      const runtime = await createGenesisDocumentRuntime({ rootDir, dependencies: dependencies() });

      const template = await runtime.templates.registerTemplate({
        tenantId: "tenant-a",
        name: "Contract Template",
        format: "HTML",
        templateBody: "Hello {{name}}, value {{amount}}",
        actor: actor(),
      });
      const rendered = await runtime.templates.render({
        tenantId: "tenant-a",
        templateId: template.templateId,
        variables: { name: "Ada", amount: 42 },
      });
      expect(rendered.rendered).toContain("Hello Ada");

      const docA = await runtime.registry.registerDocument({
        tenantId: "tenant-a",
        type: "CONTRACT",
        title: "Master Services Agreement",
        ownerOrganizationId: "org-1",
        ownerContactId: "contact-1",
        actor: actor(),
        initialContent: baseContent("MSA"),
      });

      const docB = await runtime.registry.registerDocument({
        tenantId: "tenant-a",
        type: "POLICY",
        title: "Privacy Policy",
        actor: actor(),
        initialContent: baseContent("Policy"),
      });

      const revised = await runtime.revisions.appendRevision({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        actor: actor(),
        changeSummary: "updated term section",
        content: baseContent("MSA v2"),
      });
      expect(revised.revisions.length).toBe(2);

      const reviewed = await runtime.lifecycle.transition({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        status: "IN_REVIEW",
        actor: actor(),
      });
      expect(reviewed.lifecycleStatus).toBe("IN_REVIEW");

      const approved = await runtime.approvals.transition({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        toStatus: "APPROVED",
        actor: actor(),
        reason: "policy aligned",
      });
      expect(approved.approvalStatus).toBe("APPROVED");

      const active = await runtime.lifecycle.transition({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        status: "ACTIVE",
        actor: actor(),
      });
      expect(active.lifecycleStatus).toBe("ACTIVE");

      const signed = await runtime.signatures.sign({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        signerActorId: "signer-1",
        signerName: "Signer One",
        signatureType: "APPROVAL",
        actor: actor(),
      });
      expect(signed.signatures.length).toBe(1);

      const revoked = await runtime.signatures.revoke({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        signatureId: signed.signatures[0].signatureId,
        actor: actor(),
        reason: "wrong signer",
      });
      expect(revoked.signatures[0].revokedAt).toBeDefined();

      const metadataUpdated = await runtime.metadata.replaceMetadata({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        metadata: { jurisdiction: "US", currency: "USD" },
        actor: actor(),
      });
      expect(metadataUpdated.metadata.jurisdiction).toBe("US");

      const relationship = await runtime.relationships.link({
        tenantId: "tenant-a",
        fromDocumentId: docA.documentId,
        toDocumentId: docB.documentId,
        relationshipType: "REFERENCES",
        actor: actor(),
      });
      expect(relationship.relationshipId.length).toBeGreaterThan(0);

      const reference = await runtime.assetReferences.addReference({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        assetId: "asset-1",
        role: "ATTACHMENT",
        actor: actor(),
      });
      expect(reference.assetId).toBe("asset-1");

      const generated = await runtime.generation.generateFromTemplate({
        tenantId: "tenant-a",
        documentId: docA.documentId,
        templateId: template.templateId,
        variables: { name: "Ada", amount: 42 },
        format: "PDF",
        outputAssetId: "asset-2",
        actor: actor(),
      });
      expect(generated.format).toBe("PDF");

      const observability = await runtime.observability();
      expect(observability.capability).toBe("platform.documents");
      expect(observability.metrics.documentsTotal).toBe(2);
      expect(observability.metrics.revisionsTotal).toBeGreaterThanOrEqual(3);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces approval and lifecycle transition rules and boundary checks", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gdo-1001-boundary-"));
    try {
      const runtime = await createGenesisDocumentRuntime({ rootDir, dependencies: dependencies() });

      await expect(
        runtime.registry.registerDocument({
          tenantId: "tenant-a",
          type: "CONTRACT",
          title: "Bad Owner",
          ownerOrganizationId: "bad-org",
          actor: actor(),
          initialContent: baseContent("Bad"),
        }),
      ).rejects.toBeInstanceOf(DocumentError);

      const doc = await runtime.registry.registerDocument({
        tenantId: "tenant-a",
        type: "REPORT",
        title: "Quarterly Report",
        actor: actor(),
        initialContent: baseContent("Q1"),
      });

      await expect(
        runtime.approvals.transition({
          tenantId: "tenant-a",
          documentId: doc.documentId,
          toStatus: "PENDING",
          actor: actor(),
        }),
      ).rejects.toBeInstanceOf(DocumentError);

      await expect(
        runtime.lifecycle.transition({
          tenantId: "tenant-a",
          documentId: doc.documentId,
          status: "ACTIVE",
          actor: actor(),
        }),
      ).rejects.toBeInstanceOf(DocumentError);

      await expect(
        runtime.assetReferences.addReference({
          tenantId: "tenant-a",
          documentId: doc.documentId,
          assetId: "missing-asset",
          role: "SOURCE",
          actor: actor(),
        }),
      ).rejects.toBeInstanceOf(DocumentError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists and recovers state across runtime restart", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gdo-1001-restart-"));
    try {
      const runtimeA = await createGenesisDocumentRuntime({ rootDir, dependencies: dependencies() });
      const created = await runtimeA.registry.registerDocument({
        tenantId: "tenant-a",
        type: "FORM",
        title: "Onboarding Form",
        actor: actor(),
        initialContent: baseContent("Onboarding"),
      });

      const runtimeB = await createGenesisDocumentRuntime({ rootDir, dependencies: dependencies() });
      const found = runtimeB.registry.getDocument(created.documentId);

      expect(found?.documentId).toBe(created.documentId);
      expect(runtimeB.snapshot("tenant-a").length).toBeGreaterThanOrEqual(1);
      expect((await runtimeB.observability()).health.status).toBe("HEALTHY");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
