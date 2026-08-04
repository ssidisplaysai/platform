import { randomUUID } from "node:crypto";
import { DocumentError, type DocumentActorContext, type DocumentMetadata, type DocumentTemplate, type TenantId } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { DocumentAuditService } from "./DocumentAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function renderTemplate(templateBody: string, variables: Record<string, string | number | boolean | null>): string {
  return Object.entries(variables).reduce((content, [key, value]) => {
    const safe = value === null ? "" : String(value);
    return content.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), safe);
  }, templateBody);
}

export class DocumentTemplateService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: DocumentAuditService,
  ) {}

  listTemplates(tenantId?: TenantId): DocumentTemplate[] {
    return this.persistence.listTemplates(tenantId);
  }

  async registerTemplate(input: {
    tenantId: TenantId;
    name: string;
    format: "HTML" | "DOCX" | "PDF";
    templateBody: string;
    metadata?: DocumentMetadata;
    actor: DocumentActorContext;
  }): Promise<DocumentTemplate> {
    if (!input.tenantId || !input.name || !input.templateBody) {
      throw new DocumentError("DOCUMENT_INVALID", "missing required template fields", false, true, "HIGH");
    }

    const at = nowIso();
    const template: DocumentTemplate = {
      templateId: `document_template_${randomUUID()}`,
      tenantId: input.tenantId,
      name: input.name.trim(),
      version: 1,
      format: input.format,
      templateBody: input.templateBody,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      state.templates.push(template);
    });

    await this.audit.append({
      eventType: "DOCUMENT_TEMPLATE_REGISTERED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: `template ${template.templateId} registered`,
      details: { name: template.name, format: template.format },
    });

    return template;
  }

  async render(input: {
    tenantId: TenantId;
    templateId: string;
    variables: Record<string, string | number | boolean | null>;
  }): Promise<{ templateId: string; rendered: string; format: "HTML" | "DOCX" | "PDF" }> {
    const template = this.persistence.listTemplates(input.tenantId).find((item) => item.templateId === input.templateId);
    if (!template) {
      throw new DocumentError("TEMPLATE_NOT_FOUND", `template not found: ${input.templateId}`, false, true, "MEDIUM");
    }

    return {
      templateId: template.templateId,
      rendered: renderTemplate(template.templateBody, input.variables),
      format: template.format,
    };
  }
}
