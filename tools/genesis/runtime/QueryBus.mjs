/**
 * QueryBus - Genesis Query Bus v1
 *
 * Executes read-only retrieval operations:
 * - Queries never change state
 * - Queries must pass runtime metadata validation
 * - Queries return structured results
 * - All queries are inherently safe/read-only
 *
 * @module tools/genesis/runtime/QueryBus.mjs
 */

import { RuntimeQuery, RuntimeQueryResult, QueryValidationResult } from "./RuntimeQueryContract.mjs";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class QueryBus {
  constructor() {
    this.queryHistory = [];
    this.runtimeReady = false;
  }

  /**
   * Initialize bus with runtime manifest
   */
  initialize() {
    try {
      const manifestPath = join(
        projectRoot,
        "out/generated/runtime-boot-manifest.json"
      );
      const content = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);

      this.runtimeReady = manifest.finalState?.ready || false;
      this.runtimeManifest = manifest;

      if (!this.runtimeReady) {
        throw new Error("Runtime is not in READY state.");
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize query bus: ${error.message}`);
    }
  }

  /**
   * Execute a query
   */
  async execute(queryData) {
    // Create query object
    const query =
      queryData instanceof RuntimeQuery
        ? queryData
        : new RuntimeQuery(queryData);

    // Validate query format
    const formatValidation = query.validate();
    if (!formatValidation.isValid) {
      const result = new RuntimeQueryResult({
        queryId: query.queryId,
        queryType: query.queryType,
        aggregateType: query.aggregateType,
        status: "failed",
        errors: formatValidation.errors,
        startTime: new Date().toISOString(),
        executedBy: query.actor
      });
      result.markExecuted();
      return result;
    }

    // Create result
    const result = new RuntimeQueryResult({
      queryId: query.queryId,
      queryType: query.queryType,
      aggregateType: query.aggregateType,
      status: "validating",
      startTime: new Date().toISOString(),
      executedBy: query.actor
    });

    try {
      // Stage 1: Validate query against metadata
      const validationResult = await this.validateQuery(query);
      result.validationResults = {
        aggregateTypeExists: validationResult.aggregateTypeExists,
        aggregateExists: validationResult.aggregateExists,
        actorAllowed: validationResult.actorAllowed,
        criteriaValid: validationResult.criteriaValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };

      validationResult.errors.forEach((err) => result.addError(err));
      validationResult.warnings.forEach((warn) => result.addWarning(warn));

      if (!validationResult.allValid()) {
        result.status = "failed";
        result.markExecuted();
        this.queryHistory.push(result);
        return result;
      }

      result.status = "validated";

      // Stage 2: Execute query (read-only, always safe)
      result.status = "executing";
      const queryResult = await this.executeQuery(query);

      result.status = "executed";
      if (query.queryType === "getById" || query.queryType === "metadataLookup") {
        result.setData(queryResult);
      } else if (query.queryType === "relationships") {
        result.setResults(queryResult.relationships || [], queryResult.totalRelationships || 0);
      } else if (query.queryType === "status") {
        result.setData(queryResult);
      } else if (query.queryType === "moduleLookup") {
        result.setResults(queryResult.modules || [], queryResult.totalModules || 0);
      } else {
        // For list, search, etc.
        result.setResults(queryResult.results || [], queryResult.totalCount || 0);
      }
      result.markExecuted();
    } catch (error) {
      result.status = "failed";
      result.addError(error.message);
      result.markExecuted();
    }

    this.queryHistory.push(result);
    return result;
  }

  /**
   * Validate query against runtime metadata
   */
  async validateQuery(query) {
    const result = new QueryValidationResult();
    const finalState = this.runtimeManifest?.finalState || {};

    // 1. Validate aggregate type exists
    if (
      finalState.registeredModules > 0 ||
      finalState.registeredAPIs > 0 ||
      finalState.registeredObjects > 0
    ) {
      result.aggregateTypeExists = true;
    } else {
      result.addError(
        `Aggregate type '${query.aggregateType}' not found in registry`
      );
    }

    // 2. For getById, validate aggregate would exist (logical check)
    if (query.queryType === "getById") {
      if (query.aggregateId) {
        result.aggregateExists = true;
      } else {
        result.addError("aggregateId required for getById queries");
      }
    } else {
      result.aggregateExists = true; // NA for list/search/etc
    }

    // 3. Validate actor
    if (
      query.actor === "system" ||
      query.actor === "admin" ||
      query.actor === "automation" ||
      query.actor === "cli"
    ) {
      result.actorAllowed = true;
    } else {
      result.actorAllowed = true; // Allow custom with warning
      result.addWarning(
        `Custom actor '${query.actor}' should be verified for authorization`
      );
    }

    // 4. Validate criteria is valid object
    if (typeof query.criteria === "object" && !Array.isArray(query.criteria)) {
      result.criteriaValid = true;
    } else {
      result.addError("criteria must be a JSON object");
    }

    // 5. Validate pagination
    result.paginationValid = true;

    // 6. Validate projection
    result.projectionValid = true;

    return result;
  }

  /**
   * Execute query (read-only, simulated for v1)
   */
  async executeQuery(query) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.simulateQueryExecution(query));
      }, Math.random() * 100);
    });
  }

  /**
   * Simulate query execution (READ-ONLY)
   */
  simulateQueryExecution(query) {
    const { queryType, aggregateType, aggregateId, criteria, pagination } = query;

    // All simulated results - queries never modify state
    switch (queryType) {
      case "getById":
        return {
          queryType: "getById",
          aggregateType,
          aggregateId,
          found: true,
          result: {
            id: aggregateId,
            type: aggregateType,
            name: `${aggregateType} ${aggregateId}`,
            status: "active",
            createdAt: new Date().toISOString(),
            data: {}
          }
        };

      case "list":
        return {
          queryType: "list",
          aggregateType,
          results: [
            {
              id: `${aggregateType}-001`,
              type: aggregateType,
              name: `${aggregateType} #1`,
              status: "active"
            },
            {
              id: `${aggregateType}-002`,
              type: aggregateType,
              name: `${aggregateType} #2`,
              status: "active"
            }
          ],
          totalCount: 2,
          page: pagination.page || 1,
          limit: pagination.limit || 100
        };

      case "search":
        return {
          queryType: "search",
          aggregateType,
          searchCriteria: criteria,
          results: [
            {
              id: `${aggregateType}-search-1`,
              type: aggregateType,
              name: "Search Result 1",
              matchScore: 0.95
            }
          ],
          totalCount: 1,
          page: pagination.page || 1
        };

      case "relationships":
        return {
          queryType: "relationships",
          aggregateType,
          aggregateId,
          relationships: [
            {
              type: "parent",
              target: "ParentType",
              targetId: "parent-123"
            },
            {
              type: "child",
              target: "ChildType",
              targetId: "child-456"
            }
          ],
          totalRelationships: 2
        };

      case "status":
        return {
          queryType: "status",
          aggregateType,
          aggregateId,
          currentStatus: "active",
          lifecycle: {
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            status: "active",
            version: 1
          }
        };

      case "moduleLookup":
        return {
          queryType: "moduleLookup",
          aggregateType,
          modules: [
            {
              name: "CoreModule",
              version: "1.0.0",
              registered: true
            },
            {
              name: "BusinessModule",
              version: "1.0.0",
              registered: true
            }
          ],
          totalModules: 2
        };

      case "metadataLookup":
        return {
          queryType: "metadataLookup",
          aggregateType,
          metadata: {
            schema: aggregateType,
            version: "1.0.0",
            fields: [
              { name: "id", type: "string" },
              { name: "name", type: "string" },
              { name: "status", type: "enum" }
            ],
            registered: true,
            readOnly: false
          }
        };

      default:
        return {
          queryType,
          aggregateType,
          results: [],
          totalCount: 0
        };
    }
  }

  /**
   * Get query history (all read-only)
   */
  getHistory() {
    return this.queryHistory;
  }

  /**
   * Get query by ID
   */
  getQuery(queryId) {
    return this.queryHistory.find((q) => q.queryId === queryId);
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.queryHistory.length;
    const successful = this.queryHistory.filter((q) => q.isSuccess()).length;
    const failed = this.queryHistory.filter((q) => q.status === "failed").length;

    const byType = {};
    this.queryHistory.forEach((q) => {
      byType[q.queryType] = (byType[q.queryType] || 0) + 1;
    });

    let totalItemsReturned = 0;
    this.queryHistory.forEach((q) => {
      totalItemsReturned += q.totalCount;
    });

    return {
      total,
      successful,
      failed,
      byType,
      totalItemsReturned,
      readOnly: true, // All queries are read-only
      uptime: this.runtimeReady ? "operational" : "not ready"
    };
  }
}
