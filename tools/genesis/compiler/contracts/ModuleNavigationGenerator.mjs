/**
 * ModuleNavigationGenerator - Generates module navigation contracts
 *
 * Creates navigation metadata from module and member object data.
 * Includes routes, menus, and navigation structure.
 *
 * Purpose:
 *   - Generate module-level navigation routes
 *   - Create object-level list/detail/create routes
 *   - Build menu groups and navigation structure
 *   - Provide navigation surface for UI/frontend
 *
 * Output:
 *   - Module home route
 *   - List routes for each object
 *   - Detail routes for each object
 *   - Create routes for each object
 *   - Search route
 *   - Menu groups organized by object
 *
 * @module tools/genesis/compiler/contracts/ModuleNavigationGenerator
 */

/**
 * Generate navigation contracts for a module
 *
 * @param {string} moduleId - Module ID (e.g., 'crm')
 * @param {Object} moduleMetadata - Module definition
 * @param {Array<string>} memberObjects - Objects in module
 * @returns {Object} Navigation contract
 */
export function generateNavigation(moduleId, moduleMetadata, memberObjects) {
  const namespace = moduleMetadata.namespace;
  const basePath = `/modules/${namespace}`;

  // Generate routes
  const routes = generateRoutes(basePath, memberObjects);

  // Generate menus
  const menus = generateMenus(basePath, memberObjects);

  return {
    homeRoute: basePath,
    routes,
    menus
  };
}

/**
 * Generate navigation routes
 *
 * @param {string} basePath - Module base path
 * @param {Array<string>} memberObjects - Objects in module
 * @returns {Array<Object>} Array of route definitions
 */
function generateRoutes(basePath, memberObjects) {
  const routes = [];

  // Add module home route
  routes.push({
    label: 'Module Home',
    path: basePath,
    type: 'home',
    object: null
  });

  // Add object routes (list, detail, create)
  for (const objectName of memberObjects) {
    const objectBasePath = `${basePath}/${objectName.toLowerCase()}`;

    // List route
    routes.push({
      label: `${objectName} List`,
      path: `${objectBasePath}`,
      type: 'list',
      object: objectName
    });

    // Detail route
    routes.push({
      label: `${objectName} Detail`,
      path: `${objectBasePath}/:id`,
      type: 'detail',
      object: objectName
    });

    // Create route
    routes.push({
      label: `Create ${objectName}`,
      path: `${objectBasePath}/create`,
      type: 'create',
      object: objectName
    });
  }

  // Add module search route
  routes.push({
    label: 'Module Search',
    path: `${basePath}/search`,
    type: 'search',
    object: null
  });

  return routes;
}

/**
 * Generate navigation menus
 *
 * @param {string} basePath - Module base path
 * @param {Array<string>} memberObjects - Objects in module
 * @returns {Array<Object>} Array of menu group definitions
 */
function generateMenus(basePath, memberObjects) {
  const menus = [];

  // Module main menu
  const mainMenu = {
    name: 'Module',
    items: [
      {
        label: 'Home',
        path: basePath,
        object: null
      },
      {
        label: 'Search',
        path: `${basePath}/search`,
        object: null
      }
    ]
  };

  menus.push(mainMenu);

  // Objects menu
  const objectsMenu = {
    name: 'Objects',
    items: memberObjects.map(objectName => ({
      label: objectName,
      path: `${basePath}/${objectName.toLowerCase()}`,
      object: objectName
    }))
  };

  menus.push(objectsMenu);

  // Quick actions menu
  const actionsMenu = {
    name: 'Quick Actions',
    items: memberObjects.map(objectName => ({
      label: `New ${objectName}`,
      path: `${basePath}/${objectName.toLowerCase()}/create`,
      object: objectName
    }))
  };

  menus.push(actionsMenu);

  return menus;
}

export {};
