/**
 * QueryBusTests.mjs - Test Suite for Query Bus
 *
 * Tests:
 * - Query creation and format validation
 * - Metadata validation
 * - All query types
 * - Read-only enforcement
 * - Results handling
 * - Error handling
 * - Statistics tracking
 *
 * @module tools/genesis/tests/suites/QueryBusTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { QueryBus } from "../../runtime/QueryBus.mjs";
import { RuntimeQuery, RuntimeQueryResult } from "../../runtime/RuntimeQueryContract.mjs";

export default async function queryBusTestSuite() {
  const suite = new TestSuite("Query Bus", "Genesis Query Bus v1");

  suite.addTest("Bus initializes successfully", async () => {
    const bus = new QueryBus();
    bus.initialize();
    if (!bus.runtimeReady) throw new Error("Bus runtime not ready");
  });

  suite.addTest("Get by ID query validates", async () => {
    const query = new RuntimeQuery({
      queryType: "getById",
      aggregateType: "Company",
      aggregateId: "comp-123"
    });
    const validation = query.validate();
    if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
  });

  suite.addTest("Get by ID query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "getById",
      aggregateType: "Company",
      aggregateId: "comp-123"
    });
    if (result.status !== "executed") throw new Error(`Expected 'executed'`);
    if (!result.isReadOnly()) throw new Error("Query should be read-only");
  });

  suite.addTest("List query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "list",
      aggregateType: "Customer"
    });
    if (result.status !== "executed") throw new Error("List should execute");
    if (result.totalCount === 0) throw new Error("List should return results");
  });

  suite.addTest("Search query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "search",
      aggregateType: "Order",
      criteria: { status: "active" }
    });
    if (result.status !== "executed") throw new Error("Search should execute");
  });

  suite.addTest("Relationships query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "relationships",
      aggregateType: "Project",
      aggregateId: "proj-123"
    });
    if (result.status !== "executed") throw new Error("Relationships should execute");
  });

  suite.addTest("Status query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "status",
      aggregateType: "Task",
      aggregateId: "task-456"
    });
    if (result.status !== "executed") throw new Error("Status query should execute");
  });

  suite.addTest("Module lookup query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "moduleLookup",
      aggregateType: "Module"
    });
    if (result.status !== "executed") throw new Error("Module lookup should execute");
  });

  suite.addTest("Metadata lookup query executes", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "metadataLookup",
      aggregateType: "Company"
    });
    if (result.status !== "executed") throw new Error("Metadata lookup should execute");
  });

  suite.addTest("Query result is always read-only", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "list",
      aggregateType: "Customer"
    });
    if (!result.isReadOnly()) throw new Error("Query should be read-only");
    if (result.rowsAffected !== 0) throw new Error("Query should affect zero rows");
  });

  suite.addTest("Missing queryType fails validation", async () => {
    const query = new RuntimeQuery({
      aggregateType: "Company"
    });
    const validation = query.validate();
    if (validation.isValid) throw new Error("Should have validation errors");
  });

  suite.addTest("Invalid queryType fails validation", async () => {
    const query = new RuntimeQuery({
      queryType: "invalidQueryType",
      aggregateType: "Company"
    });
    const validation = query.validate();
    if (validation.isValid) throw new Error("Should have validation errors");
  });

  suite.addTest("GetById without aggregateId fails", async () => {
    const query = new RuntimeQuery({
      queryType: "getById",
      aggregateType: "Company"
    });
    const validation = query.validate();
    if (validation.isValid) throw new Error("GetById requires aggregateId");
  });

  suite.addTest("Bus tracks query history", async () => {
    const bus = new QueryBus();
    bus.initialize();
    await bus.execute({
      queryType: "list",
      aggregateType: "Company"
    });
    await bus.execute({
      queryType: "search",
      aggregateType: "Customer",
      criteria: { status: "active" }
    });
    const history = bus.getHistory();
    if (history.length !== 2) throw new Error(`Expected 2 queries, got ${history.length}`);
  });

  suite.addTest("Get query by ID returns query", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "list",
      aggregateType: "Company"
    });
    const retrieved = bus.getQuery(result.queryId);
    if (!retrieved) throw new Error("Query not found");
    if (retrieved.queryId !== result.queryId) throw new Error("ID mismatch");
  });

  suite.addTest("Statistics track query counts", async () => {
    const bus = new QueryBus();
    bus.initialize();
    await bus.execute({
      queryType: "list",
      aggregateType: "Company"
    });
    await bus.execute({
      queryType: "list",
      aggregateType: "Customer"
    });
    const stats = bus.getStats();
    if (stats.total !== 2) throw new Error(`Expected 2 total queries`);
    if (stats.successful !== 2) throw new Error(`Expected 2 successful`);
    if (!stats.readOnly) throw new Error("Stats should show read-only");
  });

  suite.addTest("Query result tracks items returned", async () => {
    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute({
      queryType: "list",
      aggregateType: "Customer"
    });
    if (result.totalCount === 0) throw new Error("Should have returned items");
    if (result.results.length !== result.totalCount) throw new Error("Count mismatch");
  });

  suite.addTest("Query with criteria executes", async () => {
    const query = new RuntimeQuery({
      queryType: "search",
      aggregateType: "Order",
      criteria: { status: "pending", priority: "high" }
    });
    const validation = query.validate();
    if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(", ")}`);

    const bus = new QueryBus();
    bus.initialize();
    const result = await bus.execute(query);
    if (result.status !== "executed") throw new Error("Should execute");
  });

  suite.addTest("Invalid criteria fails validation", async () => {
    const query = new RuntimeQuery({
      queryType: "search",
      aggregateType: "Order",
      criteria: "not an object"
    });
    const validation = query.validate();
    if (validation.isValid) throw new Error("Should have validation errors");
  });

  suite.addTest("Query result tracks execution time", async () => {
    const result = new RuntimeQueryResult({
      queryType: "list",
      aggregateType: "Company"
    });
    const startTime = new Date(result.startTime);
    result.markExecuted();
    const endTime = new Date(result.endTime);
    if (!result.endTime) throw new Error("endTime should be set");
    if (result.duration < 0) throw new Error("Duration should be non-negative");
    if (endTime < startTime) throw new Error("endTime should be after startTime");
  });

  return suite;
}
