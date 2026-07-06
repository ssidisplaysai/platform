/**
 * TemplateRenderer
 *
 * Renders entity templates with token replacement.
 *
 * Supports tokens:
 * - {{EntityName}} - PascalCase entity name
 * - {{entityName}} - camelCase entity name
 * - {{entityNameLower}} - lowercase entity name
 * - {{EntityNamePlural}} - PascalCase plural (simple: add 's')
 * - {{EntityNameUpper}} - UPPERCASE entity name
 * - {{GeneratedAt}} - ISO timestamp
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Render a template with token replacement
 * @param {string} templatePath - Path to template file
 * @param {string} entityName - Entity name for token replacement
 * @param {string} generatedAt - ISO timestamp
 * @returns {string} Rendered content
 */
export function renderTemplate(
  templatePath,
  entityName,
  generatedAt = new Date().toISOString()
) {
  // Load template file
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  let content = fs.readFileSync(templatePath, "utf-8");

  // Prepare replacement values
  const PascalCase = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  const camelCase = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const lowercase = entityName.toLowerCase();
  const uppercase = entityName.toUpperCase();
  const plural = PascalCase + "s"; // Simple pluralization

  // Token replacements
  const replacements = {
    "{{EntityName}}": PascalCase,
    "{{entityName}}": camelCase,
    "{{entityNameLower}}": lowercase,
    "{{EntityNamePlural}}": plural,
    "{{EntityNameUpper}}": uppercase,
    "{{GeneratedAt}}": generatedAt,
  };

  // Apply all replacements
  for (const [token, value] of Object.entries(replacements)) {
    // Use global replace to replace all occurrences
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    content = content.replace(regex, value);
  }

  return content;
}

/**
 * Get template path for an artifact type
 * @param {string} artifactType - Type of artifact
 * @returns {string} Full path to template file
 */
export function getTemplatePath(artifactType) {
  const typeMap = {
    "entity-definition": "definition.template.ts",
    repository: "repository.template.ts",
    service: "service.template.ts",
    validator: "validator.template.ts",
    events: "events.template.ts",
    permissions: "permissions.template.ts",
    search: "search.template.ts",
    documentation: "documentation.template.md",
    tests: "tests.template.ts",
  };

  const templateFile = typeMap[artifactType];
  if (!templateFile) {
    throw new Error(`No template found for artifact type: ${artifactType}`);
  }

  return path.join(__dirname, templateFile);
}

/**
 * Render a template for an entity artifact
 * @param {string} artifactType - Type of artifact
 * @param {string} entityName - Entity name
 * @param {string} generatedAt - ISO timestamp
 * @returns {string} Rendered content
 */
export function renderEntityTemplate(artifactType, entityName, generatedAt) {
  const templatePath = getTemplatePath(artifactType);
  return renderTemplate(templatePath, entityName, generatedAt);
}
