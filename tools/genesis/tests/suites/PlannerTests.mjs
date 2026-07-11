import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * PlannerTests
 * 
 * Verify that the Planner modules exist and are callable.
 */
export default async function createPlannerTests() {
  const suite = new TestSuite('Planner', 'Verify planner modules');

  // Import planner modules
  const { planEntity } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/planner/GenerationPlanner.mjs')).href);
  const { createGenerationPlan } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/planner/GenerationPlan.mjs')).href);

  suite.addTest('planEntity function exists', async () => {
    if (typeof planEntity !== 'function') {
      throw new Error('planEntity is not a function');
    }
  });

  suite.addTest('createGenerationPlan function exists', async () => {
    if (typeof createGenerationPlan !== 'function') {
      throw new Error('createGenerationPlan is not a function');
    }
  });

  suite.addTest('Planner directory exists', async () => {
    const plannerDir = join(projectRoot, 'tools/genesis/compiler/planner');
    const fs = await import('fs');
    if (!fs.existsSync(plannerDir)) {
      throw new Error('Planner directory not found');
    }
  });

  suite.addTest('GenerationPlanner.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/planner/GenerationPlanner.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('GenerationPlanner.mjs not found');
    }
  });

  suite.addTest('GenerationPlan.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/planner/GenerationPlan.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('GenerationPlan.mjs not found');
    }
  });

  return suite;
}
