import "server-only";

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSiteById } from "@/modules/foundation/site-repository";
import { createEnterpriseCapabilityEngine } from "@/platform/ehc/capability-engine";
import { createEnterpriseHealthEvaluationEngine } from "@/platform/ehc/evaluation-engine";

const STARTED_AT = new Date();
const BUILD_ID_PATH = path.join(process.cwd(), ".next", "BUILD_ID");
const DECLARED_CAPABILITIES = ["catalog", "order-management", "page-generation"] as const;
const GLW_QA_CHECK_KEYS = ["pageExists", "hierarchy", "slug", "title", "h1", "uniquePrimaryHeading", "duplicateSectionHeadings", "duplicateSectionContent", "placeholderResourceLinks", "body", "featuredImage", "heroImage", "seo", "internalLinks", "imageAlt", "duplicateCheck"] as const;
const CONTRACT_VERSION = GLW_QA_CHECK_KEYS.length;

function hasNonEmptyEnv(name: string): boolean { return Boolean(process.env[name]?.trim()); }
function hasValidUrlEnv(name: string): boolean {
  const value = process.env[name]?.trim();
  if (!value) return false;
  try { new URL(value); return true; } catch { return false; }
}
function readBuildId(): string {
  if (!existsSync(BUILD_ID_PATH)) return "unknown";
  try { return readFileSync(BUILD_ID_PATH, "utf8").trim() || "unknown"; } catch { return "unknown"; }
}
function readGitCommit(): string {
  const value = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? process.env.COMMIT_SHA;
  if (value?.trim()) return value.trim();
  try { return execSync("git rev-parse HEAD", { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim() || "unknown"; } catch { return "unknown"; }
}
function formatUptime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(totalSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function getGlwRuntimeVersion() {
  return {
    application: "GLW" as const,
    build_id: readBuildId(),
    git_commit: readGitCommit(),
    qa_contract_version: CONTRACT_VERSION,
    schema_version: process.env.GLW_SCHEMA_VERSION ?? "glw-job-schema-v1",
    started_at: STARTED_AT.toISOString(),
    uptime: formatUptime(Date.now() - STARTED_AT.getTime()),
    callback_contract_version: CONTRACT_VERSION,
    planner_version: process.env.GLW_PLANNER_VERSION ?? "genesis-planner-v1",
    publishing_engine_version: process.env.GLW_PUBLISHING_ENGINE_VERSION ?? "glw-publishing-engine-v1.0",
  };
}

export function evaluateGlwRuntimeRecord() {
  const hasCanonicalSite = Boolean(getSiteById("site-led-display-warehouse-production"));
  const hasCallbackBaseUrl = hasValidUrlEnv("GLW_APP_URL");
  const hasPageWebhookUrl = hasValidUrlEnv("GLW_N8N_PAGE_WEBHOOK_URL");
  const hasWebhookSecret = hasNonEmptyEnv("GLW_N8N_WEBHOOK_SECRET");
  const hasDatabaseBinding = hasNonEmptyEnv("DATABASE_URL");
  const availableCapabilities = [
    hasCanonicalSite ? "catalog" : null,
    hasDatabaseBinding ? "order-management" : null,
    hasCanonicalSite && hasCallbackBaseUrl && hasPageWebhookUrl && hasWebhookSecret ? "page-generation" : null,
  ].filter((capability): capability is string => Boolean(capability));
  const capabilities = createEnterpriseCapabilityEngine().buildAdvertisement([...DECLARED_CAPABILITIES], availableCapabilities);
  const readiness = hasCanonicalSite && hasCallbackBaseUrl && hasPageWebhookUrl && hasWebhookSecret ? "READY" as const : "NOT_READY" as const;
  const liveness = hasCanonicalSite ? "LIVE" as const : "NOT_LIVE" as const;
  const compatibility = createEnterpriseHealthEvaluationEngine().evaluateCompatibility({ registryContractVersion: "1.0.0", healthContractVersion: "1.0.0", supportedHealthContractVersions: ["1.0.0"], supportedCapabilityContractVersions: ["1.0.0"] });
  const status = createEnterpriseHealthEvaluationEngine().evaluateStatus({ readiness, liveness, capabilityAvailableCount: capabilities.availableCapabilities.length, capabilityDeclaredCount: capabilities.declaredCapabilities.length, compatibility });
  return {
    applicationId: "glw",
    observedAt: new Date().toISOString(),
    status,
    capabilities,
    compatibility,
    reference: { healthEndpoint: "/api/glw/health", capabilityEndpoint: "/api/glw/capabilities", contractVersion: "1.0.0" },
    source: "INTEGRATION",
  };
}

export function handleGlwRuntimeVersion(): NextResponse { return NextResponse.json(getGlwRuntimeVersion(), { status: 200 }); }
export function handleGlwRuntimeHealth(): NextResponse { return NextResponse.json({ ...getGlwRuntimeVersion(), record: evaluateGlwRuntimeRecord() }, { status: 200 }); }
export function handleGlwCapabilityStatus(): NextResponse { return NextResponse.json({ capabilities: evaluateGlwRuntimeRecord().capabilities }, { status: 200 }); }