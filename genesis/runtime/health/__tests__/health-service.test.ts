import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { createDefaultCompilerRegistry } from "../compiler-registry";
import { HealthService } from "../health-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("HealthService", () => {
  it("reports healthy status for configured runtime and reachable artifact root", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "genesis-health-"));
    temporaryDirectories.push(artifactRoot);

    const service = new HealthService(createDefaultCompilerRegistry(), {
      GENESIS_RUNTIME_API_KEY: "secret",
      GENESIS_ARTIFACT_ROOT: artifactRoot,
      GENESIS_RUNTIME_MAX_REQUEST_BYTES: "4096",
    });

    const health = await service.getHealth();
    const status = await service.getStatus();

    expect(health.status).toBe("healthy");
    expect(health.ready).toBe(true);
    expect(health.artifactStorage).toBe("ok");
    expect(typeof health.uptimeSeconds).toBe("number");

    expect(status.status).toBe("healthy");
    expect(status.registeredCompilers).toEqual(["Workbook"]);
    expect(status.requests.maximumBytes).toBe(4096);
  });

  it("reports unhealthy when runtime configuration is missing", async () => {
    const service = new HealthService(createDefaultCompilerRegistry(), {});

    const health = await service.getHealth();
    const status = await service.getStatus();

    expect(health.status).toBe("unhealthy");
    expect(health.ready).toBe(false);
    expect(health.artifactStorage).toBe("error");

    expect(status.status).toBe("unhealthy");
    expect(status.artifactRoot).toBe("unconfigured");
    expect(status.requests.maximumBytes).toBe(1048576);
  });
});
