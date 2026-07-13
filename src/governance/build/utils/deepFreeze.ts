/**
 * deepFreeze.ts
 *
 * Utility for runtime immutability enforcement.
 *
 * Recursively freezes objects, arrays, and nested structures to ensure
 * that the returned build report cannot be mutated at runtime.
 */

/**
 * Deep freeze a value to make it immutable at runtime.
 *
 * Recursively freezes:
 * - Objects and their properties
 * - Arrays and array elements
 * - Nested structures
 *
 * Uses a WeakSet to track visited objects and prevent infinite loops
 * when encountering circular references.
 *
 * Already-frozen objects are left as-is (idempotent).
 *
 * @typeParam T - The type of value to freeze
 * @param value - Value to freeze
 * @returns Same value, now deeply frozen and typed as readonly
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  const visited = new WeakSet<object>();

  function freeze(obj: any): any {
    // Skip primitives
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
      return obj;
    }

    // Skip if already in visited set (circular reference)
    if (visited.has(obj)) {
      return obj;
    }

    // Mark as visited
    visited.add(obj);

    // Freeze object
    Object.freeze(obj);

    // Recursively freeze properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        freeze(obj[key]);
      }
    }

    return obj;
  }

  return freeze(value);
}

/**
 * Assert that a value is deeply frozen.
 *
 * Throws a TypeError if any property is not frozen.
 *
 * Used in tests to verify immutability.
 *
 * @param value - Value to check
 * @param name - Optional name for error messages
 * @throws TypeError if any property is not frozen
 */
export function assertFrozen<T>(value: T, name: string = 'value'): void {
  if (!Object.isFrozen(value)) {
    throw new TypeError(`Expected ${name} to be frozen but it is not`);
  }

  const visited = new WeakSet<object>();

  function check(obj: any, path: string): void {
    // Skip primitives
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
      return;
    }

    // Skip if already visited
    if (visited.has(obj)) {
      return;
    }

    visited.add(obj);

    // Check if frozen
    if (!Object.isFrozen(obj)) {
      throw new TypeError(`Expected ${path} to be frozen but it is not`);
    }

    // Recursively check properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        check(obj[key], `${path}.${key}`);
      }
    }
  }

  check(value, name);
}
