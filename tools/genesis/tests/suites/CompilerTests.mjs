import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * CompilerTests
 * 
 * Verify that the Compiler modules exist and are callable.
 */
export default async function createCompilerTests() {
  const suite = new TestSuite('Compiler', 'Verify compiler modules');

  // Import compiler modules
  const { compilePlan } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/compiler/GenerationCompiler.mjs')).href);
  const { createCompilationContext } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/compiler/CompilationContext.mjs')).href);

  suite.addTest('compilePlan function exists', async () => {
    if (typeof compilePlan !== 'function') {
      throw new Error('compilePlan is not a function');
    }
  });

  suite.addTest('createCompilationContext function exists', async () => {
    if (typeof createCompilationContext !== 'function') {
      throw new Error('createCompilationContext is not a function');
    }
  });

  suite.addTest('Compiler modules directory exists', async () => {
    const compilerDir = join(projectRoot, 'tools/genesis/compiler/compiler');
    const fs = await import('fs');
    if (!fs.existsSync(compilerDir)) {
      throw new Error('Compiler directory not found');
    }
  });

  suite.addTest('GenerationCompiler.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/compiler/GenerationCompiler.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('GenerationCompiler.mjs not found');
    }
  });

  suite.addTest('CompilationContext.mjs exists', async () => {
    const file = join(projectRoot, 'tools/genesis/compiler/compiler/CompilationContext.mjs');
    const fs = await import('fs');
    if (!fs.existsSync(file)) {
      throw new Error('CompilationContext.mjs not found');
    }
  });

  return suite;
}
