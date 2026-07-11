/**
 * RendererRegistry
 *
 * Plugin system for registering and invoking renderers.
 * All renderers follow a consistent interface: (blueprint) => string
 *
 * @module tools/genesis/compiler/registry/RendererRegistry
 */

import { RendererTargets } from './RendererTarget.mjs';

/**
 * Renderer registry for dynamic loader pattern
 */
class RendererRegistry {
  constructor() {
    this.renderers = new Map();
  }

  /**
   * Register a renderer for a target
   * @param {string} targetId - Target ID (e.g., 'repository')
   * @param {Function} renderer - Renderer function(blueprint) => string
   */
  register(targetId, renderer) {
    if (typeof renderer !== 'function') {
      throw new Error(`Renderer for ${targetId} must be a function`);
    }
    this.renderers.set(targetId, renderer);
  }

  /**
   * Get a renderer for a target
   * @param {string} targetId - Target ID
   * @returns {Function} Renderer function
   */
  getRenderer(targetId) {
    const renderer = this.renderers.get(targetId);
    if (!renderer) {
      throw new Error(`No renderer registered for target: ${targetId}`);
    }
    return renderer;
  }

  /**
   * Check if a renderer is registered
   * @param {string} targetId - Target ID
   * @returns {boolean} True if registered
   */
  has(targetId) {
    return this.renderers.has(targetId);
  }

  /**
   * Render using a specific renderer
   * @param {string} targetId - Target ID
   * @param {Object} blueprint - EnterpriseObjectBlueprint
   * @returns {string} Rendered output
   */
  render(targetId, blueprint) {
    const renderer = this.getRenderer(targetId);
    return renderer(blueprint);
  }

  /**
   * Render all targets for an entity
   * @param {Object} blueprint - EnterpriseObjectBlueprint
   * @param {string[]} targetIds - Optional array of specific target IDs to render
   * @returns {Map<string, string>} Map of targetId => rendered output
   */
  renderAll(blueprint, targetIds = null) {
    const results = new Map();
    const toRender = targetIds || Array.from(this.renderers.keys());

    for (const targetId of toRender) {
      if (this.has(targetId)) {
        try {
          const output = this.render(targetId, blueprint);
          results.set(targetId, output);
        } catch (error) {
          console.error(`Error rendering ${targetId}: ${error.message}`);
          results.set(targetId, null);
        }
      }
    }

    return results;
  }

  /**
   * Get all registered target IDs
   * @returns {string[]} Array of target IDs
   */
  getRegisteredTargets() {
    return Array.from(this.renderers.keys());
  }

  /**
   * Get all unregistered required targets
   * @returns {string[]} Array of target IDs
   */
  getUnregisteredRequiredTargets() {
    const required = Object.values(RendererTargets)
      .filter(t => t.required)
      .map(t => t.id);
    return required.filter(id => !this.has(id));
  }
}

// Export singleton instance
export const rendererRegistry = new RendererRegistry();

/**
 * Register all default renderers
 * This must be called during initialization
 */
export async function registerDefaultRenderers() {
  // Import all renderers dynamically
  const { generateRepository } = await import('../renderers/RepositoryRenderer.mjs');
  const { generateService } = await import('../renderers/ServiceRenderer.mjs');
  const { generateValidator } = await import('../renderers/ValidatorRenderer.mjs');
  const { generatePermissions } = await import('../renderers/PermissionsRenderer.mjs');
  const { generatePolicies } = await import('../renderers/PolicyRenderer.mjs');
  const { generateEvents } = await import('../renderers/EventsRenderer.mjs');
  const { generateSearch } = await import('../renderers/SearchRenderer.mjs');
  const { generateDocumentation } = await import('../renderers/DocumentationRenderer.mjs');
  const { generateTests } = await import('../renderers/TestRenderer.mjs');
  const { generateOpenAPI } = await import('../renderers/OpenAPIRenderer.mjs');
  const { generateGraphQL } = await import('../renderers/GraphQLRenderer.mjs');
  const { generateDTOs } = await import('../renderers/DTORenderer.mjs');
  const { generateRESTContract } = await import('../renderers/RESTContractRenderer.mjs');
  const { generateErrorContracts } = await import('../renderers/ErrorContractRenderer.mjs');
  const { generateRegistration } = await import('../renderers/RegistrationRenderer.mjs');
  const { generateModule } = await import('../renderers/ModuleRenderer.mjs');

  // Register all renderers
  rendererRegistry.register('repository', generateRepository);
  rendererRegistry.register('service', generateService);
  rendererRegistry.register('validator', generateValidator);
  rendererRegistry.register('permissions', generatePermissions);
  rendererRegistry.register('policies', generatePolicies);
  rendererRegistry.register('events', generateEvents);
  rendererRegistry.register('search', generateSearch);
  rendererRegistry.register('documentation', generateDocumentation);
  rendererRegistry.register('tests', generateTests);
  rendererRegistry.register('openapi', generateOpenAPI);
  rendererRegistry.register('graphql', generateGraphQL);
  rendererRegistry.register('dtos', generateDTOs);
  rendererRegistry.register('rest-contract', generateRESTContract);
  rendererRegistry.register('error-contracts', generateErrorContracts);
  rendererRegistry.register('registration', generateRegistration);
  rendererRegistry.register('module', generateModule);

  return rendererRegistry;
}

export default rendererRegistry;
