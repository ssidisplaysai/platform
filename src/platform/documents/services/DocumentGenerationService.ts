import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type TenantId } from "../contracts";
import type { DocumentPlatformDependencies } from "../integration";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";
import type { DocumentTemplateService } from "./DocumentTemplateService";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentGenerationService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly templates: DocumentTemplateService,
    private readonly audit: DocumentAuditService,
    private readonly dependencies: DocumentPlatformDependencies,
  ) {}

  async generateFromTemplate(input: {
    tenantId: TenantId;
    documentId: string;
    templateId: string;
    variables: Record<string, string | number | boolean | null>;
    format: "PDF" | "DOCX" | "HTML";
    outputAssetId: string;
    actor: DocumentActorContext;
  }): Promise<{ rendered: string; outputAssetId: string; generatedAt: string; format: "PDF" | "DOCX" | "HTML" }> {
    const document = this.persistence.getDocument(input.documentId);
    if (!document) {
      throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
    }
    if (document.tenantId !== input.tenantId) {
      throw new DocumentError("TENANT_MISMATCH", `tenant mismatch for ${input.documentId}`, false, true, "HIGH");
    }

    const allowed = await this.dependencies.ai.canGenerate({
      tenantId: input.tenantId,
      documentId: input.documentId,
      format: input.format,
    });
    if (!allowed) {
      throw new DocumentError("DOCUMENT_INVALID", "generation dependency rejected request", false, true, "HIGH");
    }

    const assetExists = await this.dependencies.assets.assetExists({
      assetId: input.outputAssetId,
      tenantId: input.tenantId,
    });
    if (!assetExists) {
      throw new DocumentError("DOCUMENT_INVALID", `output asset not found: ${input.outputAssetId}`, false, true, "HIGH");
    }

    const renderedTemplate = await this.templates.render({
      tenantId: input.tenantId,
      templateId: input.templateId,
      variables: input.variables,
    });

    await this.persistence.mutate((state) => {
      const liveDocument = state.documents.find((item) => item.documentId === input.documentId);
      if (!liveDocument) {
        throw new DocumentError("DOCUMENT_NOT_FOUND", `document not found: ${input.documentId}`, false, true, "MEDIUM");
      }

      const referenceId = `document_asset_ref_${randomUUID()}`;
      state.assetReferences.push({
        referenceId,
        tenantId: input.tenantId,
        documentId: input.documentId,
        assetId: input.outputAssetId,
        role: "PRIMARY_OUTPUT",
        metadata: { format: input.format, templateId: input.templateId },
        createdAt: nowIso(),
        createdBy: input.actor.actorId,
      });
      liveDocument.assetReferences.push(referenceId);
      liveDocument.updatedAt = nowIso();
      liveDocument.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "DOCUMENT_GENERATED",
      tenantId: input.tenantId,
      documentId: input.documentId,
      actor: input.actor,
      message: `document generated in format ${input.format}`,
      details: { outputAssetId: input.outputAssetId, templateId: input.templateId },
    });

    return {
      rendered: renderedTemplate.rendered,
      outputAssetId: input.outputAssetId,
      generatedAt: nowIso(),
      format: input.format,
    };
  }
}
