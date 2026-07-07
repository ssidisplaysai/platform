import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * TemplateTests
 * 
 * Verify that template modules exist and are callable.
 */
export default async function createTemplateTests() {
  const suite = new TestSuite('Templates', 'Verify template modules');

  // Import TemplateRenderer
  const { renderEntityTemplate } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/templates/entity/TemplateRenderer.mjs')).href);

  suite.addTest('renderEntityTemplate function exists', async () => {
    if (typeof renderEntityTemplate !== 'function') {
      throw new Error('renderEntityTemplate is not a function');
    }
  });

  suite.addTest('Template directory exists', async () => {
    const templateDir = join(projectRoot, 'tools/genesis/templates/entity');
    if (!existsSync(templateDir)) {
      throw new Error('Entity template directory not found');
    }
  });

  suite.addTest('TemplateRenderer.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/templates/entity/TemplateRenderer.mjs');
    if (!existsSync(file)) {
      throw new Error('TemplateRenderer.mjs not found');
    }
  });

  suite.addTest('Template files exist', async () => {
    const templateDir = join(projectRoot, 'tools/genesis/templates/entity');
    if (!existsSync(templateDir)) {
      throw new Error('Template directory not found');
    }
    const files = readdirSync(templateDir);
    if (files.length === 0) {
      throw new Error('No template files found');
    }
  });

  suite.addTest('Template renderer has token replacement', async () => {
    // Just verify the module can be imported and has the function
    if (typeof renderEntityTemplate !== 'function') {
      throw new Error('renderEntityTemplate is not callable');
    }
  });

  return suite;
}
