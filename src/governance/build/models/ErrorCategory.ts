/**
 * ErrorCategory.ts
 *
 * Deterministic classification for TypeScript compiler errors.
 *
 * Each error discovered during compilation is categorized into one of these
 * buckets for health scoring and remediation prioritization.
 */

/**
 * Error category enumeration.
 *
 * These categories are used to:
 * - Group related errors
 * - Apply severity weighting in health scoring
 * - Prioritize remediation efforts
 * - Track subsystem health
 *
 * Categories are deterministic and should not change once assigned to an error.
 */
export enum ErrorCategory {
  /**
   * Errors originating from generated code files.
   * These are typically lower priority as they result from code generation
   * systems rather than direct implementation decisions.
   */
  GENERATED_CODE = 'GENERATED_CODE',

  /**
   * Errors from the discovery import pipeline.
   * Located in src/discovery/ subsystem.
   */
  DISCOVERY = 'DISCOVERY',

  /**
   * Errors from the TypeScript compiler itself.
   * Indicates fundamental compilation issues.
   */
  COMPILER = 'COMPILER',

  /**
   * Errors from the repository compiler (formerly analyzer).
   * Located in src/developer/analyzer/ subsystem.
   */
  REPOSITORY_COMPILER = 'REPOSITORY_COMPILER',

  /**
   * Errors from Apollo client/server integration.
   * Located in src/apollo/ or related subsystem.
   */
  APOLLO = 'APOLLO',

  /**
   * Errors from runtime systems and execution engines.
   * Located in src/core/runtime/ or equivalent.
   */
  RUNTIME = 'RUNTIME',

  /**
   * Errors from core domain models, entities, and services.
   * Located in src/core/, src/domain/, etc.
   */
  CORE = 'CORE',

  /**
   * Errors from test files and test infrastructure.
   * Located in __tests__/ or .test.ts/.spec.ts files.
   */
  TESTS = 'TESTS',

  /**
   * Errors from configuration files.
   * Examples: tsconfig.json, eslint.config.mjs, etc.
   */
  CONFIGURATION = 'CONFIGURATION',

  /**
   * Errors from legacy code that hasn't been refactored.
   * These may be intentional technical debt.
   */
  LEGACY = 'LEGACY',

  /**
   * Errors that don't fit any other category.
   * These should be investigated and potentially recategorized.
   */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Severity levels within categories.
 *
 * Used by the health scorer to apply weighted deductions.
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Classification rule result.
 *
 * Returned by error classifier to indicate how an error was categorized.
 */
export interface ClassificationResult {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly subsystem: string;
  readonly reason: string;
}

/**
 * Categorization rules for file paths.
 *
 * These rules are applied in order, and the first matching rule determines
 * the category for an error.
 */
export const CATEGORY_RULES = [
  // Generated code (lowest priority)
  { pattern: /\.next\//, category: ErrorCategory.GENERATED_CODE, severity: ErrorSeverity.LOW },
  { pattern: /dist\//, category: ErrorCategory.GENERATED_CODE, severity: ErrorSeverity.LOW },
  { pattern: /build\//, category: ErrorCategory.GENERATED_CODE, severity: ErrorSeverity.LOW },
  { pattern: /next-env\.d\.ts/, category: ErrorCategory.GENERATED_CODE, severity: ErrorSeverity.LOW },

  // Discovery subsystem
  { pattern: /src\/discovery\//, category: ErrorCategory.DISCOVERY, severity: ErrorSeverity.MEDIUM },

  // Repository compiler
  { pattern: /src\/developer\/analyzer\//, category: ErrorCategory.REPOSITORY_COMPILER, severity: ErrorSeverity.MEDIUM },

  // Apollo integration
  { pattern: /src\/apollo\//, category: ErrorCategory.APOLLO, severity: ErrorSeverity.MEDIUM },

  // Runtime systems
  { pattern: /src\/core\/runtime\//, category: ErrorCategory.RUNTIME, severity: ErrorSeverity.HIGH },
  { pattern: /src\/.*runtime\//, category: ErrorCategory.RUNTIME, severity: ErrorSeverity.HIGH },

  // Core domain
  { pattern: /src\/core\//, category: ErrorCategory.CORE, severity: ErrorSeverity.HIGH },
  { pattern: /src\/domain\//, category: ErrorCategory.CORE, severity: ErrorSeverity.HIGH },

  // Tests
  { pattern: /__tests__/, category: ErrorCategory.TESTS, severity: ErrorSeverity.LOW },
  { pattern: /\.test\.ts$/, category: ErrorCategory.TESTS, severity: ErrorSeverity.LOW },
  { pattern: /\.spec\.ts$/, category: ErrorCategory.TESTS, severity: ErrorSeverity.LOW },

  // Configuration
  { pattern: /tsconfig\.json/, category: ErrorCategory.CONFIGURATION, severity: ErrorSeverity.HIGH },
  { pattern: /eslint\.config\./, category: ErrorCategory.CONFIGURATION, severity: ErrorSeverity.MEDIUM },
  { pattern: /postcss\.config\./, category: ErrorCategory.CONFIGURATION, severity: ErrorSeverity.MEDIUM },
  { pattern: /next\.config\./, category: ErrorCategory.CONFIGURATION, severity: ErrorSeverity.MEDIUM },
] as const;
