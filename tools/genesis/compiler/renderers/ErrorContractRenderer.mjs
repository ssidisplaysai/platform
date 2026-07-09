/**
 * ErrorContractRenderer
 *
 * Generates error response contracts from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint.api.errorResponses
 * Produces: TypeScript error types and error factory
 *
 * @module tools/genesis/compiler/renderers/ErrorContractRenderer.mjs
 */

/**
 * Generate error contracts from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript error contract code
 */
export function generateErrorContracts(blueprint) {
  const entityName = blueprint.metadata.entity;

  const lines = [];

  // Header
  lines.push('/**');
  lines.push(` * ${entityName} Error Response Contracts`);
  lines.push(' *');
  lines.push(' * Standard error response types for API interactions.');
  lines.push(' * Auto-generated from entity metadata.');
  lines.push(' *');
  lines.push(' * @generated true');
  lines.push(' */');
  lines.push('');

  // ValidationError interface
  lines.push('export interface ValidationError {');
  lines.push('  field: string;');
  lines.push('  message: string;');
  lines.push('  code?: string;');
  lines.push('  value?: any;');
  lines.push('}');
  lines.push('');

  // ErrorResponse interface
  lines.push('export interface ErrorResponse {');
  lines.push('  code: string;');
  lines.push('  message: string;');
  lines.push('  status: number;');
  lines.push('  errors?: ValidationError[];');
  lines.push('  timestamp?: Date;');
  lines.push('  path?: string;');
  lines.push('  traceId?: string;');
  lines.push('}');
  lines.push('');

  // StandardErrors enum
  lines.push('export enum StandardErrors {');
  lines.push('  BAD_REQUEST = "BAD_REQUEST",');
  lines.push('  UNAUTHORIZED = "UNAUTHORIZED",');
  lines.push('  FORBIDDEN = "FORBIDDEN",');
  lines.push('  NOT_FOUND = "NOT_FOUND",');
  lines.push('  CONFLICT = "CONFLICT",');
  lines.push('  VALIDATION_ERROR = "VALIDATION_ERROR",');
  lines.push('  INTERNAL_ERROR = "INTERNAL_ERROR",');
  lines.push('  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",');
  lines.push('}');
  lines.push('');

  // ErrorFactory class
  lines.push('export class ErrorFactory {');
  lines.push('  /**');
  lines.push('   * Create a bad request error');
  lines.push('   */');
  lines.push('  static badRequest(message: string, errors?: ValidationError[]): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.BAD_REQUEST,');
  lines.push('      message,');
  lines.push('      status: 400,');
  lines.push('      errors,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create an unauthorized error');
  lines.push('   */');
  lines.push('  static unauthorized(message: string = "Authentication required"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.UNAUTHORIZED,');
  lines.push('      message,');
  lines.push('      status: 401,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create a forbidden error');
  lines.push('   */');
  lines.push('  static forbidden(message: string = "Access denied"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.FORBIDDEN,');
  lines.push('      message,');
  lines.push('      status: 403,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create a not found error');
  lines.push('   */');
  lines.push('  static notFound(message: string = "Resource not found"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.NOT_FOUND,');
  lines.push('      message,');
  lines.push('      status: 404,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create a conflict error');
  lines.push('   */');
  lines.push('  static conflict(message: string = "Resource conflict"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.CONFLICT,');
  lines.push('      message,');
  lines.push('      status: 409,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create a validation error');
  lines.push('   */');
  lines.push('  static validationError(message: string, errors: ValidationError[]): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.VALIDATION_ERROR,');
  lines.push('      message,');
  lines.push('      status: 400,');
  lines.push('      errors,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create an internal server error');
  lines.push('   */');
  lines.push('  static internalError(message: string = "Internal server error"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.INTERNAL_ERROR,');
  lines.push('      message,');
  lines.push('      status: 500,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Create a service unavailable error');
  lines.push('   */');
  lines.push('  static serviceUnavailable(message: string = "Service temporarily unavailable"): ErrorResponse {');
  lines.push('    return {');
  lines.push('      code: StandardErrors.SERVICE_UNAVAILABLE,');
  lines.push('      message,');
  lines.push('      status: 503,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // ErrorHandler class
  lines.push('export class ErrorHandler {');
  lines.push('  /**');
  lines.push('   * Handle and format errors for API responses');
  lines.push('   */');
  lines.push('  static handle(error: Error | ErrorResponse): ErrorResponse {');
  lines.push('    if (this.isErrorResponse(error)) {');
  lines.push('      return error;');
  lines.push('    }');
  lines.push('');
  lines.push('    return {');
  lines.push('      code: StandardErrors.INTERNAL_ERROR,');
  lines.push('      message: error.message || "Unknown error",');
  lines.push('      status: 500,');
  lines.push('      timestamp: new Date(),');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push('  /**');
  lines.push('   * Check if object is an ErrorResponse');
  lines.push('   */');
  lines.push('  private static isErrorResponse(obj: any): obj is ErrorResponse {');
  lines.push('    return obj && typeof obj === "object" && "code" in obj && "status" in obj;');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}
