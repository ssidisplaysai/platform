import type { DocumentActorContext, DocumentMetadata, DocumentRecord, TenantId } from "../contracts";
import type { DocumentRegistryService } from "./DocumentRegistryService";

export class DocumentMetadataService {
  constructor(private readonly registry: DocumentRegistryService) {}

  async replaceMetadata(input: {
    tenantId: TenantId;
    documentId: string;
    metadata: DocumentMetadata;
    actor: DocumentActorContext;
  }): Promise<DocumentRecord> {
    return this.registry.updateMetadata(input);
  }
}
