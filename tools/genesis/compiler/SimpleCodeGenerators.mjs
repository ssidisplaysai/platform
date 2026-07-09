/**
 * SimpleCodeGenerators
 *
 * Simplified code generators that demonstrate metadata-driven generation
 * without complex template literal issues.
 *
 * @module tools/genesis/compiler/SimpleCodeGenerators
 */

/**
 * Generate repository stub
 */
export function generateRepository(entityName) {
  return `// Generated Repository for ${entityName}\nexport class ${entityName}Repository {\n  // TODO: Implement data access methods\n}\n`;
}

/**
 * Generate service stub
 */
export function generateService(entityName) {
  return `// Generated Service for ${entityName}\nexport class ${entityName}Service {\n  // TODO: Implement business logic\n}\n`;
}

/**
 * Generate validator stub
 */
export function generateValidator(entityName) {
  return `// Generated Validator for ${entityName}\nexport class ${entityName}Validator {\n  // TODO: Implement validation rules\n}\n`;
}
