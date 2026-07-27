import {
  GMP_GENERATION_INPUT_SCHEMA_VERSION,
  GMP_SECTION_OUTPUT_SCHEMA_VERSION,
  type GmpCanonicalGenerationInput,
  type GmpContentAssembly,
  type GmpStructuredSectionOutput,
} from "./content-models";

export const gmpGenerationInputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-generation-input.schema.json",
  type: "object",
  required: [
    "schemaVersion",
    "generationPolicyVersion",
    "project",
    "site",
    "page",
    "brief",
    "contentPlan",
    "section",
    "approvedKnowledge",
    "evidenceReferences",
    "claims",
    "proofPoints",
    "restrictions",
    "brand",
    "seoRequirements",
    "internalLinkRequirements",
    "ctaRequirements",
    "accessibilityRequirements",
    "locale",
    "language",
  ],
  properties: {
    schemaVersion: { const: GMP_GENERATION_INPUT_SCHEMA_VERSION },
    generationPolicyVersion: { type: "string" },
    project: { type: "object" },
    site: { type: "object" },
    page: { type: "object" },
    brief: { type: "object" },
    contentPlan: { type: "object" },
    section: { type: "object" },
    approvedKnowledge: { type: "array", items: { type: "object" } },
    evidenceReferences: { type: "array", items: { type: "string" } },
    claims: { type: "array", items: { type: "string" } },
    proofPoints: { type: "array", items: { type: "string" } },
    restrictions: { type: "array", items: { type: "string" } },
    brand: { type: "object" },
    seoRequirements: { type: "array", items: { type: "string" } },
    internalLinkRequirements: { type: "array", items: { type: "object" } },
    ctaRequirements: { type: "array", items: { type: "string" } },
    accessibilityRequirements: { type: "array", items: { type: "string" } },
    locale: { type: "string" },
    language: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const gmpSectionOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-section-output.schema.json",
  type: "object",
  required: [
    "sectionKey",
    "heading",
    "body",
    "cta",
    "claimsUsed",
    "knowledgeRecordsUsed",
    "evidenceReferencesUsed",
    "internalLinksSuggested",
    "mediaGuidance",
    "warnings",
    "unresolvedRequirements",
    "generationNotes",
    "outputSchemaVersion",
  ],
  properties: {
    sectionKey: { type: "string" },
    heading: { type: "string" },
    body: { type: "string" },
    cta: { type: "object" },
    claimsUsed: { type: "array", items: { type: "string" } },
    knowledgeRecordsUsed: {
      type: "array",
      items: {
        type: "object",
        required: ["knowledgeRecordId", "version"],
        properties: {
          knowledgeRecordId: { type: "string" },
          version: { type: "number" },
        },
        additionalProperties: false,
      },
    },
    evidenceReferencesUsed: { type: "array", items: { type: "string" } },
    internalLinksSuggested: { type: "array", items: { type: "object" } },
    mediaGuidance: { type: "object" },
    warnings: { type: "array", items: { type: "string" } },
    unresolvedRequirements: { type: "array", items: { type: "string" } },
    generationNotes: { type: "array", items: { type: "string" } },
    outputSchemaVersion: { const: GMP_SECTION_OUTPUT_SCHEMA_VERSION },
  },
  additionalProperties: false,
} as const;

export const gmpValidationReportSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-validation-report.schema.json",
  type: "object",
  required: ["overallScore", "blockingIssues", "warnings", "recommendations", "sectionScores"],
  properties: {
    overallScore: { type: "number" },
    blockingIssues: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    sectionScores: {
      type: "array",
      items: {
        type: "object",
        required: ["sectionContentId", "score"],
        properties: {
          sectionContentId: { type: "string" },
          score: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: true,
} as const;

export const gmpGenerationLineageSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-generation-lineage.schema.json",
  type: "object",
  required: [
    "projectId",
    "pageId",
    "contentDraftId",
    "pageVersion",
    "pageBriefId",
    "pageBriefVersion",
    "contentPlanId",
    "contentPlanVersion",
    "knowledgeWorkspaceId",
    "knowledgeWorkspaceVersion",
    "knowledgeRecordVersions",
    "evidenceReferences",
    "claims",
    "restrictions",
    "provider",
    "modelIdentifier",
    "promptAdapterVersion",
    "inputFingerprint",
    "generationRequestId",
  ],
  properties: {
    projectId: { type: "string" },
    pageId: { type: "string" },
    contentDraftId: { type: "string" },
    pageVersion: { type: "number" },
    pageBriefId: { type: "string" },
    pageBriefVersion: { type: "number" },
    contentPlanId: { type: "string" },
    contentPlanVersion: { type: "number" },
    knowledgeWorkspaceId: { type: "string" },
    knowledgeWorkspaceVersion: { type: "number" },
    provider: { type: "string" },
    modelIdentifier: { type: "string" },
    promptAdapterVersion: { type: "string" },
    inputFingerprint: { type: "string" },
    generationRequestId: { type: "string" },
  },
  additionalProperties: true,
} as const;

export const gmpContentPreviewSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-content-preview.schema.json",
  type: "object",
  required: ["contentDraftId", "assembledDocument", "validationSummary"],
  properties: {
    contentDraftId: { type: "string" },
    assembledDocument: { type: "object" },
    validationSummary: { type: "object" },
  },
  additionalProperties: true,
} as const;

export function validateGenerationInput(input: GmpCanonicalGenerationInput): { ok: true } | { ok: false; error: string } {
  if (input.schemaVersion !== GMP_GENERATION_INPUT_SCHEMA_VERSION) {
    return { ok: false, error: "Unsupported generation input schema version." };
  }
  if (!input.page || !input.section || !input.brief || !input.contentPlan) {
    return { ok: false, error: "Canonical generation input is incomplete." };
  }
  return { ok: true };
}

export function validateSectionOutput(output: GmpStructuredSectionOutput): { ok: true } | { ok: false; error: string } {
  if (output.outputSchemaVersion !== GMP_SECTION_OUTPUT_SCHEMA_VERSION) {
    return { ok: false, error: "Unsupported section output schema version." };
  }
  if (!output.sectionKey || !output.heading.trim() || !output.body.trim()) {
    return { ok: false, error: "Section output is missing required content fields." };
  }
  return { ok: true };
}

export function toPreviewPayload(assembly: GmpContentAssembly): Record<string, unknown> {
  return {
    contentDraftId: assembly.contentDraftId,
    assembledDocument: assembly.assembledDocument,
    validationSummary: assembly.validationSummary,
  };
}

export type GmpSectionOutputSchemaVersion = typeof GMP_SECTION_OUTPUT_SCHEMA_VERSION;