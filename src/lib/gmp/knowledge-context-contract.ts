export type GmpKnowledgeContextDomainEntry = {
  key: string;
  title: string;
  summary?: string;
  value: Record<string, unknown>;
  sources: number;
};

export type GmpKnowledgeContextPackage = {
  schemaVersion: "gmp-context/v1";
  assembledAt: string;
  operationType: string;
  projectIdentity: {
    projectId: string;
    name: string;
    slug: string;
    locale: string;
    language: string;
    timezone: string;
  } | null;
  siteContext: {
    siteId: string;
    domain: string;
    environment: string;
    publishingPlatform: string;
  } | null;
  workspace: {
    knowledgeWorkspaceId: string;
    workspaceVersion: number;
    lifecycleState: string;
    completenessScore: number;
    confidenceScore: number;
  };
  knowledgeDomains: Record<string, GmpKnowledgeContextDomainEntry[]>;
  restrictions: GmpKnowledgeContextDomainEntry[];
  traceability: {
    recordCount: number;
    approvedOnly: boolean;
  };
};

export const gmpKnowledgeContextSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "gmp-context-v1",
  title: "GMP Knowledge Context Package",
  type: "object",
  required: [
    "schemaVersion",
    "assembledAt",
    "operationType",
    "projectIdentity",
    "siteContext",
    "workspace",
    "knowledgeDomains",
    "restrictions",
    "traceability",
  ],
  properties: {
    schemaVersion: { const: "gmp-context/v1" },
    assembledAt: { type: "string", format: "date-time" },
    operationType: { type: "string" },
    projectIdentity: {
      oneOf: [
        {
          type: "object",
          required: ["projectId", "name", "slug", "locale", "language", "timezone"],
          properties: {
            projectId: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            locale: { type: "string" },
            language: { type: "string" },
            timezone: { type: "string" },
          },
        },
        { type: "null" },
      ],
    },
    siteContext: {
      oneOf: [
        {
          type: "object",
          required: ["siteId", "domain", "environment", "publishingPlatform"],
          properties: {
            siteId: { type: "string" },
            domain: { type: "string" },
            environment: { type: "string" },
            publishingPlatform: { type: "string" },
          },
        },
        { type: "null" },
      ],
    },
    workspace: {
      type: "object",
      required: ["knowledgeWorkspaceId", "workspaceVersion", "lifecycleState", "completenessScore", "confidenceScore"],
      properties: {
        knowledgeWorkspaceId: { type: "string" },
        workspaceVersion: { type: "integer", minimum: 1 },
        lifecycleState: { type: "string" },
        completenessScore: { type: "integer", minimum: 0, maximum: 100 },
        confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    knowledgeDomains: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "title", "value", "sources"],
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            value: { type: "object", additionalProperties: true },
            sources: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    restrictions: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "title", "value", "sources"],
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          value: { type: "object", additionalProperties: true },
          sources: { type: "integer", minimum: 0 },
        },
      },
    },
    traceability: {
      type: "object",
      required: ["recordCount", "approvedOnly"],
      properties: {
        recordCount: { type: "integer", minimum: 0 },
        approvedOnly: { type: "boolean" },
      },
    },
  },
} as const;
