import type { DocumentActorContext, DocumentRecord, DocumentLifecycleStatus, TenantId } from "../contracts";
import type { DocumentRegistryService } from "./DocumentRegistryService";

export class DocumentLifecycleService {
  constructor(private readonly registry: DocumentRegistryService) {}

  async transition(input: {
    tenantId: TenantId;
    documentId: string;
    status: DocumentLifecycleStatus;
    actor: DocumentActorContext;
  }): Promise<DocumentRecord> {
    return this.registry.setLifecycleStatus(input);
  }
}
