/**
 * BootManifest Interfaces - Runtime Boot Pipeline Contracts
 *
 * Defines the contract for the 12-stage Genesis Runtime Boot pipeline.
 * All stages are generic and metadata-driven, with no object or module-specific logic.
 *
 * @module tools/genesis/runtime/BootManifest
 */

/**
 * Boot Stage Interface - Base contract for all boot stages
 */
export interface BootStage {
  id: string;
  name: string;
  description: string;
  order: number;
  dependencies: string[];
  timeout: number;
  retryable: boolean;
}

/**
 * Boot Result - Output from each stage
 */
export interface BootStageResult {
  stageId: string;
  stageName: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  itemsProcessed: number;
  itemsFailed: number;
  warnings: string[];
  errors: string[];
  details: Record<string, any>;
}

/**
 * Runtime Boot Manifest - Complete boot plan and results
 */
export interface RuntimeBootManifest {
  schema: string;
  version: string;
  bootId: string;
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  stages: BootStage[];
  stageResults: BootStageResult[];
  finalState: RuntimeFinalState;
  metadata: {
    bootVersion: string;
    generatedAt: string;
    generatedBy: string;
    environment: string;
  };
}

/**
 * Runtime Final State - Status after all boot stages
 */
export interface RuntimeFinalState {
  ready: boolean;
  phase: 'not-started' | 'discovering' | 'validating' | 'registering' | 'resolving' | 'ready' | 'failed';
  
  // Discovered items
  discoveredModules: number;
  discoveredObjects: number;
  discoveredRepositories: number;
  discoveredServices: number;
  discoveredAPIs: number;
  discoveredWorkflows: number;
  discoveredAutomations: number;
  discoveredAgents: number;
  
  // Registered items
  registeredModules: number;
  registeredObjects: number;
  registeredRepositories: number;
  registeredServices: number;
  registeredAPIs: number;
  registeredWorkflows: number;
  registeredAutomations: number;
  registeredAgents: number;
  
  // Dependency resolution
  dependenciesResolved: number;
  dependenciesFailed: number;
  
  // Overall statistics
  totalDiscovered: number;
  totalRegistered: number;
  totalErrors: number;
  totalWarnings: number;
  
  // Boot timeline
  bootStartTime: string;
  bootEndTime?: string;
  bootDuration?: number;
}

/**
 * Discovered Manifest - Generic manifest discovery result
 */
export interface DiscoveredManifest {
  type: 'module' | 'object' | 'repository' | 'service' | 'api' | 'workflow' | 'automation' | 'agent' | 'knowledge';
  id: string;
  name: string;
  namespace: string;
  filePath: string;
  content: Record<string, any>;
  validated: boolean;
  validationErrors: string[];
}

/**
 * Validation Result - Generic validation result
 */
export interface ValidationResult {
  manifestId: string;
  manifestType: string;
  valid: boolean;
  schema?: string;
  version?: string;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validation Error - Specific validation failure
 */
export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Registration Result - Generic registration result
 */
export interface RegistrationResult {
  manifestId: string;
  manifestType: string;
  registered: boolean;
  registryKey: string;
  registeredAt: string;
  errors: string[];
}

/**
 * Dependency - Generic dependency definition
 */
export interface Dependency {
  from: {
    type: string;
    id: string;
    namespace: string;
  };
  to: {
    type: string;
    id: string;
    namespace: string;
  };
  type: 'reference' | 'composition' | 'association' | 'aggregation';
  required: boolean;
  resolved: boolean;
  errors: string[];
}

/**
 * Registry Entry - Generic registry entry
 */
export interface RegistryEntry {
  id: string;
  type: string;
  name: string;
  namespace: string;
  tier: string;
  domain: string;
  registeredAt: string;
  version: string;
  status: 'registered' | 'active' | 'inactive' | 'deprecated';
  metadata: Record<string, any>;
}

/**
 * Boot Configuration - Runtime boot configuration
 */
export interface BootConfiguration {
  manifestDiscoveryPath: string;
  validateManifests: boolean;
  validateDependencies: boolean;
  resolveCircularDependencies: boolean;
  failOnValidationError: boolean;
  failOnRegistrationError: boolean;
  parallel: boolean;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
}

/**
 * Boot Event - Event emitted during boot process
 */
export interface BootEvent {
  timestamp: string;
  stageId: string;
  stageName: string;
  eventType: 'started' | 'progress' | 'warning' | 'error' | 'completed';
  message: string;
  details?: Record<string, any>;
}

/**
 * Boot Context - Shared context during boot
 */
export interface BootContext {
  bootId: string;
  phase: string;
  discoveries: Map<string, DiscoveredManifest>;
  validations: Map<string, ValidationResult>;
  registrations: Map<string, RegistrationResult>;
  dependencies: Dependency[];
  registryEntries: Map<string, RegistryEntry>;
  errors: string[];
  warnings: string[];
  events: BootEvent[];
}

export {};
