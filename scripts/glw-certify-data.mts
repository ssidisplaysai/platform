import { getPrismaClient, disconnectPrismaClient } from "../src/lib/glw/prisma";
import { createJobRecoveryService } from "../src/lib/runtime/job-recovery/service";
import { GLW_QA_CHECK_KEYS, GLW_QA_CONTRACT_VERSION } from "../src/lib/glw/jobs";

type JsonObject = Record<string, unknown>;

function getArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function getBooleanArg(name: string, fallback: boolean): boolean {
  const value = getArg(name, fallback ? "true" : "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractHeadingTexts(html: string, tagName: "h1" | "h2"): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const normalized = decodeEntities(stripHtml(match[1] ?? "")).toLowerCase().trim();
    if (normalized.length > 0) {
      headings.push(normalized);
    }
  }
  return headings;
}

function countDuplicateLongParagraphs(html: string): number {
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const seen = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const normalized = decodeEntities(stripHtml(match[1] ?? "")).replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.length < 120) {
      continue;
    }
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const value of seen.values()) {
    if (value > 1) {
      duplicates += value - 1;
    }
  }
  return duplicates;
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; ok: boolean; json: JsonObject | null; text: string }> {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    let json: JsonObject | null = null;
    try {
      json = JSON.parse(text) as JsonObject;
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.ok, json, text };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      json: null,
      text: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

async function run(): Promise<void> {
  const baseUrl = getArg("base-url", "http://localhost:3001").replace(/\/$/, "");
  const publicBaseUrl = getArg("public-base-url", "https://app.ssiai.app").replace(/\/$/, "");
  const workflowId = getArg("workflow-id", "bIDXxyWnY22G8zJC");
  const dallasPageId = Number.parseInt(getArg("dallas-page-id", "18846"), 10);
  const recoverQueue = getBooleanArg("recover-queue", true);

  const prisma = getPrismaClient();
  const recoveryService = createJobRecoveryService(prisma);

  const healthLocal = await fetchJson(`${baseUrl}/api/glw/health`);
  const versionLocal = await fetchJson(`${baseUrl}/api/glw/version`);
  const healthPublic = await fetchJson(`${publicBaseUrl}/api/glw/health`);

  const callbackProbe = await fetchJson(`${baseUrl}/api/glw/jobs/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const auditBefore = await recoveryService.runAudit();
  let recoveryResult: unknown = null;
  if (recoverQueue && auditBefore.summary.recoverable > 0) {
    recoveryResult = await recoveryService.executeRecovery({
      actorId: "glw-certify-script",
      mode: "RECOVER_ALL_SAFE",
      dryRun: false,
      approvalToken: "APPROVE_RECOVERY_WRITE",
      reason: "Genesis Platform v1.2 certification queue cleanup",
    });
  }
  const auditAfter = await recoveryService.runAudit();

  const latestDallas = await prisma.glwJob.findFirst({
    where: {
      type: "PAGE_GENERATION",
      result: {
        path: ["wordpressPageId"],
        equals: dallasPageId,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const dallasResult = (latestDallas?.result ?? null) as JsonObject | null;
  const dallasQaChecks = (dallasResult?.qaChecks ?? null) as JsonObject | null;
  const dallasQaKeys = dallasQaChecks ? Object.keys(dallasQaChecks).sort() : [];
  const dallasWordpressUrl = typeof dallasResult?.wordpressUrl === "string"
    ? dallasResult.wordpressUrl
    : "https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/dallas/";

  const dallasPageResponse = await fetchJson(dallasWordpressUrl);
  const dallasHtml = dallasPageResponse.text;
  const dallasWordCount = countWords(stripHtml(dallasHtml));
  const h1Headings = extractHeadingTexts(dallasHtml, "h1");
  const h2Headings = extractHeadingTexts(dallasHtml, "h2");
  const duplicateSectionHeadings = h2Headings.length - new Set(h2Headings).size;
  const placeholderResourceLabelCount = (dallasHtml.match(/resource\s+\d+/gi) ?? []).length;
  const duplicateParagraphCount = countDuplicateLongParagraphs(dallasHtml);

  let workflowCheck: JsonObject = {
    available: false,
    status: "UNAVAILABLE",
    missingKeys: [...GLW_QA_CHECK_KEYS],
    foundKeys: [],
    reason: "GLW n8n API configuration was not available.",
  };

  const n8nWebhookUrl = process.env.GLW_N8N_PAGE_WEBHOOK_URL;
  const n8nApiKey = process.env.GLW_N8N_API_KEY;
  if (n8nWebhookUrl && n8nApiKey) {
    const origin = new URL(n8nWebhookUrl).origin;
    const workflowResponse = await fetchJson(`${origin}/api/v1/workflows/${workflowId}`, {
      headers: {
        "X-N8N-API-KEY": n8nApiKey,
        Accept: "application/json",
      },
    });

    if (workflowResponse.ok && workflowResponse.json) {
      const nodes = Array.isArray(workflowResponse.json.nodes) ? workflowResponse.json.nodes as Array<Record<string, unknown>> : [];
      const qaNode = nodes.find((node) => node.name === "Build Pre-Publish QA Result");
      const jsCode = typeof qaNode?.parameters === "object" && qaNode.parameters !== null
        ? String((qaNode.parameters as Record<string, unknown>).jsCode ?? "")
        : "";

      const foundKeys = GLW_QA_CHECK_KEYS.filter((key) => jsCode.includes(`"${key}"`) || jsCode.includes(`'${key}'`));
      const missingKeys = GLW_QA_CHECK_KEYS.filter((key) => !foundKeys.includes(key));
      workflowCheck = {
        available: true,
        status: missingKeys.length === 0 ? "PASS" : "FAIL",
        missingKeys,
        foundKeys,
      };
    } else {
      workflowCheck = {
        available: false,
        status: "UNAVAILABLE",
        missingKeys: [...GLW_QA_CHECK_KEYS],
        foundKeys: [],
        reason: workflowResponse.text,
      };
    }
  }

  const infrastructureProbe = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    publicBaseUrl,
    qaContractVersionExpected: GLW_QA_CONTRACT_VERSION,
    infrastructure: {
      databaseConnected: infrastructureProbe[0]?.ok === 1,
      runtimeReachable: healthLocal.status === 200,
    },
    runtime: {
      healthStatus: healthLocal.status,
      versionStatus: versionLocal.status,
      version: versionLocal.json,
      callbackUnauthorizedStatus: callbackProbe.status,
    },
    cloudflare: {
      publicHealthStatus: healthPublic.status,
      publicHealthPayload: healthPublic.json,
    },
    queue: {
      before: auditBefore,
      recovery: recoveryResult,
      after: auditAfter,
    },
    workflow: workflowCheck,
    dallas: {
      pageId: dallasPageId,
      latestJobId: latestDallas?.id ?? null,
      latestJobStatus: latestDallas?.status ?? null,
      latestJobUpdatedAt: latestDallas?.updatedAt?.toISOString() ?? null,
      wordpressUrl: dallasWordpressUrl,
      qaCheckCount: dallasQaKeys.length,
      qaCheckKeys: dallasQaKeys,
      pageProbe: {
        status: dallasPageResponse.status,
        h1Count: h1Headings.length,
        duplicateSectionHeadings,
        placeholderResourceLabelCount,
        duplicateParagraphCount,
        bodyWordCount: dallasWordCount,
      },
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await disconnectPrismaClient();
}

run().catch(async (error) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : "Certification data collection failed.",
  }, null, 2));
  await disconnectPrismaClient();
  process.exitCode = 1;
});
