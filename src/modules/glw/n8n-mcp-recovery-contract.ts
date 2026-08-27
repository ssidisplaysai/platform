import {
  GLW_N8N_ENGINE_SITE_ID,
  resolveGlwN8nEngineSiteId,
  type GlwN8nDraftRequest,
} from "./page-execution";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function validateGlwN8nMcpDraftRequest(value: unknown): GlwN8nDraftRequest {
  const request = asRecord(value);
  const page = asRecord(request.page);
  const site = asRecord(request.site);
  const publishingSettings = asRecord(request.publishingSettings);
  const jobId = typeof request.jobId === "string" ? request.jobId.trim() : "";
  const operationKey = typeof request.operationKey === "string" ? request.operationKey.trim() : "";
  const publicationKey = typeof request.publicationKey === "string" ? request.publicationKey.trim() : "";
  const operation = typeof request.operation === "string" ? request.operation.trim().toUpperCase() : "";
  const wordpressObjectId = typeof request.wordpressObjectId === "string"
    ? request.wordpressObjectId.trim()
    : "";
  const publicationAliases = [
    request.publishing_mode,
    request.publishingMode,
    request.status,
    publishingSettings.status,
    page.publishingMode,
    page.publishing_mode,
    page.status,
  ].filter((entry) => entry !== undefined && entry !== null && entry !== "");

  if (request.type !== "page_generation") throw new Error("GLW MCP request type must be page_generation.");
  if (!jobId) throw new Error("GLW MCP request requires a jobId.");
  if (publishingSettings.status !== "draft") throw new Error("GLW MCP publishing settings must request draft.");
  if (page.status !== "draft") throw new Error("GLW MCP page status must request draft.");
  if (!operationKey.endsWith(":draft")) throw new Error("GLW MCP operation key must end with :draft.");
  if (!publicationKey.endsWith(":draft")) throw new Error("GLW MCP publication key must end with :draft.");
  if (request.callbackUrl !== "") throw new Error("GLW MCP callback URL must be empty.");
  if (!/^(CREATE|UPDATE)_(GENERAL|STATE|CITY)$/.test(operation)) {
    throw new Error("GLW MCP request requires an explicit create or update operation.");
  }
  if (operation.startsWith("UPDATE_") && !/^[1-9]\d*$/.test(wordpressObjectId)) {
    throw new Error("GLW MCP updates require an exact persisted WordPress object ID.");
  }
  if (operation.startsWith("CREATE_") && wordpressObjectId) {
    throw new Error("GLW MCP creates cannot carry WordPress update authority.");
  }
  if (publicationAliases.some((entry) => String(entry).trim().toLowerCase() !== "draft")) {
    throw new Error("GLW MCP request contains a conflicting publication alias.");
  }

  const incomingSiteId = typeof site.id === "string" ? site.id.trim() : "";
  const engineSiteId = incomingSiteId === GLW_N8N_ENGINE_SITE_ID
    ? incomingSiteId
    : resolveGlwN8nEngineSiteId(incomingSiteId);

  if (engineSiteId === incomingSiteId) return value as GlwN8nDraftRequest;
  return {
    ...request,
    site: { ...site, id: engineSiteId },
  } as GlwN8nDraftRequest;
}