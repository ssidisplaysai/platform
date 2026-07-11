/**
 * PackageCompilerTests - Genesis Package System v1 Test Suite
 *
 * 20 comprehensive tests covering:
 * - Package blueprint initialization and validation
 * - Package dependency handling
 * - Export validation
 * - Runtime requirements
 * - Compatibility checking
 * - Manifest generation
 * - Version validation
 * - Artifact packaging
 *
 * @module tools/genesis/tests/suites/PackageCompilerTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  PackageBlueprint,
  PackageDependency,
  PackageExport,
  RuntimeRequirement,
  PackageCompatibility,
  PackageManifest
} from "../../compiler/PackageBlueprintContract.mjs";
import { PackageCompiler } from "../../compiler/PackageCompiler.mjs";

export default async function packageCompilerTestSuite() {
  const suite = new TestSuite("Package Compiler Tests", "Genesis Package System v1");

  // Test 1: Package Blueprint initializes
  suite.addTest("Package Blueprint initializes", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });
    if (!blueprint.blueprintId) throw new Error("Blueprint should have ID");
    if (blueprint.name !== "genesis-crm") throw new Error("Blueprint should store name");
    if (blueprint.status !== "draft") throw new Error("Blueprint should start as draft");
  });

  // Test 2: Package Blueprint validates semantic versioning
  suite.addTest("Package Blueprint validates semantic versioning", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });
    if (!blueprint.isValidVersion("1.0.0")) throw new Error("Valid version should pass");
    if (!blueprint.isValidVersion("2.1.0-beta")) throw new Error("Pre-release should pass");
    if (blueprint.isValidVersion("1.0")) throw new Error("Invalid version should fail");
  });

  // Test 3: Package Blueprint validation succeeds
  suite.addTest("Package Blueprint validation succeeds", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });

    const exp = new PackageExport({
      type: "application",
      name: "CRM",
      namespace: "crm",
      version: "1.0.0"
    });
    blueprint.exports.push(exp);

    const validation = blueprint.validate();
    if (!validation.isValid) throw new Error("Blueprint should be valid");
    if (validation.errors.length > 0) throw new Error("Blueprint should have no errors");
  });

  // Test 4: Package Blueprint validation catches missing name
  suite.addTest("Package Blueprint validation catches missing name", async () => {
    const blueprint = new PackageBlueprint({
      version: "1.0.0",
      publisher: "Genesis"
    });
    const validation = blueprint.validate();
    if (validation.isValid) throw new Error("Blueprint should be invalid");
    if (!validation.errors.some(e => e.includes("name"))) throw new Error("Should have name error");
  });

  // Test 5: Package Dependency validates
  suite.addTest("Package Dependency validates", async () => {
    const dep = new PackageDependency({
      packageName: "genesis-utils",
      publisher: "Genesis",
      minVersion: "1.0.0"
    });
    const validation = dep.validate();
    if (!validation.isValid) throw new Error("Dependency should be valid");
  });

  // Test 6: Package Dependency version matching works
  suite.addTest("Package Dependency version matching works", async () => {
    const dep = new PackageDependency({
      packageName: "genesis-utils",
      publisher: "Genesis",
      minVersion: "1.0.0",
      maxVersion: "2.0.0"
    });
    if (!dep.isSatisfied("1.5.0")) throw new Error("Version 1.5.0 should satisfy");
    if (dep.isSatisfied("2.1.0")) throw new Error("Version 2.1.0 should not satisfy");
  });

  // Test 7: Package Export validates
  suite.addTest("Package Export validates", async () => {
    const exp = new PackageExport({
      type: "application",
      name: "CRM",
      namespace: "crm",
      version: "1.0.0"
    });
    const validation = exp.validate();
    if (!validation.isValid) throw new Error("Export should be valid");
  });

  // Test 8: Package Export rejects invalid type
  suite.addTest("Package Export rejects invalid type", async () => {
    const exp = new PackageExport({
      type: "invalid",
      name: "CRM",
      namespace: "crm"
    });
    const validation = exp.validate();
    if (validation.isValid) throw new Error("Export should be invalid");
    if (validation.errors.length === 0) throw new Error("Should have type error");
  });

  // Test 9: Runtime Requirement validates
  suite.addTest("Runtime Requirement validates", async () => {
    const req = new RuntimeRequirement({
      component: "runtime",
      minVersion: "1.0.0"
    });
    const validation = req.validate();
    if (!validation.isValid) throw new Error("Requirement should be valid");
  });

  // Test 10: Package Compatibility validates
  suite.addTest("Package Compatibility validates", async () => {
    const compat = new PackageCompatibility({
      platforms: ["linux", "windows"],
      architectures: ["x64"]
    });
    const validation = compat.validate();
    if (!validation.isValid) throw new Error("Compatibility should be valid");
  });

  // Test 11: Package Compatibility checks platform support
  suite.addTest("Package Compatibility checks platform support", async () => {
    const compat = new PackageCompatibility({
      platforms: ["linux"],
      architectures: ["x64"]
    });
    if (!compat.isCompatible("linux", "x64", "18.0.0")) throw new Error("Should be compatible");
    if (compat.isCompatible("windows", "x64", "18.0.0")) throw new Error("Should not be compatible");
  });

  // Test 12: Package Manifest initializes
  suite.addTest("Package Manifest initializes", async () => {
    const manifest = new PackageManifest({
      package: { name: "genesis-crm", version: "1.0.0", publisher: "Genesis" }
    });
    if (!manifest.manifestId) throw new Error("Manifest should have ID");
    if (manifest.status !== "generated") throw new Error("Should be generated");
  });

  // Test 13: Package Manifest validation works
  suite.addTest("Package Manifest validation works", async () => {
    const manifest = new PackageManifest({
      package: { name: "genesis-crm", version: "1.0.0", publisher: "Genesis" },
      exports: [{ type: "application", name: "CRM" }]
    });
    const validation = manifest.validate();
    if (!validation.isValid) throw new Error("Manifest should be valid");
  });

  // Test 14: Package Manifest installation tracking
  suite.addTest("Package Manifest installation tracking", async () => {
    const manifest = new PackageManifest({
      package: { name: "genesis-crm", version: "1.0.0", publisher: "Genesis" },
      exports: [{ type: "application", name: "CRM" }]
    });
    if (manifest.installed) throw new Error("Should not be installed initially");
    manifest.markInstalled("/path/to/install");
    if (!manifest.installed) throw new Error("Should be installed");
    if (!manifest.installedAt) throw new Error("Should have install timestamp");
  });

  // Test 15: Package Blueprint checksum generation
  suite.addTest("Package Blueprint checksum generation", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });
    const checksum = blueprint.getChecksum();
    if (!checksum) throw new Error("Checksum should be generated");
    if (typeof checksum !== "string") throw new Error("Checksum should be string");
  });

  // Test 16: Package Blueprint summary
  suite.addTest("Package Blueprint summary", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });
    const exp = new PackageExport({
      type: "application",
      name: "CRM",
      namespace: "crm"
    });
    blueprint.exports.push(exp);

    const summary = blueprint.getSummary();
    if (!summary.id) throw new Error("Summary should have ID");
    if (summary.exportsCount !== 1) throw new Error("Should show 1 export");
    if (summary.status !== "draft") throw new Error("Should show draft status");
  });

  // Test 17: Package Compiler initializes
  suite.addTest("Package Compiler initializes", async () => {
    const compiler = new PackageCompiler("genesis-crm", "1.0.0", { publisher: "Genesis" });
    if (compiler.packageName !== "genesis-crm") throw new Error("Should store package name");
    if (compiler.version !== "1.0.0") throw new Error("Should store version");
    if (compiler.publisher !== "Genesis") throw new Error("Should store publisher");
  });

  // Test 18: Package Blueprint status transitions
  suite.addTest("Package Blueprint status transitions", async () => {
    const blueprint = new PackageBlueprint({
      name: "genesis-crm",
      version: "1.0.0",
      publisher: "Genesis"
    });
    if (blueprint.status !== "draft") throw new Error("Should start as draft");
    blueprint.markValidated();
    if (blueprint.status !== "validated") throw new Error("Should be validated");
    blueprint.markPackaged();
    if (blueprint.status !== "packaged") throw new Error("Should be packaged");
  });

  // Test 19: Package Manifest serialization
  suite.addTest("Package Manifest serialization", async () => {
    const manifest = new PackageManifest({
      package: { name: "genesis-crm", version: "1.0.0", publisher: "Genesis" },
      exports: [{ type: "application", name: "CRM" }],
      fileHash: "abc123",
      fileSize: 1024
    });
    const json = manifest.toJSON();
    if (!json.manifestId) throw new Error("JSON should have manifestId");
    if (!json.package) throw new Error("JSON should have package");
    if (json.exportsCount !== 1) throw new Error("JSON should have export count");
  });

  // Test 20: Package Compiler getResults
  suite.addTest("Package Compiler getResults", async () => {
    const compiler = new PackageCompiler("genesis-crm", "1.0.0", { publisher: "Genesis" });
    compiler.discoverArtifacts();
    compiler.assembleBlueprint();
    compiler.generateManifest();

    const results = compiler.getResults();
    if (!results.success === undefined) throw new Error("Results should have success flag");
    if (results.packageName !== "genesis-crm") throw new Error("Results should have package name");
    if (!results.statistics) throw new Error("Results should have statistics");
  });

  return suite;
}
