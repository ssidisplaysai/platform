/**
 * CompilerRegistry.ts
 *
 * Immutable registry of compiler passes.
 * Provides read-only access to registered passes.
 */

import type { CompilerPassId, CompilerPass, PassRegistryEntry } from "./CompilerPass.js";

/**
 * Immutable compiler registry
 *
 * Stores compiler passes in immutable form.
 * All access is read-only after registration.
 */
export interface CompilerRegistry {
  /**
   * All registered passes (immutable)
   */
  readonly passes: ReadonlyMap<CompilerPassId, PassRegistryEntry>;

  /**
   * Register a new compiler pass
   *
   * @param pass - Compiler pass to register
   * @returns New registry with pass registered
   *
   * @throws if pass ID already exists
   * @throws if registry is frozen
   */
  readonly register: (pass: CompilerPass) => CompilerRegistry;

  /**
   * Get a pass by ID (read-only)
   *
   * @param passId - Pass identifier
   * @returns Pass or undefined
   */
  readonly get: (passId: CompilerPassId) => CompilerPass | undefined;

  /**
   * Get all registered passes in deterministic order
   *
   * @returns Passes sorted by ID
   */
  readonly getAll: () => readonly CompilerPass[];

  /**
   * Check if a pass is registered
   *
   * @param passId - Pass identifier
   * @returns true if registered
   */
  readonly has: (passId: CompilerPassId) => boolean;

  /**
   * Get pass count
   */
  readonly size: number;

  /**
   * Validate registry consistency
   *
   * @returns Validation result
   */
  readonly validate: () => RegistryValidationResult;

  /**
   * Freeze the registry (make immutable)
   */
  readonly freeze: () => void;

  /**
   * Check if registry is frozen
   */
  readonly isFrozen: () => boolean;
}

/**
 * Registry validation result
 */
export interface RegistryValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly passCount: number;
}

/**
 * Create an empty compiler registry
 *
 * @returns New empty registry
 */
export const createCompilerRegistry = (): CompilerRegistry => {
  const entries = new Map<CompilerPassId, PassRegistryEntry>();
  let frozen = false;

  const register = (pass: CompilerPass): CompilerRegistry => {
    if (frozen) {
      throw new Error("Cannot register: registry is frozen");
    }

    if (entries.has(pass.id)) {
      throw new Error(`Pass already registered: ${pass.id}`);
    }

    const newRegistry = createCompilerRegistry();
    const newEntries = (newRegistry as any).entries as Map<CompilerPassId, PassRegistryEntry>;

    entries.forEach((entry, id) => {
      newEntries.set(id, entry);
    });

    const entry: PassRegistryEntry = {
      pass: Object.freeze(pass),
      registered: Date.now(),
      immutable: true,
    };

    newEntries.set(pass.id, Object.freeze(entry));
    return newRegistry;
  };

  const get = (passId: CompilerPassId): CompilerPass | undefined => {
    const entry = entries.get(passId);
    return entry?.pass;
  };

  const getAll = (): readonly CompilerPass[] => {
    return Object.freeze(
      Array.from(entries.values())
        .map((e) => e.pass)
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  };

  const has = (passId: CompilerPassId): boolean => {
    return entries.has(passId);
  };

  const validate = (): RegistryValidationResult => {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate IDs (should not happen but verify)
    const ids = new Set<CompilerPassId>();
    entries.forEach((entry) => {
      if (ids.has(entry.pass.id)) {
        issues.push(`Duplicate pass ID: ${entry.pass.id}`);
      }
      ids.add(entry.pass.id);
    });

    // Check for missing dependencies
    entries.forEach((entry) => {
      entry.pass.dependencies.forEach((dep) => {
        if (!entries.has(dep.passId)) {
          warnings.push(`Dependency not registered: ${entry.pass.id} depends on ${dep.passId}`);
        }
      });
    });

    // Check for version consistency
    const versions = new Map<CompilerPassId, string>();
    entries.forEach((entry) => {
      const existing = versions.get(entry.pass.id);
      if (existing && existing !== entry.pass.version) {
        issues.push(`Version mismatch for ${entry.pass.id}`);
      }
      versions.set(entry.pass.id, entry.pass.version);
    });

    return {
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
      passCount: entries.size,
    };
  };

  const freeze = (): void => {
    frozen = true;
    Object.freeze(entries);
  };

  const isFrozen = (): boolean => frozen;

  const registry: CompilerRegistry = {
    passes: entries as ReadonlyMap<CompilerPassId, PassRegistryEntry>,
    register,
    get,
    getAll,
    has,
    get size() {
      return entries.size;
    },
    validate,
    freeze,
    isFrozen,
  };

  return registry;
};
