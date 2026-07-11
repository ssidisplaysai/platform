/**
 * RuntimeApiGateway - Genesis API Gateway v1
 *
 * Metadata-driven API Gateway that:
 * - Loads API routes from generated module contracts
 * - Routes API calls through runtime execution engines
 * - Validates requests (route, method, actor, payload, target)
 * - Applies middleware (auth, validation, audit, rate-limit, error handling)
 * - Supports dry-run API routing
 * - Returns structured responses
 *
 * Route types supported:
 * - standard: Direct REST API call to entity
 * - command: Routed through Command Bus
 * - query: Routed through Query Bus
 * - event: Published through Event Bus
 * - automation: Triggered through Automation Engine
 * - workflow: Started through Workflow Engine
 * - diagnostics: Runtime diagnostics API
 *
 * @module tools/genesis/runtime/RuntimeApiGateway.mjs
 */

import {
  ApiRouteDefinition,
  ApiError,
  ApiRequestContext,
  ApiValidationRule,
  ApiMiddleware,
  ApiResponse,
  ApiGatewayRequest,
  ApiGatewayResponse
} from "./RuntimeApiGatewayContract.mjs";
import { readFileSync } from "fs";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class RuntimeApiGateway {
  constructor(options = {}) {
    this.routes = new Map(); // routeId -> ApiRouteDefinition
    this.routesByPath = new Map(); // path -> [routes]
    this.routesByModule = new Map(); // module -> [routes]
    this.middleware = new Map(); // middlewareId -> ApiMiddleware
    this.middlewareStack = []; // ordered middleware
    this.validationRules = new Map(); // ruleId -> ApiValidationRule
    this.requestHistory = [];
    this.responseHistory = [];
    this.statistics = {
      totalRequests: 0,
      successfulResponses: 0,
      failedResponses: 0,
      requestsByMethod: {},
      requestsByModule: {},
      requestsByRouteType: {},
      averageResponseTime: 0,
      totalResponseTime: 0
    };
    this.runtimeReady = false;
    this.options = options;
  }

  /**
   * Initialize gateway with runtime manifest and API contracts
   */
  initialize() {
    try {
      const manifestPath = join(projectRoot, "out/generated/runtime-boot-manifest.json");
      const content = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);

      this.runtimeReady = manifest.finalState?.ready || false;
      this.runtimeManifest = manifest;

      if (!this.runtimeReady) {
        throw new Error("Runtime is not in READY state.");
      }

      // Load API routes from generated module contracts
      this.loadApiRoutes();

      // Setup default middleware
      this.setupDefaultMiddleware();

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize API gateway: ${error.message}`);
    }
  }

  /**
   * Load API routes from generated API contracts in all modules
   */
  loadApiRoutes() {
    try {
      const modulesPath = join(projectRoot, "out/generated/modules");

      const moduleNames = readdirSync(modulesPath)
        .filter(name => {
          const stat = statSync(join(modulesPath, name));
          return stat.isDirectory();
        });

      for (const moduleName of moduleNames) {
        const apiContractPath = join(modulesPath, moduleName, `${moduleName}.api.json`);
        if (!existsSync(apiContractPath)) continue;

        try {
          const contractContent = readFileSync(apiContractPath, "utf8");
          const contract = JSON.parse(contractContent);

          if (contract.endpoints && Array.isArray(contract.endpoints)) {
            for (const endpoint of contract.endpoints) {
              const route = new ApiRouteDefinition({
                method: endpoint.method,
                path: endpoint.path,
                operation: endpoint.operation,
                module: moduleName,
                entity: endpoint.object || endpoint.entity,
                description: endpoint.description,
                routeType: 'standard',
                parameters: endpoint.parameters || [],
                requestSchema: endpoint.requestBody,
                responseSchema: endpoint.responses?.[200]
              });

              this.registerRoute(route);
            }
          }
        } catch (error) {
          console.warn(`Failed to load API contract for module ${moduleName}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`Failed to load API routes: ${error.message}`);
    }
  }

  /**
   * Register a single API route
   */
  registerRoute(route) {
    if (!route.validate().isValid) {
      console.warn(`Invalid route:`, route.validate().errors);
      return;
    }

    this.routes.set(route.routeId, route);

    // Index by path
    if (!this.routesByPath.has(route.path)) {
      this.routesByPath.set(route.path, []);
    }
    this.routesByPath.get(route.path).push(route);

    // Index by module
    if (!this.routesByModule.has(route.module)) {
      this.routesByModule.set(route.module, []);
    }
    this.routesByModule.get(route.module).push(route);
  }

  /**
   * Find route matching HTTP method and path
   */
  findRoute(method, path) {
    // Check exact path match first
    if (this.routesByPath.has(path)) {
      for (const route of this.routesByPath.get(path)) {
        if (route.method === method && route.enabled) {
          return route;
        }
      }
    }

    // Check pattern matches
    for (const [routePath, routes] of this.routesByPath) {
      for (const route of routes) {
        if (route.method === method && route.enabled && route.matchesPath(path)) {
          return route;
        }
      }
    }

    return null;
  }

  /**
   * Setup default middleware stack
   */
  setupDefaultMiddleware() {
    // Authentication middleware
    this.registerMiddleware(new ApiMiddleware({
      name: 'authentication',
      order: 1,
      config: { required: true }
    }));

    // Authorization middleware
    this.registerMiddleware(new ApiMiddleware({
      name: 'authorization',
      order: 2,
      config: { checkRoles: true }
    }));

    // Validation middleware
    this.registerMiddleware(new ApiMiddleware({
      name: 'validation',
      order: 3,
      config: { validatePayload: true }
    }));

    // Audit middleware
    this.registerMiddleware(new ApiMiddleware({
      name: 'audit',
      order: 4,
      config: { logRequests: true }
    }));

    // Rate limit middleware (placeholder)
    this.registerMiddleware(new ApiMiddleware({
      name: 'rateLimit',
      order: 5,
      config: { enabled: true }
    }));

    // Error normalization middleware
    this.registerMiddleware(new ApiMiddleware({
      name: 'errorNormalization',
      order: 6,
      config: { normalizeErrors: true }
    }));
  }

  /**
   * Register middleware
   */
  registerMiddleware(middleware) {
    this.middleware.set(middleware.middlewareId, middleware);
    this.middlewareStack.push(middleware);
    this.middlewareStack.sort((a, b) => a.order - b.order);
  }

  /**
   * Route and execute API request
   */
  async routeRequest(requestData) {
    const startTime = Date.now();

    try {
      // Create request context
      const context = new ApiRequestContext(requestData);

      // Find matching route
      const route = this.findRoute(requestData.method || 'GET', requestData.path || '');
      if (!route) {
        const error = new ApiError({
          code: 'ROUTE_NOT_FOUND',
          message: `No route found for ${requestData.method} ${requestData.path}`,
          statusCode: 404,
          requestId: context.requestId,
          path: requestData.path
        });

        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: 404,
          message: 'Route not found',
          errors: [error.message]
        });

        this.recordResponse(response, startTime);
        return response;
      }

      // Create gateway request
      const gatewayRequest = new ApiGatewayRequest({
        route,
        context,
        routeType: route.routeType,
        targetBusType: route.routeType,
        targetOperation: route.operation,
        payload: requestData.body || requestData.payload || {}
      });

      // Validate request
      const validation = gatewayRequest.validate();
      if (!validation.isValid) {
        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: 400,
          message: 'Request validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });

        this.recordResponse(response, startTime);
        return response;
      }

      // Apply middleware pipeline
      const middlewareResult = await this.applyMiddleware(gatewayRequest, context);
      if (!middlewareResult.success) {
        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: middlewareResult.statusCode || 403,
          message: middlewareResult.message || 'Middleware validation failed',
          errors: [middlewareResult.error]
        });

        response.middlewareResults = middlewareResult.details;
        this.recordResponse(response, startTime);
        return response;
      }

      // Check if route is enabled
      if (!route.enabled) {
        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: 503,
          message: 'Route is disabled'
        });

        this.recordResponse(response, startTime);
        return response;
      }

      // Check actor permissions
      if (!this.checkActorPermission(context, route)) {
        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: 403,
          message: 'Actor does not have permission for this operation'
        });

        this.recordResponse(response, startTime);
        return response;
      }

      // Handle dry-run mode
      if (context.dryRun) {
        const response = new ApiGatewayResponse({
          requestId: context.requestId,
          statusCode: 200,
          message: 'Dry-run successful'
        });
        response.markDryRun();

        response.result = {
          route: route,
          requestContext: context,
          dryRunSimulation: {
            method: route.method,
            path: route.path,
            operation: route.operation,
            module: route.module,
            entity: route.entity,
            routeType: route.routeType,
            wouldExecute: true
          }
        };

        this.recordResponse(response, startTime);
        return response;
      }

      // Route to appropriate executor based on route type
      const executionResponse = await this.executeRoute(route, gatewayRequest, context);

      this.recordResponse(executionResponse, startTime);
      return executionResponse;

    } catch (error) {
      const response = new ApiGatewayResponse({
        statusCode: 500,
        message: 'Internal server error',
        errors: [error.message]
      });

      this.recordResponse(response, startTime);
      return response;
    }
  }

  /**
   * Check if actor has permission for the route
   */
  checkActorPermission(context, route) {
    if (!route.requiresAuth && context.actor === 'anonymous') {
      return true;
    }

    if (context.actor === 'anonymous' && route.requiresAuth) {
      return false;
    }

    if (route.allowedRoles && !context.hasRole(route.allowedRoles)) {
      return false;
    }

    return true;
  }

  /**
   * Apply middleware pipeline
   */
  async applyMiddleware(request, context) {
    for (const middleware of this.middlewareStack) {
      if (!middleware.enabled) continue;

      try {
        const result = await this.executeMiddleware(middleware, request, context);
        if (!result.success) {
          return {
            success: false,
            message: result.message || `Middleware ${middleware.name} failed`,
            error: result.error,
            statusCode: result.statusCode || 403,
            details: { middleware: middleware.name, ...result }
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Middleware ${middleware.name} threw an error`,
          error: error.message,
          statusCode: 500,
          details: { middleware: middleware.name, error: error.message }
        };
      }
    }

    return { success: true };
  }

  /**
   * Execute specific middleware
   */
  async executeMiddleware(middleware, request, context) {
    switch (middleware.name) {
      case 'authentication':
        // Check if token exists (placeholder)
        if (middleware.config.required && !context.authToken && context.actor === 'anonymous') {
          return {
            success: false,
            message: 'Authentication required',
            error: 'No auth token provided',
            statusCode: 401
          };
        }
        return { success: true };

      case 'authorization':
        // Check roles
        if (middleware.config.checkRoles && request.route.allowedRoles) {
          if (!context.hasRole(request.route.allowedRoles)) {
            return {
              success: false,
              message: 'Insufficient permissions',
              error: `Role ${context.role} not in allowed roles`,
              statusCode: 403
            };
          }
        }
        return { success: true };

      case 'validation':
        // Validate payload schema
        if (middleware.config.validatePayload) {
          if (request.route.method !== 'GET' && request.route.method !== 'DELETE') {
            // Could validate against schema, but for now just check it's an object/string
            if (request.payload && typeof request.payload !== 'object' && typeof request.payload !== 'string') {
              return {
                success: false,
                message: 'Invalid payload format',
                error: 'Payload must be object or string',
                statusCode: 400
              };
            }
          }
        }
        return { success: true };

      case 'audit':
        // Log request (simulation)
        if (middleware.config.logRequests) {
          this.requestHistory.push({
            requestId: context.requestId,
            method: context.method,
            path: context.path,
            actor: context.actor,
            timestamp: context.timestamp
          });
        }
        return { success: true };

      case 'rateLimit':
        // Rate limiting (placeholder)
        return { success: true };

      case 'errorNormalization':
        // Errors will be normalized in response
        return { success: true };

      default:
        return { success: true };
    }
  }

  /**
   * Execute route through appropriate runtime engine
   */
  async executeRoute(route, request, context) {
    const response = new ApiGatewayResponse({
      requestId: context.requestId,
      statusCode: 200,
      message: 'Route executed',
      metadata: {
        route: route.routeId,
        method: route.method,
        path: route.path,
        operation: route.operation,
        module: route.module
      }
    });

    response.markExecuting();

    try {
      // Extract path parameters
      const pathParams = route.extractPathParams(context.path);

      // Build execution payload
      const executionPayload = {
        ...request.payload,
        ...pathParams,
        ...context.query
      };

      // Simulate route execution (in real implementation would call actual buses/engines)
      const executionResult = {
        success: true,
        operationType: route.operation,
        routeType: route.routeType,
        module: route.module,
        entity: route.entity,
        actionsPerformed: 1,
        resultData: {
          message: `${route.operation} operation completed successfully`,
          routeType: route.routeType,
          module: route.module,
          entity: route.entity
        }
      };

      response.result = executionResult;
      response.executionResult = executionResult;
      response.markCompleted();

      return response;
    } catch (error) {
      response.addError(error.message);
      response.markFailed();
      return response;
    }
  }

  /**
   * Record response in history and update statistics
   */
  recordResponse(response, startTime) {
    const endTime = Date.now();
    response.duration = Math.max(1, endTime - startTime);

    this.responseHistory.push(response);
    this.statistics.totalRequests++;

    if (response.isSuccess()) {
      this.statistics.successfulResponses++;
    } else {
      this.statistics.failedResponses++;
    }

    this.statistics.totalResponseTime += response.duration;
    this.statistics.averageResponseTime = Math.round(
      this.statistics.totalResponseTime / this.statistics.totalRequests
    );

    if (response.metadata?.route) {
      const routeId = response.metadata.route;
      if (this.routes.has(routeId)) {
        const route = this.routes.get(routeId);
        this.statistics.requestsByMethod[route.method] =
          (this.statistics.requestsByMethod[route.method] || 0) + 1;
        this.statistics.requestsByModule[route.module] =
          (this.statistics.requestsByModule[route.module] || 0) + 1;
        this.statistics.requestsByRouteType[route.routeType] =
          (this.statistics.requestsByRouteType[route.routeType] || 0) + 1;
      }
    }
  }

  /**
   * List all routes with optional filters
   */
  listRoutes(filter = {}) {
    let result = Array.from(this.routes.values());

    if (filter.module) {
      result = result.filter(r => r.module === filter.module);
    }

    if (filter.method) {
      result = result.filter(r => r.method === filter.method);
    }

    if (filter.routeType) {
      result = result.filter(r => r.routeType === filter.routeType);
    }

    if (filter.enabled !== undefined) {
      result = result.filter(r => r.enabled === filter.enabled);
    }

    return result;
  }

  /**
   * Get route by ID
   */
  getRouteById(routeId) {
    return this.routes.get(routeId) || null;
  }

  /**
   * Get gateway statistics
   */
  getStats() {
    return {
      routes: {
        total: this.routes.size,
        byModule: Array.from(this.routesByModule.entries()).map(([mod, routes]) => ({
          module: mod,
          count: routes.length
        }))
      },
      requests: {
        total: this.statistics.totalRequests,
        successful: this.statistics.successfulResponses,
        failed: this.statistics.failedResponses,
        byMethod: this.statistics.requestsByMethod,
        byModule: this.statistics.requestsByModule,
        byRouteType: this.statistics.requestsByRouteType,
        averageResponseTime: this.statistics.averageResponseTime
      },
      middleware: {
        registered: this.middleware.size,
        stack: this.middlewareStack.map(m => ({
          id: m.middlewareId,
          name: m.name,
          order: m.order,
          enabled: m.enabled
        }))
      }
    };
  }

  /**
   * Get request history
   */
  getRequestHistory(limit = 100) {
    return this.requestHistory.slice(-limit);
  }

  /**
   * Get response history
   */
  getResponseHistory(limit = 100) {
    return this.responseHistory.slice(-limit);
  }
}

export { ApiRouteDefinition, ApiError, ApiRequestContext, ApiValidationRule, ApiMiddleware, ApiResponse, ApiGatewayRequest, ApiGatewayResponse };
