/**
 * EnterpriseTwinTests.mjs
 *
 * Test suite for Genesis Enterprise Digital Twin v1
 * Comprehensive coverage of graph model and twin construction
 *
 * @module tools/genesis/tests/suites/EnterpriseTwinTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  TwinNode,
  TwinRelationship,
  OrganizationNode,
  ApplicationNode,
  ModuleNode,
  ObjectNode,
  WorkflowNode,
  AutomationNode,
  AIAgentNode,
  RuntimeComponentNode,
  EnterpriseTwinGraph,
  EnterpriseTwinBlueprint
} from "../../compiler/EnterpriseTwinBlueprint.mjs";
import { EnterpriseTwinBuilder } from "../../compiler/EnterpriseTwinBuilder.mjs";

export default async function EnterpriseTwinTestSuite() {
  const suite = new TestSuite(
    "Enterprise Twin Tests",
    "Test Genesis Enterprise Digital Twin v1"
  );

  // Test 1: TwinNode initialization
  suite.addTest("TwinNode initializes", async () => {
    const node = new TwinNode({
      name: "test-node",
      type: "component"
    });
    if (!node.id) throw new Error("Node ID not set");
    if (node.name !== "test-node") throw new Error("Name mismatch");
    if (node.health !== "healthy") throw new Error("Default health should be healthy");
  });

  // Test 2: TwinNode validation
  suite.addTest("TwinNode validation works", async () => {
    const node = new TwinNode({});
    const result = node.validate();
    if (result.isValid) throw new Error("Should fail - missing required fields");
  });

  // Test 3: TwinNode metrics
  suite.addTest("TwinNode metrics update", async () => {
    const node = new TwinNode({
      name: "test",
      type: "component"
    });
    node.updateMetrics({ accessCount: 5, errorCount: 1 });
    if (node.metrics.accessCount !== 5) throw new Error("Access count not updated");
  });

  // Test 4: TwinNode health
  suite.addTest("TwinNode health management", async () => {
    const node = new TwinNode({
      name: "test",
      type: "component"
    });
    node.updateHealth("degraded", 50);
    if (node.health !== "degraded") throw new Error("Health not updated");
    if (node.healthScore !== 50) throw new Error("Health score not updated");
  });

  // Test 5: TwinNode access tracking
  suite.addTest("TwinNode access tracking works", async () => {
    const node = new TwinNode({
      name: "test",
      type: "component"
    });
    node.access();
    if (node.metrics.accessCount !== 1) throw new Error("Access not counted");
    if (!node.lastAccessedAt) throw new Error("Last accessed time not set");
  });

  // Test 6: TwinNode error recording
  suite.addTest("TwinNode error recording works", async () => {
    const node = new TwinNode({
      name: "test",
      type: "component"
    });
    const initialHealth = node.healthScore;
    node.recordError();
    if (node.metrics.errorCount !== 1) throw new Error("Error not counted");
    if (node.healthScore >= initialHealth) throw new Error("Health not decreased");
  });

  // Test 7: TwinRelationship initialization
  suite.addTest("TwinRelationship initializes", async () => {
    const rel = new TwinRelationship({
      sourceId: "node-1",
      targetId: "node-2",
      type: "contains"
    });
    if (!rel.id) throw new Error("Relationship ID not set");
    if (rel.sourceId !== "node-1") throw new Error("Source ID mismatch");
  });

  // Test 8: TwinRelationship validation
  suite.addTest("TwinRelationship validation works", async () => {
    const rel = new TwinRelationship({});
    const result = rel.validate();
    if (result.isValid) throw new Error("Should fail - missing required fields");
  });

  // Test 9: OrganizationNode initialization
  suite.addTest("OrganizationNode initializes", async () => {
    const node = new OrganizationNode({
      name: "Test Org",
      tenantId: "tenant-1"
    });
    if (node.type !== "organization") throw new Error("Type should be organization");
    if (node.tenantId !== "tenant-1") throw new Error("Tenant ID mismatch");
  });

  // Test 10: ApplicationNode initialization
  suite.addTest("ApplicationNode initializes", async () => {
    const node = new ApplicationNode({
      name: "Test App",
      organizationId: "org-1"
    });
    if (node.type !== "application") throw new Error("Type should be application");
    if (node.organizationId !== "org-1") throw new Error("Organization ID mismatch");
  });

  // Test 11: ModuleNode initialization
  suite.addTest("ModuleNode initializes", async () => {
    const node = new ModuleNode({
      name: "Test Module",
      applicationId: "app-1"
    });
    if (node.type !== "module") throw new Error("Type should be module");
    if (node.applicationId !== "app-1") throw new Error("Application ID mismatch");
  });

  // Test 12: ObjectNode initialization
  suite.addTest("ObjectNode initializes", async () => {
    const node = new ObjectNode({
      name: "Test Object",
      moduleId: "mod-1"
    });
    if (node.type !== "object") throw new Error("Type should be object");
    if (node.moduleId !== "mod-1") throw new Error("Module ID mismatch");
  });

  // Test 13: WorkflowNode initialization
  suite.addTest("WorkflowNode initializes", async () => {
    const node = new WorkflowNode({
      name: "Test Workflow",
      moduleId: "mod-1"
    });
    if (node.type !== "workflow") throw new Error("Type should be workflow");
    if (node.stage !== "initialized") throw new Error("Stage should be initialized");
  });

  // Test 14: AutomationNode initialization
  suite.addTest("AutomationNode initializes", async () => {
    const node = new AutomationNode({
      name: "Test Automation",
      moduleId: "mod-1"
    });
    if (node.type !== "automation") throw new Error("Type should be automation");
  });

  // Test 15: AIAgentNode initialization
  suite.addTest("AIAgentNode initializes", async () => {
    const node = new AIAgentNode({
      name: "Test Agent",
      moduleId: "mod-1"
    });
    if (node.type !== "agent") throw new Error("Type should be agent");
  });

  // Test 16: RuntimeComponentNode initialization
  suite.addTest("RuntimeComponentNode initializes", async () => {
    const node = new RuntimeComponentNode({
      name: "Test Engine",
      componentType: "engine"
    });
    if (node.type !== "component") throw new Error("Type should be component");
    if (node.componentType !== "engine") throw new Error("Component type mismatch");
  });

  // Test 17: EnterpriseTwinGraph initialization
  suite.addTest("EnterpriseTwinGraph initializes", async () => {
    const graph = new EnterpriseTwinGraph({
      tenantId: "tenant-1"
    });
    if (!graph.graphId) throw new Error("Graph ID not set");
    if (graph.tenantId !== "tenant-1") throw new Error("Tenant ID mismatch");
    if (graph.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 18: Graph add node
  suite.addTest("Graph add node works", async () => {
    const graph = new EnterpriseTwinGraph();
    const node = new TwinNode({ name: "test", type: "component" });
    graph.addNode(node);
    if (graph.stats.nodeCount !== 1) throw new Error("Node count not updated");
    if (!graph.getNode(node.id)) throw new Error("Node not retrievable");
  });

  // Test 19: Graph add relationship
  suite.addTest("Graph add relationship works", async () => {
    const graph = new EnterpriseTwinGraph();
    const node1 = new TwinNode({ name: "node1", type: "component" });
    const node2 = new TwinNode({ name: "node2", type: "component" });
    graph.addNode(node1);
    graph.addNode(node2);
    const rel = new TwinRelationship({
      sourceId: node1.id,
      targetId: node2.id,
      type: "contains"
    });
    graph.addRelationship(rel);
    if (graph.stats.relationshipCount !== 1) throw new Error("Relationship count not updated");
  });

  // Test 20: Graph get nodes by type
  suite.addTest("Graph get nodes by type works", async () => {
    const graph = new EnterpriseTwinGraph();
    graph.addNode(new ApplicationNode({ name: "app1", organizationId: "org-1" }));
    graph.addNode(new ModuleNode({ name: "mod1", applicationId: "app-1" }));
    const apps = graph.getNodesByType("application");
    if (apps.length !== 1) throw new Error("Should find 1 application");
    if (apps[0].name !== "app1") throw new Error("Application name mismatch");
  });

  // Test 21: Graph get related nodes
  suite.addTest("Graph get related nodes works", async () => {
    const graph = new EnterpriseTwinGraph();
    const node1 = new TwinNode({ name: "n1", type: "component" });
    const node2 = new TwinNode({ name: "n2", type: "component" });
    graph.addNode(node1);
    graph.addNode(node2);
    const rel = new TwinRelationship({
      sourceId: node1.id,
      targetId: node2.id,
      type: "contains"
    });
    graph.addRelationship(rel);
    const related = graph.getRelatedNodes(node1.id);
    if (related.length !== 1) throw new Error("Should find 1 related node");
  });

  // Test 22: Graph statistics
  suite.addTest("Graph statistics update", async () => {
    const graph = new EnterpriseTwinGraph();
    graph.addNode(new TwinNode({ name: "n1", type: "component" }));
    graph.addNode(new TwinNode({ name: "n2", type: "component" }));
    if (graph.stats.nodeCount !== 2) throw new Error("Node count mismatch");
    if (graph.stats.avgHealthScore !== 100) throw new Error("Avg health should be 100");
  });

  // Test 23: Graph status determination
  suite.addTest("Graph status determination works", async () => {
    const graph = new EnterpriseTwinGraph();
    const node = new TwinNode({ name: "test", type: "component" });
    graph.addNode(node);
    graph.updateStatus();
    if (graph.status !== "active") throw new Error("Status should be active with 100% health");
  });

  // Test 24: Graph validation
  suite.addTest("Graph validation works", async () => {
    const graph = new EnterpriseTwinGraph();
    const node = new TwinNode({ name: "test", type: "component" });
    graph.addNode(node);
    const validation = graph.validate();
    if (!validation.isValid) throw new Error("Valid graph should pass validation");
  });

  // Test 25: Graph health report
  suite.addTest("Graph health report generated", async () => {
    const graph = new EnterpriseTwinGraph();
    graph.addNode(new TwinNode({ name: "n1", type: "component" }));
    const report = graph.getHealthReport();
    if (report.overallHealth !== 100) throw new Error("Overall health should be 100");
    if (report.nodeHealth.healthy !== 1) throw new Error("Should have 1 healthy node");
  });

  // Test 26: EnterpriseTwinBlueprint initialization
  suite.addTest("EnterpriseTwinBlueprint initializes", async () => {
    const bp = new EnterpriseTwinBlueprint({
      tenantId: "tenant-1"
    });
    if (!bp.blueprintId) throw new Error("Blueprint ID not set");
    if (bp.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 27: Blueprint graph initialization
  suite.addTest("Blueprint graph initialization", async () => {
    const bp = new EnterpriseTwinBlueprint({
      tenantId: "tenant-1"
    });
    bp.initializeGraph();
    if (!bp.graph) throw new Error("Graph not initialized");
    if (bp.graph.tenantId !== "tenant-1") throw new Error("Graph tenant mismatch");
  });

  // Test 28: Blueprint status transitions
  suite.addTest("Blueprint status transitions work", async () => {
    const bp = new EnterpriseTwinBlueprint();
    bp.initializeGraph();
    bp.markValidated();
    if (bp.status !== "validated") throw new Error("Status should be validated");
    bp.markDeployed();
    if (bp.status !== "deployed") throw new Error("Status should be deployed");
    bp.markActive();
    if (bp.status !== "active") throw new Error("Status should be active");
  });

  // Test 29: EnterpriseTwinBuilder initialization
  suite.addTest("EnterpriseTwinBuilder initializes", async () => {
    const builder = new EnterpriseTwinBuilder("test-tenant");
    if (builder.tenantId !== "test-tenant") throw new Error("Tenant ID mismatch");
    if (!builder.tenantId) throw new Error("Tenant ID not set");
  });

  // Test 30: TwinBuilder blueprint initialization
  suite.addTest("TwinBuilder blueprint initialization", async () => {
    const builder = new EnterpriseTwinBuilder("test-tenant");
    builder.initializeBlueprint();
    if (!builder.blueprint) throw new Error("Blueprint not initialized");
    if (!builder.graph) throw new Error("Graph not initialized");
  });

  return suite;
}
