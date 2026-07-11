/**
 * RuntimeApiGatewayContract - Genesis API Gateway v1 Contracts
 *
 * Generic contracts for metadata-driven API Gateway:
 * - RuntimeApiGateway: Main gateway orchestrator
 * - ApiRouteDefinition: API route metadata
 * - ApiRequestContext: Request information and context
 * - ApiResponse: Structured response from API call
 * - ApiError: Error information
 * - ApiMiddleware: Middleware hooks (auth, validation, audit, etc.)
 * - ApiValidationRule: Validation rules for requests
 *
 * @module tools/genesis/runtime/RuntimeApiGatewayContract.mjs
 */

/**
 * ApiRouteDefinition - Metadata for a single API route
 * Loaded from generated API contracts
 */
export class ApiRouteDefinition {
  constructor(data = {}) {
    this.routeId = data.routeId || `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.method = data.method || 'GET'; // GET, POST, PUT, DELETE, PATCH
    this.path = data.path || '';
    this.operation = data.operation || ''; // list, create, read, update, delete, search, etc.
    this.module = data.module || '';
    this.entity = data.entity || '';
    this.description = data.description || '';
    this.routeType = data.routeType || 'standard'; // standard, query, command, event, automation, workflow, diagnostics
    this.isPublic = data.isPublic !== false; // default true
    this.requiresAuth = data.requiresAuth !== false; // default true
    this.allowedRoles = data.allowedRoles || ['user', 'admin'];
    this.rateLimit = data.rateLimit || { requests: 1000, window: '1h' };
    this.timeout = data.timeout || 30000;
    this.retryPolicy = data.retryPolicy || { maxRetries: 0 };
    this.dryRunSupported = data.dryRunSupported !== false; // default true
    this.parameters = data.parameters || []; // path, query, body parameters
    this.requestSchema = data.requestSchema || null;
    this.responseSchema = data.responseSchema || null;
    this.enabled = data.enabled !== false; // default true
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(this.method)) {
      errors.push(`Invalid HTTP method: ${this.method}`);
    }

    if (!this.path) {
      errors.push('Route path is required');
    }

    if (!this.operation) {
      errors.push('Operation is required');
    }

    if (!this.module) {
      warnings.push('Module not specified');
    }

    const validRouteTypes = ['standard', 'query', 'command', 'event', 'automation', 'workflow', 'diagnostics'];
    if (!validRouteTypes.includes(this.routeType)) {
      errors.push(`Invalid route type: ${this.routeType}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  matches(method, path) {
    if (this.method !== method) return false;
    return this.matchesPath(path);
  }

  matchesPath(path) {
    // Convert path with :id to regex pattern
    const routePattern = this.path
      .replace(/:[^/]+/g, '[^/]+')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(path);
  }

  extractPathParams(path) {
    const params = {};
    const routeParts = this.path.split('/');
    const pathParts = path.split('/');

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].substring(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }
}

/**
 * ApiError - Error information with details
 */
export class ApiError {
  constructor(data = {}) {
    this.errorId = data.errorId || `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.code = data.code || 'INTERNAL_ERROR';
    this.message = data.message || 'An error occurred';
    this.statusCode = data.statusCode || 500;
    this.details = data.details || {};
    this.timestamp = data.timestamp || new Date().toISOString();
    this.requestId = data.requestId || null;
    this.path = data.path || null;
  }

  toJSON() {
    return {
      errorId: this.errorId,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
      path: this.path
    };
  }
}

/**
 * ApiRequestContext - HTTP request context and metadata
 */
export class ApiRequestContext {
  constructor(data = {}) {
    this.requestId = data.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.method = data.method || 'GET';
    this.path = data.path || '';
    this.fullUrl = data.fullUrl || '';
    this.headers = data.headers || {};
    this.query = data.query || {};
    this.pathParams = data.pathParams || {};
    this.body = data.body || null;
    this.actor = data.actor || 'anonymous';
    this.role = data.role || 'user';
    this.authToken = data.authToken || null;
    this.clientIp = data.clientIp || null;
    this.userAgent = data.userAgent || null;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.dryRun = data.dryRun || false;
    this.correlationId = data.correlationId || null;
    this.metadata = data.metadata || {};
  }

  getHeader(name) {
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(this.headers)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }
    return null;
  }

  isAuthenticated() {
    return this.authToken !== null && this.actor !== 'anonymous';
  }

  hasRole(role) {
    if (!role) return true;
    if (typeof role === 'string') {
      return this.role === role;
    }
    if (Array.isArray(role)) {
      return role.includes(this.role);
    }
    return false;
  }
}

/**
 * ApiValidationRule - Validation rules for API requests
 */
export class ApiValidationRule {
  constructor(data = {}) {
    this.ruleId = data.ruleId || `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.fieldPath = data.fieldPath || ''; // dot notation for nested fields
    this.ruleName = data.ruleName || ''; // required, min, max, pattern, enum, custom
    this.value = data.value || null; // rule parameter
    this.message = data.message || '';
    this.enabled = data.enabled !== false;
  }

