import { NextResponse } from "next/server";
import { getEnterpriseHealthService } from "@/platform/ehc";
import { getGlwRuntimeVersion } from "./runtime-version";
import { getGlwSite } from "./sites";

const GLW_APPLICATION_ID = "glw";
const CANONICAL_GLW_SITE_ID = "led-display-warehouse";

function hasNonEmptyEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function hasValidUrlEnv(name: string): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function evaluateGlwRuntimeRecord() {
  const service = await getEnterpriseHealthService();
  const hasCanonicalSite = Boolean(getGlwSite(CANONICAL_GLW_SITE_ID));
  const hasCallbackBaseUrl = hasValidUrlEnv("GLW_APP_URL");
  const hasPageWebhookUrl = hasValidUrlEnv("GLW_N8N_PAGE_WEBHOOK_URL");
  const hasWebhookSecret = hasNonEmptyEnv("GLW_N8N_WEBHOOK_SECRET");
  const hasDatabaseBinding = hasNonEmptyEnv("DATABASE_URL");

  const availableCapabilities = [
    hasCanonicalSite ? "catalog" : null,
    hasDatabaseBinding ? "order-management" : null,
    hasCanonicalSite && hasCallbackBaseUrl && hasPageWebhookUrl && hasWebhookSecret ? "page-generation" : null,
  ].filter((capability): capability is string => Boolean(capability));

  // READY means the production page-generation path is configured end-to-end.
  // LIVE means the GLW runtime can serve requests with its canonical site registry loaded.
  return service.evaluateHealth({
    applicationId: GLW_APPLICATION_ID,
    readiness: hasCanonicalSite && hasCallbackBaseUrl && hasPageWebhookUrl && hasWebhookSecret ? "READY" : "NOT_READY",
    liveness: hasCanonicalSite ? "LIVE" : "NOT_LIVE",
    availableCapabilities,
    source: "INTEGRATION",
  });
}

export async function handleGlwRuntimeHealth(): Promise<NextResponse> {
  const version = getGlwRuntimeVersion();
  const record = await evaluateGlwRuntimeRecord();

  if (!record) {
    return NextResponse.json({
      ...version,
      error: "Health record not found.",
      record: null,
    }, { status: 503 });
  }

  return NextResponse.json({
    ...version,
    record,
  }, { status: 200 });
}

export async function handleGlwCapabilityStatus(): Promise<NextResponse> {
  const record = await evaluateGlwRuntimeRecord();

  if (!record) {
    return NextResponse.json({ error: "Health record not found." }, { status: 503 });
  }

  return NextResponse.json({ capabilities: record.capabilities }, { status: 200 });
}

export async function handleGlwRuntimeVersion(): Promise<NextResponse> {
  return NextResponse.json(getGlwRuntimeVersion(), { status: 200 });
}
