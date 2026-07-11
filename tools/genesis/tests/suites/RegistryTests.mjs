import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * RegistryTests
 * 
 * Verify that the Definition Registry modules exist and are callable.
 */
export default async function createRegistryTests() {
  const suite = new TestSuite('Registry', 'Verify registry modules');

  // Import Registry
  const { DefinitionRegistry } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/registry/DefinitionRegistry.mjs')).href);
  const { loadDefinitionsFromRoots } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/registry/DefinitionLoader.mjs')).href);

  suite.addTest('DefinitionRegistry class exists', async () => {
    if (typeof DefinitionRegistry !== 'function') {
      throw new Error('DefinitionRegistry is not a class/function');
    }
  });

  suite.addTest('loadDefinitionsFromRoots function exists', async () => {
    if (typeof loadDefinitionsFromRoots !== 'function') {
      throw new Error('loadDefinitionsFromRoots is not a function');
    }
  });

  suite.addTest('Registry directory exists', async () => {
    const registryDir = join(projectRoot, 'tools/genesis/compiler/registry');
    const fs = await import('fs');
    if (!fs.existsSync(registryDir)) {
      throw new Error('Registry directory not found');
    }
  });

  suite.addTest('DefinitionRegistry.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/registry/DefinitionRegistry.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('DefinitionRegistry.mjs not found');
    }
  });

  suite.addTest('Definitions directory exists', async () => {
    const defDir = join(projectRoot, 'definitions/entity');
    const fs = await import('fs');
    if (!fs.existsSync(defDir)) {
      throw new Error('definitions/entity directory not found');
    }
  });

  suite.addTest('Customer definition file exists', async () => {
    const file = join(projectRoot, 'definitions/entity/Customer.entity.yaml');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('Customer.entity.yaml not found');
    }
  });

  suite.addTest('DefinitionLoader.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/registry/DefinitionLoader.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('DefinitionLoader.mjs not found');
    }
  });

  return suite;
}
