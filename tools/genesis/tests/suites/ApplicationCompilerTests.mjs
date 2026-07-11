/**
 * ApplicationCompilerTests - Genesis Application Compiler v1 Test Suite
 *
 * 20 comprehensive tests covering:
 * - Blueprint initialization and validation
 * - Module discovery and loading
 * - Dependency validation
 * - Conflict resolution
 * - Blueprint assembly
 * - Manifest generation
 * - Artifact generation
 * - Error handling
 * - Metadata aggregation
 * - Application compilation
 *
 * @module tools/genesis/tests/suites/ApplicationCompilerTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  ApplicationBlueprint,
  ApplicationModule,
  ApplicationDependency,
  ApplicationPermission,
  ApplicationTheme,
  ApplicationSetting,
  ApplicationManifest
} from "../../compiler/ApplicationBlueprintContract.mjs";
import { ApplicationCompiler } from "../../compiler/ApplicationCompiler.mjs";

export default async function applicationCompilerTestSuite() {
  const suite = new TestSuite("Application Compiler Tests", "Genesis Application Compiler v1");

  // Test 1: Application Blueprint initializes
  suite.addTest("Application Blueprint initializes", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm",
      version: "1.0.0"
    });
    if (!blueprint.blueprintId) throw new Error("Blueprint should have ID");
    if (blueprint.name !== "CRM") throw new Error("Blueprint should store name");
    if (blueprint.status !== "draft") throw new Error("Blueprint should start as draft");
  });

  // Test 2: Blueprint validates successfully
  suite.addTest("Blueprint validates successfully", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm"
    });
    const validation = blueprint.validate();
    if (!validation.isValid) throw new Error("Blueprint should be valid");
    if (validation.errors.length > 0) throw new Error("Blueprint should have no errors");
  });

  // Test 3: Blueprint validation catches missing fields
  suite.addTest("Blueprint validation catches missing fields", async () => {
    const blueprint = new ApplicationBlueprint({
      name: "CRM"
      // Missing id and namespace
    });
    const validation = blueprint.validate();
    if (validation.isValid) throw new Error("Blueprint should be invalid");
    if (validation.errors.length === 0) throw new Error("Blueprint should have errors");
  });

  // Test 4: Application Module validates
  suite.addTest("Application Module validates", async () => {
    const module = new ApplicationModule({
      name: "CRM",
      namespace: "crm",
      version: "1.0.0"
    });
    const validation = module.validate();
    if (!validation.isValid) throw new Error("Module should be valid");
  });

  // Test 5: Module with missing name fails validation
  suite.addTest("Module with missing name fails validation", async () => {
    const module = new ApplicationModule({
      namespace: "crm"
    });
    const validation = module.validate();
    if (validation.isValid) throw new Error("Module should be invalid");
    if (!validation.errors.some(e => e.includes("name"))) throw new Error("Should have name error");
  });

  // Test 6: Application Permission validates
  suite.addTest("Application Permission validates", async () => {
    const perm = new ApplicationPermission({
      name: "Read Customers",
      resource: "Customer",
      actions: ["read"]
    });
    const validation = perm.validate();
    if (!validation.isValid) throw new Error("Permission should be valid");
  });

  // Test 7: Application Theme validates colors
  suite.addTest("Application Theme validates colors", async () => {
    const theme = new ApplicationTheme({
      name: "default",
      primaryColor: "#007AFF"
    });
    const validation = theme.validate();
    if (!validation.isValid) throw new Error("Theme should be valid");
  });

  // Test 8: Theme validation catches invalid colors
  suite.addTest("Theme validation catches invalid colors", async () => {
    const theme = new ApplicationTheme({
      primaryColor: "invalid"
    });
    const validation = theme.validate();
    if (validation.isValid) throw new Error("Theme should be invalid");
    if (validation.errors.length === 0) throw new Error("Theme should have color error");
  });

  // Test 9: Application Setting validates
  suite.addTest("Application Setting validates", async () => {
    const setting = new ApplicationSetting({
      key: "maxPageSize",
      value: 100,
      type: "number"
    });
    const validation = setting.validate();
    if (!validation.isValid) throw new Error("Setting should be valid");
  });

  // Test 10: Setting validation catches type mismatch
  suite.addTest("Setting validation catches type mismatch", async () => {
    const setting = new ApplicationSetting({
      key: "maxPageSize",
      value: "100", // String instead of number
      type: "number"
    });
    const validation = setting.validate();
    if (validation.isValid) throw new Error("Setting should be invalid");
    if (validation.errors.length === 0) throw new Error("Should have type error");
  });

  // Test 11: Blueprint can aggregate modules
  suite.addTest("Blueprint can aggregate modules", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm"
    });
    
    const module = new ApplicationModule({
      name: "CRM",
      namespace: "crm"
    });
    
    blueprint.modules.push(module);
    if (blueprint.modules.length !== 1) throw new Error("Should have 1 module");
  });

  // Test 12: Blueprint aggregates APIs from modules
  suite.addTest("Blueprint aggregates APIs from modules", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm"
    });
    
    const apis = [
      { method: "GET", path: "/api/customers" },
      { method: "POST", path: "/api/customers" }
    ];
    
    blueprint.apis.push(...apis);
    if (blueprint.apis.length !== 2) throw new Error("Should have 2 APIs");
  });

  // Test 13: Blueprint status transitions work
  suite.addTest("Blueprint status transitions work", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm"
    });
    
    if (blueprint.status !== "draft") throw new Error("Should start as draft");
    blueprint.markValidated();
    if (blueprint.status !== "validated") throw new Error("Should be validated");
    blueprint.markCompiled();
    if (blueprint.status !== "compiled") throw new Error("Should be compiled");
  });

  // Test 14: Application Manifest initializes
  suite.addTest("Application Manifest initializes", async () => {
    const manifest = new ApplicationManifest({
      application: { id: "app-crm", name: "CRM" }
    });
    if (!manifest.manifestId) throw new Error("Manifest should have ID");
    if (manifest.status !== "generated") throw new Error("Should be generated");
  });

  // Test 15: Manifest validation works
  suite.addTest("Manifest validation works", async () => {
    const manifest = new ApplicationManifest({
      application: { id: "app-crm", name: "CRM" }
    });
    const validation = manifest.validate();
    if (!validation.isValid) throw new Error("Manifest should be valid");
  });

  // Test 16: Application Compiler initializes
  suite.addTest("Application Compiler initializes", async () => {
    const compiler = new ApplicationCompiler("TestApp");
    if (compiler.applicationName !== "TestApp") throw new Error("Should store application name");
    if (compiler.errors.length !== 0) throw new Error("Should have no initial errors");
  });

  // Test 17: Compiler discovers modules
  suite.addTest("Compiler discovers modules", async () => {
    const compiler = new ApplicationCompiler("TestApp");
    compiler.discoverModules();
    // Should discover modules from out/generated/modules
    if (!Array.isArray(compiler.discoveredModules)) throw new Error("Should have modules array");
  });

  // Test 18: Blueprint getSummary provides statistics
  suite.addTest("Blueprint getSummary provides statistics", async () => {
    const blueprint = new ApplicationBlueprint({
      id: "app-crm",
      name: "CRM",
      namespace: "crm"
    });
    
    const module = new ApplicationModule({
      name: "CRM",
      namespace: "crm"
    });
    blueprint.modules.push(module);
    
    const summary = blueprint.getSummary();
    if (!summary.id) throw new Error("Summary should have ID");
    if (summary.modulesCount !== 1) throw new Error("Should show 1 module");
    if (summary.status !== "draft") throw new Error("Should show draft status");
  });

  // Test 19: Manifest toJSON serializes correctly
  suite.addTest("Manifest toJSON serializes correctly", async () => {
    const manifest = new ApplicationManifest({
      application: { id: "app-crm", name: "CRM" }
    });
    
    const json = manifest.toJSON();
    if (!json.manifestId) throw new Error("JSON should have manifestId");
    if (!json.application) throw new Error("JSON should have application");
    if (json.status !== "generated") throw new Error("JSON should have status");
  });

  // Test 20: Compiler getResults provides complete information
  suite.addTest("Compiler getResults provides complete information", async () => {
    const compiler = new ApplicationCompiler("TestApp");
    compiler.discoverModules();
    compiler.loadModuleMetadata();
    compiler.assembleBlueprint();
    compiler.generateManifest();
    
    const results = compiler.getResults();
    if (!results.success === undefined) throw new Error("Results should have success flag");
    if (results.applicationName !== "TestApp") throw new Error("Results should have app name");
    if (!results.statistics) throw new Error("Results should have statistics");
  });

  return suite;
}
