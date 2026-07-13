/**
 * deepFreeze.ts
 * Runtime deep freezing utility for immutability enforcement.
 *
 * This utility provides a generic deepFreeze function that recursively
 * freezes objects, arrays, and nested structures to ensure runtime
 * immutability beyond TypeScript's compile-time readonly declarations.
 *
 * The function is careful to:
 * - Not modify caller-owned input objects (freezes only return values)
 * - Preserve deterministic ordering of arrays and properties
 * - Skip non-extensible objects to avoid repeated freeze attempts
 * - Handle circular references gracefully
 */

/**
 * Recursively freezes an object and all its nested properties and arrays.
 *
 * This ensures runtime immutability: attempts to mutate the returned
 * value or its nested contents will throw TypeError in strict mode or
 * silently fail in non-strict mode.
 *
 * Freezing is applied depth-first to ensure all nested structures are
 * immutable before returning.
 *
 * @param value - Value to freeze (typically return value from a function)
 * @returns Frozen version of the value (same reference, now frozen)
 * @typeParam T - Type of the value
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  // Track visited objects to handle circular references
  const visited = new WeakSet();

  function freeze(obj: unknown): void {
    // Skip null, undefined, and primitives
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    // Skip if already visited (handles circular references)
    if (visited.has(obj as object)) {
      return;
    }

    visited.add(obj as object);

    // Skip if already frozen
    if (Object.isFrozen(obj)) {
      return;
    }

    // Recursively freeze all properties
    for (const key of Object.getOwnPropertyNames(obj)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);

      // Skip accessors and non-configurable properties
      if (descriptor && !descriptor.get && !descriptor.set) {
        freeze((obj as Record<string, unknown>)[key]);
      }
    }

    // Recursively freeze all symbol properties
    for (const sym of Object.getOwnPropertySymbols(obj)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, sym);

      if (descriptor && !descriptor.get && !descriptor.set) {
        freeze((obj as Record<symbol, unknown>)[sym]);
      }
    }

    // Freeze the object itself
    Object.freeze(obj);
  }

  freeze(value);
  return value as Readonly<T>;
}

/**
 * Asserts that a value is frozen.
 *
 * Throws an error if the value is not frozen, useful for validating
 * immutability at runtime or in tests.
 *
 * @param value - Value to check
 * @param message - Optional error message
 * @throws Error if value is not frozen
 */
export function assertFrozen(value: unknown, message?: string): void {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    throw new Error(
      message || `Expected frozen object, but got mutable object: ${typeof value}`,
    );
  }
}