  validate(fieldValue) {
    if (!this.enabled) return { isValid: true, error: null };

    switch (this.ruleName) {
      case 'required':
        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          return { isValid: false, error: this.message || `Field is required` };
        }
        return { isValid: true, error: null };

      case 'min':
        if (typeof fieldValue === 'number' && fieldValue < this.value) {
          return { isValid: false, error: this.message || `Must be at least ${this.value}` };
        }
        if (typeof fieldValue === 'string' && fieldValue.length < this.value) {
          return { isValid: false, error: this.message || `Must be at least ${this.value} characters` };
        }
        return { isValid: true, error: null };

      case 'max':
        if (typeof fieldValue === 'number' && fieldValue > this.value) {
          return { isValid: false, error: this.message || `Must be at most ${this.value}` };
        }
        if (typeof fieldValue === 'string' && fieldValue.length > this.value) {
          return { isValid: false, error: this.message || `Must be at most ${this.value} characters` };
        }
        return { isValid: true, error: null };

      case 'pattern':
        const regex = new RegExp(this.value);
        if (!regex.test(fieldValue)) {
          return { isValid: false, error: this.message || `Invalid format` };
        }
        return { isValid: true, error: null };

      case 'enum':
        const validValues = Array.isArray(this.value) ? this.value : [this.value];
        if (!validValues.includes(fieldValue)) {
          return { isValid: false, error: this.message || `Must be one of: ${validValues.join(', ')}` };
        }
        return { isValid: true, error: null };

      default:
        return { isValid: true, error: null };
    }
  }
}

/**
 * ApiMiddleware - Middleware handler for request/response pipeline
 */
export class ApiMiddleware {
  constructor(data = {}) {
    this.middlewareId = data.middlewareId || `middleware-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name || ''; // authentication, authorization, validation, audit, rateLimit, errorNormalization
    this.order = data.order || 0; // execution order
    this.enabled = data.enabled !== false;
    this.config = data.config || {};
    this.errorHandler = data.errorHandler || null;
  }

  async execute(request, context) {
    // Implemented by specific middleware types
    return { success: true, request, context };
  }
}

/**
 * ApiResponse - Structured HTTP response
 */
export class ApiResponse {
  constructor(data = {}) {
    this.responseId = data.responseId || `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.requestId = data.requestId || null;
    this.statusCode = data.statusCode || 200;
    this.statusMessage = data.statusMessage || 'OK';
    this.headers = data.headers || { 'Content-Type': 'application/json' };
    this.body = data.body || null;
    this.metadata = data.metadata || {};
    this.timestamp = data.timestamp || new Date().toISOString();
    this.duration = data.duration || 0;
    this.dryRun = data.dryRun || false;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
  }

  isSuccess() {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  isFailed() {
    return !this.isSuccess();
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      statusMessage: this.statusMessage,
      body: this.body,
      headers: this.headers,
      metadata: this.metadata,
      timestamp: this.timestamp,
      duration: this.duration,
      dryRun: this.dryRun,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

/**
 * ApiGatewayRequest - Complete API Gateway request with validation
 */
export class ApiGatewayRequest {
  constructor(data = {}) {
    this.requestId = data.requestId || `api-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.route = data.route || null; // ApiRouteDefinition
    this.context = data.context || null; // ApiRequestContext
    this.targetBusType = data.targetBusType || null; // command, query, event, automation, workflow, diagnostics
    this.targetOperation = data.targetOperation || null;
    this.routeType = data.routeType || 'standard';
    this.payload = data.payload || {};
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.route) {
      errors.push('Route is required');
    } else {
      const routeValidation = this.route.validate();
      errors.push(...routeValidation.errors);
      warnings.push(...routeValidation.warnings);
    }

    if (!this.context) {
      errors.push('Request context is required');
    }

    if (!this.targetBusType) {
      warnings.push('Target bus type not specified');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * ApiGatewayResponse - Complete API Gateway response with execution results
 */
export class ApiGatewayResponse {
  constructor(data = {}) {
    this.responseId = data.responseId || `api-resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.requestId = data.requestId || null;
    this.status = data.status || 'pending'; // pending, executing, completed, failed, halted, dryRun
    this.statusCode = data.statusCode || 200;
    this.message = data.message || '';
    this.result = data.result || null;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.metadata = data.metadata || {};
    this.executionResult = data.executionResult || null;
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = null;
    this.duration = 0;
    this.dryRun = data.dryRun || false;
    this.middlewareResults = data.middlewareResults || {};
  }

  markExecuting() {
    this.status = 'executing';
  }

  markCompleted() {
    this.status = 'completed';
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  markFailed() {
    this.status = 'failed';
    this.statusCode = 400;
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  markDryRun() {
    this.status = 'dryRun';
    this.dryRun = true;
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  isSuccess() {
    return this.status === 'completed' || this.status === 'dryRun';
  }

  toJSON() {
    return {
      responseId: this.responseId,
      requestId: this.requestId,
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      result: this.result,
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      dryRun: this.dryRun
    };
  }
}
