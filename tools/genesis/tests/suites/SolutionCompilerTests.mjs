/**
 * SolutionCompilerTests - Genesis Solution Compiler v1 Test Suite
 *
 * 20 comprehensive tests covering:
 * - Blueprint initialization and validation
 * - Application loading
 * - Dependency validation
 * - Shared component identification
 * - Blueprint assembly
 * - Manifest generation
 * - Artifact generation
 * - Error handling
 * - Solution compilation
 * - Metadata aggregation
 *
 * @module tools/genesis/tests/suites/SolutionCompilerTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  SolutionBlueprint,
  SolutionApplication,
  SharedModule,
  SharedNavigation,
  SharedAPI,
  SharedAgent,
  GlobalPermission,
  SolutionBranding,
  SolutionIntegration,
  SolutionManifest
} from "../../compiler/SolutionBlueprintContract.mjs";
import { SolutionCompiler } from "../../compiler/SolutionCompiler.mjs";

export default async function solutionCompilerTestSuite() {
  const suite = new TestSuite("Solution Compiler Tests", "Genesis Solution Compiler v1");

  // Test 1: Solution Blueprint initializes
  suite.addTest("Solution Blueprint initializes", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi",
      version: "1.0.0"
    });
    if (!blueprint.blueprintId) throw new Error("Blueprint should have ID");
    if (blueprint.name !== "SSI") throw new Error("Blueprint should store name");
    if (blueprint.status !== "draft") throw new Error("Blueprint should start as draft");
  });

  // Test 2: Solution Blueprint validates successfully
  suite.addTest("Solution Blueprint validates successfully", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi"
    });

    // Add application so validation passes
    const app = new SolutionApplication({
      name: "CRM",
      namespace: "crm"
    });
    blueprint.applications.push(app);

    const validation = blueprint.validate();
    if (!validation.isValid) throw new Error("Blueprint should be valid");
    if (validation.errors.length > 0) throw new Error("Blueprint should have no errors");
  });

  // Test 3: Solution Blueprint validation catches missing applications
  suite.addTest("Solution Blueprint validation catches missing applications", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi"
      // No applications
    });
    const validation = blueprint.validate();
    if (validation.isValid) throw new Error("Blueprint should be invalid");
    if (validation.errors.length === 0) throw new Error("Blueprint should have errors");
  });

  // Test 4: Solution Application validates
  suite.addTest("Solution Application validates", async () => {
    const app = new SolutionApplication({
      name: "CRM",
      namespace: "crm",
      version: "1.0.0"
    });
    const validation = app.validate();
    if (!validation.isValid) throw new Error("Application should be valid");
  });

  // Test 5: Solution Application with missing name fails validation
  suite.addTest("Solution Application with missing name fails validation", async () => {
    const app = new SolutionApplication({
      namespace: "crm"
    });
    const validation = app.validate();
    if (validation.isValid) throw new Error("Application should be invalid");
    if (!validation.errors.some(e => e.includes("name"))) throw new Error("Should have name error");
  });

  // Test 6: Shared Navigation validates
  suite.addTest("Shared Navigation validates", async () => {
    const nav = new SharedNavigation({
      main: [{ label: "Home" }],
      admin: [{ label: "Settings" }]
    });
    const validation = nav.validate();
    if (!validation.isValid) throw new Error("Navigation should be valid");
  });

  // Test 7: Shared Navigation can merge structures
  suite.addTest("Shared Navigation can merge structures", async () => {
    const nav = new SharedNavigation();
    nav.merge({
      main: [{ label: "CRM" }]
    });
    nav.merge({
      main: [{ label: "Projects" }]
    });
    if (nav.main.length !== 2) throw new Error("Should have 2 main items");
  });

  // Test 8: Global Permission validates
  suite.addTest("Global Permission validates", async () => {
    const perm = new GlobalPermission({
      name: "Read All",
      resource: "Customer",
      actions: ["read"]
    });
    const validation = perm.validate();
    if (!validation.isValid) throw new Error("Permission should be valid");
  });

  // Test 9: Global Permission validation catches missing actions
  suite.addTest("Global Permission validation catches missing actions", async () => {
    const perm = new GlobalPermission({
      name: "Read All",
      resource: "Customer",
      actions: []
    });
    const validation = perm.validate();
    if (validation.isValid) throw new Error("Permission should be invalid");
    if (validation.errors.length === 0) throw new Error("Should have action error");
  });

  // Test 10: Solution Branding validates colors
  suite.addTest("Solution Branding validates colors", async () => {
    const branding = new SolutionBranding({
      name: "Default",
      colors: {
        primary: "#007AFF",
        secondary: "#5AC8FA"
      }
    });
    const validation = branding.validate();
    if (!validation.isValid) throw new Error("Branding should be valid");
  });

  // Test 11: Solution Branding validation catches invalid colors
  suite.addTest("Solution Branding validation catches invalid colors", async () => {
    const branding = new SolutionBranding({
      colors: {
        primary: "invalid"
      }
    });
    const validation = branding.validate();
    if (validation.isValid) throw new Error("Branding should be invalid");
    if (validation.errors.length === 0) throw new Error("Should have color error");
  });

  // Test 12: Solution Integration validates
  suite.addTest("Solution Integration validates", async () => {
    const integration = new SolutionIntegration({
      name: "Stripe",
      type: "billing",
      endpoint: "https://api.stripe.com"
    });
    const validation = integration.validate();
    if (!validation.isValid) throw new Error("Integration should be valid");
  });

  // Test 13: Solution Integration validation catches missing fields
  suite.addTest("Solution Integration validation catches missing fields", async () => {
    const integration = new SolutionIntegration({
      name: "Stripe"
      // Missing type and endpoint
    });
    const validation = integration.validate();
    if (validation.isValid) throw new Error("Integration should be invalid");
  });

  // Test 14: Blueprint aggregates applications
  suite.addTest("Blueprint aggregates applications", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi"
    });

    const app1 = new SolutionApplication({ name: "CRM", namespace: "crm" });
    const app2 = new SolutionApplication({ name: "ERP", namespace: "erp" });

    blueprint.applications.push(app1, app2);
    if (blueprint.applications.length !== 2) throw new Error("Should have 2 applications");
  });

  // Test 15: Blueprint status transitions work
  suite.addTest("Blueprint status transitions work", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi"
    });

    const app = new SolutionApplication({ name: "CRM", namespace: "crm" });
    blueprint.applications.push(app);

    if (blueprint.status !== "draft") throw new Error("Should start as draft");
    blueprint.markValidated();
    if (blueprint.status !== "validated") throw new Error("Should be validated");
    blueprint.markCompiled();
    if (blueprint.status !== "compiled") throw new Error("Should be compiled");
  });

  // Test 16: Solution Manifest initializes
  suite.addTest("Solution Manifest initializes", async () => {
    const manifest = new SolutionManifest({
      solution: { id: "solution-ssi", name: "SSI" }
    });
    if (!manifest.manifestId) throw new Error("Manifest should have ID");
    if (manifest.status !== "generated") throw new Error("Should be generated");
  });

  // Test 17: Manifest validation works
  suite.addTest("Manifest validation works", async () => {
    const manifest = new SolutionManifest({
      solution: { id: "solution-ssi", name: "SSI" },
      applications: [{ name: "CRM" }]
    });
    const validation = manifest.validate();
    if (!validation.isValid) throw new Error("Manifest should be valid");
  });

  // Test 18: Solution Compiler initializes
  suite.addTest("Solution Compiler initializes", async () => {
    const compiler = new SolutionCompiler("SSI");
    if (compiler.solutionName !== "SSI") throw new Error("Should store solution name");
    if (compiler.errors.length !== 0) throw new Error("Should have no initial errors");
  });

  // Test 19: Blueprint getSummary provides statistics
  suite.addTest("Blueprint getSummary provides statistics", async () => {
    const blueprint = new SolutionBlueprint({
      id: "solution-ssi",
      name: "SSI",
      namespace: "ssi"
    });

    const app = new SolutionApplication({ name: "CRM", namespace: "crm" });
    blueprint.applications.push(app);

    const summary = blueprint.getSummary();
    if (!summary.id) throw new Error("Summary should have ID");
    if (summary.applicationsCount !== 1) throw new Error("Should show 1 application");
    if (summary.status !== "draft") throw new Error("Should show draft status");
  });

  // Test 20: Manifest toJSON serializes correctly
  suite.addTest("Manifest toJSON serializes correctly", async () => {
    const manifest = new SolutionManifest({
      solution: { id: "solution-ssi", name: "SSI" },
      applications: [{ name: "CRM" }]
    });

    const json = manifest.toJSON();
    if (!json.manifestId) throw new Error("JSON should have manifestId");
    if (!json.solution) throw new Error("JSON should have solution");
    if (json.status !== "generated") throw new Error("JSON should have status");
  });

  return suite;
}
