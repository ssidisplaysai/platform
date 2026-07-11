/**
 * DocumentationRenderer
 *
 * Generates entity documentation from EnterpriseObjectBlueprint.
 * Creates comprehensive markdown documentation of entity structure,
 * relationships, lifecycle, and capabilities.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: Markdown documentation file
 *
 * @module tools/genesis/compiler/renderers/DocumentationRenderer
 */

/**
 * Generate documentation markdown
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated markdown documentation
 */
export function generateDocumentation(blueprint) {
  const entityName = blueprint.metadata.entity;
  const camelCase = blueprint.api.camelCase;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  const capabilities = blueprint.capabilities;
  const lifecycle = blueprint.lifecycle;

  let doc = '';

  // Header
  doc += `# ${entityName} Entity\n\n`;
  doc += `> **Auto-generated documentation from entity metadata via EnterpriseObjectBlueprint IR.**\n`;
  doc += `> Generated at ${new Date().toISOString()}\n\n`;

  // Overview
  doc += `## Overview\n\n`;
  doc += `${blueprint.metadata.description}\n\n`;
  doc += `**Display Name:** ${blueprint.metadata.displayName}  \n`;
  doc += `**Plural Name:** ${blueprint.metadata.pluralName}  \n`;
  doc += `**Namespace:** ${blueprint.metadata.namespace}  \n`;
  doc += `**Tags:** ${blueprint.metadata.tags.join(', ')}  \n\n`;

  // Fields section
  doc += `## Fields\n\n`;
  doc += `| Field | Type | Required | Unique | Description |\n`;
  doc += `|-------|------|----------|--------|-------------|\n`;

  for (const field of fields) {
    const required = field.required ? '✓' : '';
    const unique = field.unique ? '✓' : '';
    const desc = field.description || '';
    doc += `| \`${field.name}\` | \`${field.type}\` | ${required} | ${unique} | ${desc} |\n`;
  }

  doc += `\n\n`;

  // Relationships section
  if (relationships && relationships.length > 0) {
    doc += `## Relationships\n\n`;
    doc += `| Relationship | Type | Target | Required | Description |\n`;
    doc += `|--------------|------|--------|----------|-------------|\n`;

    for (const rel of relationships) {
      const required = rel.required ? '✓' : '';
      const desc = rel.description || '';
      doc += `| \`${rel.name}\` | \`${rel.type}\` | \`${rel.target}\` | ${required} | ${desc} |\n`;
    }

    doc += `\n\n`;
  }

  // Capabilities section
  doc += `## Capabilities\n\n`;

  const enabledCapabilities = [];
  if (capabilities.search.enabled) enabledCapabilities.push('- **Search**');
  if (capabilities.audit.enabled) enabledCapabilities.push('- **Audit**');
  if (capabilities.validation.enabled) enabledCapabilities.push('- **Validation**');
  if (capabilities.permissions.enabled) enabledCapabilities.push('- **Permissions**');
  if (capabilities.events.enabled) enabledCapabilities.push('- **Events**');

  if (enabledCapabilities.length > 0) {
    doc += enabledCapabilities.join('\n') + '\n';
  } else {
    doc += `- No special capabilities enabled\n`;
  }

  doc += `\n\n`;

  // Lifecycle section
  if (lifecycle && Object.keys(lifecycle.states).length > 0) {
    doc += `## Lifecycle\n\n`;
    
    // Initial state
    if (lifecycle.initial) {
      doc += `**Initial State:** \`${lifecycle.initial}\`\n\n`;
    }
    
    doc += `### States\n\n`;
    doc += `| State | Label | Description | Terminal |\n`;
    doc += `|-------|-------|-------------|----------|\n`;

    for (const [state, config] of Object.entries(lifecycle.states)) {
      const terminal = config.terminal ? '✓' : '';
      const desc = config.description || state;
      doc += `| \`${state}\` | ${config.label || state} | ${desc} | ${terminal} |\n`;
    }

    doc += `\n\n`;

    // Transitions
    if (lifecycle.transitions && lifecycle.transitions.length > 0) {
      doc += `### Valid Transitions\n\n`;

      for (const transition of lifecycle.transitions) {
        const event = transition.event ? ` (event: \`${transition.event}\`)` : '';
        doc += `- \`${transition.from}\` → \`${transition.to}\` (\`${transition.trigger}\`)${event}\n`;
      }

      doc += `\n\n`;
    }

    // Features
    if (lifecycle.softDelete || lifecycle.versioning || lifecycle.archived) {
      doc += `### Features\n\n`;
      if (lifecycle.softDelete) doc += `- Soft Delete: Entities marked as deleted but not removed\n`;
      if (lifecycle.versioning) doc += `- Versioning: Track entity changes over time\n`;
      if (lifecycle.archived) doc += `- Archival: Entities can be archived\n`;
      doc += `\n\n`;
    }
  }

  // Search section
  if (capabilities.search.enabled && capabilities.search.fields.length > 0) {
    doc += `## Search\n\n`;
    doc += `This entity supports full-text search on the following fields:\n\n`;

    for (const f of capabilities.search.fields) {
      doc += `- \`${f}\`\n`;
    }

    doc += `\n\n`;
  }

  // Validation rules section
  const requiredFields = fields.filter(f => f.required && !f.generated);
  const uniqueFields = fields.filter(f => f.unique);

  if (requiredFields.length > 0 || uniqueFields.length > 0) {
    doc += `## Validation Rules\n\n`;

    if (requiredFields.length > 0) {
      doc += `### Required Fields\n\n`;
      for (const f of requiredFields) {
        doc += `- \`${f.name}\`: ${f.description || 'Required'}\n`;
      }
      doc += `\n`;
    }

    if (uniqueFields.length > 0) {
      doc += `### Unique Fields\n\n`;
      for (const f of uniqueFields) {
        doc += `- \`${f.name}\`: Must be unique\n`;
      }
      doc += `\n`;
    }

    doc += `\n`;
  }

  // API Example section
  doc += `## API Examples\n\n`;
  doc += `### Create\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `POST /api/${camelCase}\n`;
  doc += `Content-Type: application/json\n\n`;
  doc += `{\n`;

  const exampleFields = fields
    .filter(f => !f.generated && f.type !== 'enum')
    .slice(0, 3);

  for (const field of exampleFields) {
    if (field.type === 'email') {
      doc += `  "${field.name}": "example@company.com",\n`;
    } else if (field.type === 'string') {
      doc += `  "${field.name}": "Example ${capitalize(field.name)}",\n`;
    } else if (field.type === 'number' || field.type === 'integer') {
      doc += `  "${field.name}": 0,\n`;
    } else {
      doc += `  "${field.name}": "value",\n`;
    }
  }

  doc += `}\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Get\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `GET /api/${camelCase}/{id}\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Update\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `PATCH /api/${camelCase}/{id}\n`;
  doc += `Content-Type: application/json\n\n`;
  doc += `{\n`;
  doc += `  "status": "ACTIVE"\n`;
  doc += `}\n`;
  doc += `\`\`\`\n\n`;

  doc += `### Delete\n\n`;
  doc += `\`\`\`bash\n`;
  doc += `DELETE /api/${camelCase}/{id}\n`;
  doc += `\`\`\`\n\n`;

  // Generated artifacts section
  doc += `## Generated Artifacts\n\n`;
  doc += `This entity generates the following artifacts:\n\n`;
  doc += `- \`${entityName}Repository.ts\` - Data access layer\n`;
  doc += `- \`${entityName}Service.ts\` - Business logic\n`;
  doc += `- \`${entityName}Validator.ts\` - Validation rules\n`;
  doc += `- \`${entityName}.entity.ts\` - Entity class\n`;
  doc += `- \`${entityName}.test.ts\` - Unit tests\n\n`;
  doc += `---\n\n`;
  doc += `_Auto-generated by Genesis Entity Compiler_\n`;

  return doc;
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
