export type DocumentAssetDependency = {
  assetExists(input: { assetId: string; tenantId: string }): Promise<boolean>;
};

export type DocumentOrganizationDependency = {
  organizationExists(input: { organizationId: string; tenantId: string }): Promise<boolean>;
};

export type DocumentContactDependency = {
  contactExists(input: { contactId: string; tenantId: string }): Promise<boolean>;
};

export type DocumentWorkflowDependency = {
  canStartWorkflow(input: { tenantId: string; documentId: string }): Promise<boolean>;
};

export type DocumentAIDependency = {
  canGenerate(input: { tenantId: string; documentId: string; format: "PDF" | "DOCX" | "HTML" }): Promise<boolean>;
};

export type DocumentPlatformDependencies = {
  assets: DocumentAssetDependency;
  organization: DocumentOrganizationDependency;
  contacts: DocumentContactDependency;
  workflow: DocumentWorkflowDependency;
  ai: DocumentAIDependency;
};

export function createDefaultDocumentDependencies(): DocumentPlatformDependencies {
  return {
    assets: {
      async assetExists() {
        return true;
      },
    },
    organization: {
      async organizationExists() {
        return true;
      },
    },
    contacts: {
      async contactExists() {
        return true;
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
