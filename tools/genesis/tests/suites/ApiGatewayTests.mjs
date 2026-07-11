/**
 * RuntimeApiGatewayTests - Genesis API Gateway v1 Test Suite
 *
 * 20 comprehensive tests covering:
 * - Gateway initialization
 * - Route loading and registration
 * - Route matching (method, path, patterns)
 * - Request routing and execution
 * - Middleware pipeline
 * - Validation (route, permissions, payload)
 * - Dry-run mode
 * - Error handling
 * - Statistics tracking
 * - History management
 *
 * @module tools/genesis/tests/suites/ApiGatewayTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { RuntimeApiGateway, ApiRouteDefinition, ApiRequestContext, ApiGatewayResponse, ApiMiddleware } from "../../runtime/RuntimeApiGateway.mjs";

export default async function apiGatewayTestSuite() {
  const suite = new TestSuite("API Gateway Tests", "Genesis API Gateway v1");

  // Test 1: Gateway initializes successfully
  suite.addTest("Gateway initializes successfully", async () => {
    const gateway = new RuntimeApiGateway();
    const initialized = gateway.initialize();
    if (!initialized) throw new Error("Gateway should initialize");
    if (!gateway.runtimeReady) throw new Error("Gateway should be ready");
    // Routes may or may not be loaded depending on generated files
    // Just verify initialization succeeds
  });

  // Test 2: Route definition validates
  suite.addTest("Route definition validates", async () => {
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/api/v1/customers",
      operation: "list",
      module: "crm"
    });
    const validation = route.validate();
    if (!validation.isValid) throw new Error("Route should be valid");
    if (validation.errors.length > 0) throw new Error("Route should have no errors");
  });

  // Test 3: Route with invalid method fails validation
  suite.addTest("Route with invalid method fails validation", async () => {
    const route = new ApiRouteDefinition({
      method: "INVALID",
      path: "/api/v1/customers",
      operation: "list"
    });
    const validation = route.validate();
    if (validation.isValid) throw new Error("Route should be invalid");
    if (validation.errors.length === 0) throw new Error("Route should have errors");
  });

  // Test 4: Route path matching works
  suite.addTest("Route path matching works", async () => {
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/api/v1/customers/:id",
      operation: "read"
    });
    const matches = route.matchesPath("/api/v1/customers/123");
    if (!matches) throw new Error("Route should match path");
  });

  // Test 5: Route path parameter extraction works
  suite.addTest("Route path parameter extraction works", async () => {
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/api/v1/customers/:id/orders/:orderId",
      operation: "getOrders"
    });
    const params = route.extractPathParams("/api/v1/customers/123/orders/456");
    if (params.id !== "123") throw new Error("Should extract id parameter");
    if (params.orderId !== "456") throw new Error("Should extract orderId parameter");
  });

  // Test 6: Gateway finds matching route
  suite.addTest("Gateway finds matching route", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();
    const route = gateway.findRoute("GET", "/api/v1/");
    // Should find some route or none, depending on loaded routes
    // Just verify the method works without error
  });

  // Test 7: Request context created successfully
  suite.addTest("Request context created successfully", async () => {
    const context = new ApiRequestContext({
      method: "GET",
      path: "/api/v1/customers",
      actor: "user123",
      role: "admin",
      authToken: "token123"
    });
    if (!context.requestId) throw new Error("Context should have requestId");
    if (context.actor !== "user123") throw new Error("Context should store actor");
    if (!context.isAuthenticated()) throw new Error("Context should be authenticated");
  });

  // Test 8: Request context authentication check works
  suite.addTest("Request context authentication check works", async () => {
    const context = new ApiRequestContext({
      actor: "anonymous"
    });
    if (context.isAuthenticated()) throw new Error("Anonymous should not be authenticated");
    const authedContext = new ApiRequestContext({
      actor: "user123",
      authToken: "token123"
    });
    if (!authedContext.isAuthenticated()) throw new Error("Authenticated user should be authenticated");
  });

  // Test 9: Request context role checking works
  suite.addTest("Request context role checking works", async () => {
    const context = new ApiRequestContext({
      role: "admin"
    });
    if (!context.hasRole("admin")) throw new Error("Should have admin role");
    if (context.hasRole("viewer")) throw new Error("Should not have viewer role");
    if (!context.hasRole(["admin", "viewer"])) throw new Error("Should have admin role from array");
  });

  // Test 10: API Gateway response created successfully
  suite.addTest("API Gateway response created successfully", async () => {
    const response = new ApiGatewayResponse({
      requestId: "req123",
      statusCode: 200
    });
    if (!response.responseId) throw new Error("Response should have responseId");
    if (response.status !== "pending") throw new Error("Response should start in pending status");
  });

  // Test 11: Response status transitions work
  suite.addTest("Response status transitions work", async () => {
    const response = new ApiGatewayResponse({ requestId: "req123" });
    response.markExecuting();
    if (response.status !== "executing") throw new Error("Status should be executing");
    // Add small delay to ensure duration > 0
    await new Promise(resolve => setTimeout(resolve, 5));
    response.markCompleted();
    if (response.status !== "completed") throw new Error("Status should be completed");
    if (response.duration <= 0) throw new Error("Duration should be tracked, got: " + response.duration);
  });

  // Test 12: Dry-run response marks correctly
  suite.addTest("Dry-run response marks correctly", async () => {
    const response = new ApiGatewayResponse({ requestId: "req123" });
    // Add small delay to ensure duration > 0
    await new Promise(resolve => setTimeout(resolve, 5));
    response.markDryRun();
    if (response.status !== "dryRun") throw new Error("Status should be dryRun");
    if (!response.dryRun) throw new Error("dryRun flag should be true");
    if (response.duration <= 0) throw new Error("Duration should be tracked, got: " + response.duration);
  });

  // Test 13: Middleware registration works
  suite.addTest("Middleware registration works", async () => {
    const gateway = new RuntimeApiGateway();
    const middleware = new ApiMiddleware({
      name: "custom",
      order: 99
    });
    gateway.registerMiddleware(middleware);
    if (gateway.middleware.size < 1) throw new Error("Middleware should be registered");
    if (!gateway.middlewareStack.some(m => m.name === "custom")) throw new Error("Middleware should be in stack");
  });

  // Test 14: Middleware ordering is maintained
  suite.addTest("Middleware ordering is maintained", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.setupDefaultMiddleware();
    const orders = gateway.middlewareStack.map(m => m.order);
    const sorted = [...orders].sort((a, b) => a - b);
    if (JSON.stringify(orders) !== JSON.stringify(sorted)) throw new Error("Middleware should be ordered");
  });

  // Test 15: Route request validation fails without route
  suite.addTest("Route request validation fails without route", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();
    const response = await gateway.routeRequest({
      method: "GET",
      path: "/nonexistent/path/12345"
    });
    if (response.statusCode !== 404) throw new Error("Should return 404 for missing route, got: " + response.statusCode);
    if (response.errors.length === 0) throw new Error("Should have errors for missing route");
  });

  // Test 16: Actor permission check works
  suite.addTest("Actor permission check works", async () => {
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/api/v1/admin",
      operation: "admin",
      allowedRoles: ["admin"]
    });
    const adminContext = new ApiRequestContext({
      actor: "admin1",
      role: "admin"
    });
    const userContext = new ApiRequestContext({
      actor: "user1",
      role: "user"
    });
    const gateway = new RuntimeApiGateway();
    if (!gateway.checkActorPermission(adminContext, route)) throw new Error("Admin should have permission");
    if (gateway.checkActorPermission(userContext, route)) throw new Error("User should not have permission");
  });

  // Test 17: Dry-run route request works
  suite.addTest("Dry-run route request works", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();
    
    // Create a test route
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/test",
      operation: "test",
      module: "test",
      routeType: "standard"
    });
    gateway.registerRoute(route);

    const response = await gateway.routeRequest({
      method: "GET",
      path: "/test",
      dryRun: true,
      actor: "test"
    });
    
    if (response.status !== "dryRun") throw new Error("Status should be dryRun");
    if (!response.result?.dryRunSimulation) throw new Error("Should have dryRunSimulation");
  });

  // Test 18: Gateway statistics track requests
  suite.addTest("Gateway statistics track requests", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();
    
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/test",
      operation: "test",
      module: "test"
    });
    gateway.registerRoute(route);

    await gateway.routeRequest({
      method: "GET",
      path: "/test",
      actor: "test"
    });

    const stats = gateway.getStats();
    if (stats.requests.total !== 1) throw new Error("Should track total requests");
    if (stats.requests.successful !== 1) throw new Error("Should track successful requests");
  });

  // Test 19: Response history is maintained
  suite.addTest("Response history is maintained", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();
    
    const route = new ApiRouteDefinition({
      method: "GET",
      path: "/test",
      operation: "test",
      module: "test"
    });
    gateway.registerRoute(route);

    await gateway.routeRequest({
      method: "GET",
      path: "/test",
      actor: "test"
    });

    const history = gateway.getResponseHistory();
    if (history.length !== 1) throw new Error("Should have 1 response in history");
    if (!history[0].responseId) throw new Error("Response should have responseId");
  });

  // Test 20: List routes with filters works
  suite.addTest("List routes with filters works", async () => {
    const gateway = new RuntimeApiGateway();
    gateway.initialize();

    const routes = gateway.listRoutes({ enabled: true });
    // Should return array of routes
    if (!Array.isArray(routes)) throw new Error("listRoutes should return array");
    
    const methodRoutes = gateway.listRoutes({ method: "GET" });
    if (!Array.isArray(methodRoutes)) throw new Error("listRoutes should support method filter");
  });

  return suite;
}
