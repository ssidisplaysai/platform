import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { GET as getHealth } from "../health/route";
import { GET as getStatus } from "../status/route";
import { GET as getVersion } from "../version/route";

const originalEnvironment = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnvironment };

  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Genesis runtime routes", () => {
  it("returns health, version, and status payloads", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "genesis-route-health-"));
    temporaryDirectories.push(artifactRoot);

    process.env.GENESIS_RUNTIME_API_KEY = "secret";
    process.env.GENESIS_ARTIFACT_ROOT = artifactRoot;
    process.env.GENESIS_RUNTIME_MAX_REQUEST_BYTES = "2048";
    process.env.GENESIS_RUNTIME_VERSION = "1.2.3";
    process.env.GENESIS_COMPILER_VERSION = "1.2.3";
    process.env.GENESIS_API_VERSION = "v1";
    process.env.GENESIS_BUILD_DATE = "2026-07-20";
    process.env.GENESIS_GIT_COMMIT = "commit123";
    process.env.GENESIS_ENVIRONMENT = "development";

    const healthResponse = await getHealth();
    const healthJson = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthJson.status).toBe("healthy");
    expect(healthJson.ready).toBe(true);

    const versionResponse = await getVersion();
    const versionJson = await versionResponse.json();

    expect(versionResponse.status).toBe(200);
    expect(versionJson.runtime).toBe("Genesis Runtime");
    expect(versionJson.version).toBe("1.2.3");
    expect(versionJson.apiVersion).toBe("v1");

    const statusResponse = await getStatus();
    const statusJson = await statusResponse.json();

    expect(statusResponse.status).toBe(200);
    expect(statusJson.status).toBe("healthy");
    expect(statusJson.registeredCompilers).toEqual(["Workbook"]);
    expect(statusJson.requests.maximumBytes).toBe(2048);
  });
});
