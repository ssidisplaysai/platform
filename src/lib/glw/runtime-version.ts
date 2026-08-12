import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  GLW_CALLBACK_CONTRACT_VERSION,
  GLW_QA_CONTRACT_VERSION,
} from "./jobs";

const STARTED_AT = new Date();
const BUILD_ID_PATH = path.join(process.cwd(), ".next", "BUILD_ID");

const DEFAULT_SCHEMA_VERSION = "glw-job-schema-v1";
const DEFAULT_PLANNER_VERSION = "genesis-planner-v1";
const DEFAULT_PUBLISHING_ENGINE_VERSION = "glw-publishing-engine-v1.0";

export type GlwRuntimeVersion = {
  application: "GLW";
  build_id: string;
  git_commit: string;
  qa_contract_version: number;
  schema_version: string;
  started_at: string;
  uptime: string;
  callback_contract_version: number;
  planner_version: string;
  publishing_engine_version: string;
};

function readBuildId(): string {
  if (!existsSync(BUILD_ID_PATH)) {
    return "unknown";
  }

  try {
    const value = readFileSync(BUILD_ID_PATH, "utf8").trim();
    return value.length > 0 ? value : "unknown";
  } catch {
    return "unknown";
  }
}

function readGitCommit(): string {
  const envValue = process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GIT_COMMIT
    ?? process.env.COMMIT_SHA;

  if (envValue && envValue.trim().length > 0) {
    return envValue.trim();
  }

  try {
    const value = execSync("git rev-parse HEAD", {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return value.length > 0 ? value : "unknown";
  } catch {
    return "unknown";
  }
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getGlwRuntimeVersion(): GlwRuntimeVersion {
  const now = Date.now();

  return {
    application: "GLW",
    build_id: readBuildId(),
    git_commit: readGitCommit(),
    qa_contract_version: GLW_QA_CONTRACT_VERSION,
    schema_version: process.env.GLW_SCHEMA_VERSION ?? DEFAULT_SCHEMA_VERSION,
    started_at: STARTED_AT.toISOString(),
    uptime: formatUptime(now - STARTED_AT.getTime()),
    callback_contract_version: GLW_CALLBACK_CONTRACT_VERSION,
    planner_version: process.env.GLW_PLANNER_VERSION ?? DEFAULT_PLANNER_VERSION,
    publishing_engine_version: process.env.GLW_PUBLISHING_ENGINE_VERSION ?? DEFAULT_PUBLISHING_ENGINE_VERSION,
  };
}
