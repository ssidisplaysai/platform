/**
 * RuntimeQueryContract - Query Bus contracts
 *
 * Defines contracts for read-only retrieval and search:
 * - get by id, list, search
 * - relationship lookup, status lookup
 * - module lookup, runtime metadata lookup
 *
 * Queries MUST be read-only (no state changes).
 * Queries MUST validate against runtime metadata.
 *
 * @module tools/genesis/runtime/RuntimeQueryContract.mjs
 */

/**
 * RuntimeQuery
 * Generic contract for all read-only retrieval operations
 */
export class RuntimeQuery {
  constructor(data = {}) {
    this.queryId = data.queryId || `qry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.queryType = data.queryType; // getById|list|search|relationships|status|moduleLookup|metadataLookup
    this.aggregateType = data.aggregateType; // what type of thing
    this.aggregateId = data.aggregateId; // optional - for getById
    this.criteria = data.criteria || {}; // search/filter criteria
    this.projection = data.projection || []; // fields to return
    this.sort = data.sort || {}; // sorting specification
    this.pagination = data.pagination || { page: 1, limit: 100 }; // pagination
    this.actor = data.actor || "system"; // who is querying
    this.metadata = data.metadata || {};
    this.issuedAt = new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.queryType) {
      errors.push("queryType is required");
    }

    if (!this.aggregateType) {
      errors.push("aggregateType is required");
    }

    const validQueryTypes = [
      "getById",
      "list",
      "search",
      "relationships",
      "status",
      "moduleLookup",
      "metadataLookup"
    ];

    if (this.queryType && !validQueryTypes.includes(this.queryType)) {
      errors.push(`queryType must be one of: ${validQueryTypes.join(", ")}`);
    }

    if (this.queryType === "getById" && !this.aggregateId) {
      errors.push("aggregateId is required for getById queries");
    }

    if (typeof this.criteria !== "object" || Array.isArray(this.criteria)) {
      errors.push("criteria must be a JSON object (not an array or primitive)");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isReadOnly() {
    // All queries are read-only by definition
    return true;
  }

  doesNotChangeState() {
    // Queries must never change state
    return true;
  }
}

/**
 * RuntimeQueryResult
 * Response from query execution
 */
export class RuntimeQueryResult {
  constructor(data = {}) {
    this.queryId = data.queryId;
    this.queryType = data.queryType;
    this.aggregateType = data.aggregateType;
    this.status = data.status; // pending|validated|executing|executed|failed
    this.data = data.data || null;
    this.results = data.results || [];
    this.totalCount = data.totalCount || 0;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.validationResults = data.validationResults || {};
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.metadata = data.metadata || {};
    this.executedBy = data.executedBy || null;
    this.rowsAffected = 0; // should always be 0 for queries
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  setData(data) {
    this.data = data;
  }

  setResults(results, totalCount = null) {
    this.results = results;
    this.totalCount = totalCount !== null ? totalCount : results.length;
  }

  markExecuted(endTime = null) {
    this.endTime = endTime || new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  isSuccess() {
    return (this.status === "executed") && this.errors.length === 0;
  }

  isReadOnly() {
    // Queries never change state
    return this.rowsAffected === 0;
  }
}

/**
 * QueryValidationResult
 * Validation status for query
 */
export class QueryValidationResult {
  constructor() {
    this.aggregateTypeExists = false;
    this.aggregateExists = false; // only for getById
    this.actorAllowed = false;
    this.criteriaValid = false;
    this.projectionValid = false;
    this.paginationValid = false;
    this.errors = [];
    this.warnings = [];
  }

  allValid() {
    return (
      this.aggregateTypeExists &&
      this.actorAllowed &&
      this.criteriaValid &&
      this.projectionValid &&
      this.paginationValid
    );
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}
