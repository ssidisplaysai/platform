import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminLauncherStack } from "../s2g-db-admin-launcher/cdk/staging-s2g-db-admin-launcher-stack.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function synthLauncherAsset() {
  const outDir = await mkdtemp(resolve(repoRoot, ".tmp-s2g-db-admin-launcher-asset-"));
  const app = new App({ outdir: outDir });
  const stack = createStagingS2gDbAdminLauncherStack(app);
  app.synth();

  const assetManifest = JSON.parse(await readFile(resolve(outDir, `${stack.stackName}.assets.json`), "utf8"));
  const launcherAsset = Object.values(assetManifest.files).find((entry) => entry.displayName === "DbAdminDiagnosticLauncherFunction/Code");
  assert.ok(launcherAsset, "launcher Lambda asset must be present in CDK asset manifest");

  const assetPath = resolve(outDir, launcherAsset.source.path);
  return {
    outDir,
    assetPath,
  };
}

async function listFilesRecursive(root) {
  const files = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else {
        files.push(relative(root, absolute).replace(/\\/g, "/"));
      }
    }
  }
  await walk(root);
  return files;
}

function gatherRelativeImports(source) {
  const imports = [];
  const importRegex = /^\s*import(?:\s+[^'"]+?\s+from\s+)?["']([^"']+)["'];?$/gm;
  const exportRegex = /^\s*export\s+[^'"]+?\s+from\s+["']([^"']+)["'];?$/gm;
  let match;
  while ((match = importRegex.exec(source)) !== null) imports.push(match[1]);
  while ((match = exportRegex.exec(source)) !== null) imports.push(match[1]);
  return imports.filter((specifier) => specifier.startsWith("."));
}

test("launcher Lambda packaged asset contains contract and resolves local ESM graph", async () => {
  const { outDir, assetPath } = await synthLauncherAsset();
  try {
    const files = await listFilesRecursive(assetPath);
    assert.deepEqual(
      files.sort(),
      [
        "diagnostic-launcher-core.mjs",
        "diagnostic-launcher-lambda.mjs",
        "s2g-db-admin-diagnostic-contract.mjs",
      ],
      "packaged Lambda asset should include all required local modules",
    );

    const toVisit = ["diagnostic-launcher-lambda.mjs"];
    const visited = new Set();
    while (toVisit.length > 0) {
      const current = toVisit.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      const source = await readFile(resolve(assetPath, current), "utf8");
      const imports = gatherRelativeImports(source);
      for (const specifier of imports) {
        const resolved = relative(
          assetPath,
          resolve(resolve(assetPath, current), "..", specifier),
        ).replace(/\\/g, "/");
        assert.ok(files.includes(resolved), `missing local module ${resolved} required by ${current}`);
        if (resolved.endsWith(".mjs")) toVisit.push(resolved);
      }
    }

    const originalActivation = process.env.LAUNCHER_ACTIVATION_STATE;
    process.env.LAUNCHER_ACTIVATION_STATE = "DISABLED";
    try {
      const modulePath = pathToFileURL(resolve(assetPath, "diagnostic-launcher-lambda.mjs")).href;
      const imported = await import(modulePath);
      assert.equal(typeof imported.handler, "function");
    } finally {
      if (originalActivation === undefined) delete process.env.LAUNCHER_ACTIVATION_STATE;
      else process.env.LAUNCHER_ACTIVATION_STATE = originalActivation;
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("old two-file launcher artifact shape reproduces missing contract import error", async () => {
  const { outDir, assetPath } = await synthLauncherAsset();
  const oldArtifactDir = await mkdtemp(resolve(repoRoot, ".tmp-s2g-db-admin-launcher-old-shape-"));
  try {
    await cp(resolve(assetPath, "diagnostic-launcher-core.mjs"), resolve(oldArtifactDir, "diagnostic-launcher-core.mjs"));
    await cp(resolve(assetPath, "diagnostic-launcher-lambda.mjs"), resolve(oldArtifactDir, "diagnostic-launcher-lambda.mjs"));

    await assert.rejects(
      () => import(pathToFileURL(resolve(oldArtifactDir, "diagnostic-launcher-lambda.mjs")).href),
      (error) => error?.code === "ERR_MODULE_NOT_FOUND"
        && String(error.message).includes("s2g-db-admin-diagnostic-contract.mjs"),
    );
  } finally {
    await rm(oldArtifactDir, { recursive: true, force: true });
    await rm(outDir, { recursive: true, force: true });
  }
});
