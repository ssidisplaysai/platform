/**
 * BlueprintLoader.mjs
 *
 * Loads entity definitions from YAML files.
 *
 * Purpose:
 *   - Reads *.entity.yaml files
 *   - Parses YAML into JavaScript objects
 *   - Provides file system abstraction
 *   - Supports configuration roots
 */

import { readFileSync } from "fs";
import { join, resolve } from "path";

/**
 * Simple YAML parser (subset support)
 * For production, use 'yaml' npm package
 */
function parseYAML(content) {
  const obj = {};
  let currentKey = null;
  let currentSection = null;
  let sectionStack = [obj];

  const lines = content.split("\n");

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    // Determine indentation level
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle key-value pairs
    if (trimmed.includes(":")) {
      const [key, ...valueParts] = trimmed.split(":");
      const value = valueParts.join(":").trim();
      const keyName = key.trim();

      if (indent === 0) {
        // Top-level key
        if (value === "" || value === "{}") {
          obj[keyName] = {};
          currentKey = keyName;
          currentSection = obj[keyName];
        } else if (value.startsWith("[")) {
          obj[keyName] = parseArrayValue(value);
        } else {
          obj[keyName] = parseValue(value);
        }
      } else if (indent === 2 && currentSection) {
        // First-level nested
        if (value === "" || value === "{}") {
          currentSection[keyName] = {};
        } else if (value.startsWith("[")) {
          currentSection[keyName] = parseArrayValue(value);
        } else {
          currentSection[keyName] = parseValue(value);
        }
      } else if (indent === 4 && currentSection) {
        // Second-level nested
        const lastKey = Object.keys(currentSection).pop();
        if (lastKey && typeof currentSection[lastKey] === "object") {
          if (value === "" || value === "{}") {
            currentSection[lastKey][keyName] = {};
          } else if (value.startsWith("[")) {
            currentSection[lastKey][keyName] = parseArrayValue(value);
          } else {
            currentSection[lastKey][keyName] = parseValue(value);
          }
        }
      }
    }
  }

  return obj;
}

/**
 * Parse array values
 */
function parseArrayValue(value) {
  // Handle simple array format: [item1, item2, item3]
  if (value.startsWith("[") && value.endsWith("]")) {
    const content = value.slice(1, -1);
    return content
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

/**
 * Parse individual values
 */
function parseValue(value) {
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

/**
 * Load a YAML file
 *
 * @param {string} filePath - Path to YAML file
 * @returns {Object} - Parsed YAML object
 */
export function loadYAMLFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    return parseYAML(content);
  } catch (error) {
    throw new Error(`Failed to load YAML file ${filePath}: ${error.message}`);
  }
}

/**
 * Load entity definition from YAML file
 *
 * @param {string} entityName - Entity name or file path
 * @param {string} definitionRoot - Root directory for definitions
 * @returns {Object} - Entity definition object
 */
export function loadEntityDefinition(entityName, definitionRoot) {
  // Resolve file path
  const filePath = resolve(
    definitionRoot,
    `${entityName.toLowerCase()}.entity.yaml`
  );

  // Load and parse YAML
  const definition = loadYAMLFile(filePath);

  return {
    ...definition,
    source: filePath,
  };
}

/**
 * Load multiple entity definitions
 *
 * @param {string[]} entityNames - Array of entity names
 * @param {string} definitionRoot - Root directory for definitions
 * @returns {Object} - Definitions indexed by entity name
 */
export function loadEntityDefinitions(entityNames, definitionRoot) {
  const definitions = {};

  for (const entityName of entityNames) {
    try {
      definitions[entityName] = loadEntityDefinition(entityName, definitionRoot);
    } catch (error) {
      console.warn(`Could not load definition for ${entityName}: ${error.message}`);
    }
  }

  return definitions;
}
