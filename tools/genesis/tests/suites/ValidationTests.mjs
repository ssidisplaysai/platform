import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * ValidationTests
 * 
 * Verify that validator modules exist and are callable.
 */
export default async function createValidationTests() {
  const suite = new TestSuite('Validation', 'Verify validator modules');

  // Import validator modules
  const { validateGeneratedSlice } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/validators/generated-slice/GeneratedSliceValidator.mjs')).href);
  const { createGeneratedSliceReport } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/validators/generated-slice/GeneratedSliceReport.mjs')).href);

  suite.addTest('validateGeneratedSlice function exists', async () => {
    if (typeof validateGeneratedSlice !== 'function') {
      throw new Error('validateGeneratedSlice is not a function');
    }
  });

  suite.addTest('createGeneratedSliceReport function exists', async () => {
    if (typeof createGeneratedSliceReport !== 'function') {
      throw new Error('createGeneratedSliceReport is not a function');
    }
  });

  suite.addTest('Validator directory exists', async () => {
    const validatorDir = join(projectRoot, 'tools/genesis/validators/generated-slice');
    if (!existsSync(validatorDir)) {
      throw new Error('Validator directory not found');
    }
  });

  suite.addTest('GeneratedSliceValidator.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/validators/generated-slice/GeneratedSliceValidator.mjs');
    if (!existsSync(file)) {
      throw new Error('GeneratedSliceValidator.mjs not found');
    }
  });

  suite.addTest('GeneratedSliceReport.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/validators/generated-slice/GeneratedSliceReport.mjs');
    if (!existsSync(file)) {
      throw new Error('GeneratedSliceReport.mjs not found');
    }
  });

  return suite;
}
