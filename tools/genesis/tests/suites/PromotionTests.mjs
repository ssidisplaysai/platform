import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * PromotionTests
 * 
 * Verify that promotion modules exist and are callable.
 */
export default async function createPromotionTests() {
  const suite = new TestSuite('Promotion', 'Verify promotion modules');

  // Import PromotionEngine
  const { promoteEntity } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/promotion/PromotionEngine.mjs')).href);
  const { createPromotionContext } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/promotion/PromotionContext.mjs')).href);

  suite.addTest('promoteEntity function exists', async () => {
    if (typeof promoteEntity !== 'function') {
      throw new Error('promoteEntity is not a function');
    }
  });

  suite.addTest('createPromotionContext function exists', async () => {
    if (typeof createPromotionContext !== 'function') {
      throw new Error('createPromotionContext is not a function');
    }
  });

  suite.addTest('Promotion directory exists', async () => {
    const promotionDir = join(projectRoot, 'tools/genesis/compiler/promotion');
    const fs = await import('fs');
    if (!fs.existsSync(promotionDir)) {
      throw new Error('Promotion directory not found');
    }
  });

  suite.addTest('PromotionEngine.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/promotion/PromotionEngine.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('PromotionEngine.mjs not found');
    }
  });

  return suite;
}
