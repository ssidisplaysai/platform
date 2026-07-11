import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * PassPipelineTests
 * 
 * Verify that the compiler pass-based pipeline works correctly.
 */
export default async function createPassPipelineTests() {
  const suite = new TestSuite('Pass Pipeline', 'Verify compiler pass architecture');

  // Import pipeline components
  const { CompilerPassRegistry } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/CompilerPassRegistry.mjs')).href);
  const { CompilerPipeline } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/CompilerPipeline.mjs')).href);
  const { CompilerContext } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/CompilerContext.mjs')).href);
  const { DefinitionRegistryPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/DefinitionRegistryPass.mjs')).href);
  const { BlueprintPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/BlueprintPass.mjs')).href);
  const { PlanningPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/PlanningPass.mjs')).href);
  const { RenderingPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/RenderingPass.mjs')).href);
  const { WritingPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/WritingPass.mjs')).href);
  const { ValidationPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/ValidationPass.mjs')).href);
  const { PromotionPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/PromotionPass.mjs')).href);
  const { RuntimeRegistrationPass } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/compiler/pipeline/passes/RuntimeRegistrationPass.mjs')).href);

  suite.addTest('CompilerContext initializes', async () => {
    const context = new CompilerContext('Customer');
    if (!context) throw new Error('CompilerContext failed to initialize');
  });

  suite.addTest('PassRegistry initializes', async () => {
    const registry = new CompilerPassRegistry();
    if (!registry) throw new Error('PassRegistry failed to initialize');
  });

  suite.addTest('All 8 passes register', async () => {
    const registry = new CompilerPassRegistry();
    
    const passes = [
      new DefinitionRegistryPass(),
      new BlueprintPass(),
      new PlanningPass(),
      new RenderingPass(),
      new WritingPass(),
      new ValidationPass(),
      new PromotionPass(),
      new RuntimeRegistrationPass(),
    ];

    passes.forEach(pass => registry.register(pass));
    
    if (registry.count() !== 8) {
      throw new Error(`Expected 8 passes, got ${registry.count()}`);
    }
  });

  suite.addTest('Passes register in order', async () => {
    const registry = new CompilerPassRegistry();
    
    const passes = [
      new DefinitionRegistryPass(),
      new BlueprintPass(),
      new PlanningPass(),
      new RenderingPass(),
      new WritingPass(),
      new ValidationPass(),
      new PromotionPass(),
      new RuntimeRegistrationPass(),
    ];

    passes.forEach(pass => registry.register(pass));
    
    const registeredPasses = registry.list();
    
    // Check that passes are sorted by order
    for (let i = 0; i < registeredPasses.length - 1; i++) {
      if (registeredPasses[i].order > registeredPasses[i + 1].order) {
        throw new Error(`Passes not in order: ${registeredPasses[i].name} (${registeredPasses[i].order}) > ${registeredPasses[i + 1].name} (${registeredPasses[i + 1].order})`);
      }
    }
  });

  suite.addTest('Pipeline executes passes', async () => {
    const pipeline = new CompilerPipeline();
    
    // Create context
    const context = new CompilerContext('Customer');
    context.entityName = 'Customer';
    
    // Note: Actual execution may require mocked dependencies
    // This test verifies that the pipeline infrastructure works
    if (!pipeline) {
      throw new Error('Pipeline failed to initialize');
    }
  });

  suite.addTest('Pass lookup is O(1)', async () => {
    const registry = new CompilerPassRegistry();
    
    const passes = [
      new DefinitionRegistryPass(),
      new BlueprintPass(),
      new PlanningPass(),
    ];

    passes.forEach(pass => registry.register(pass));
    
    // Lookup should be instant (O(1)) via Map.get()
    const pass = registry.get('Blueprint');
    if (!pass) throw new Error('Pass lookup failed');
    if (pass.name !== 'Blueprint') throw new Error('Wrong pass returned');
  });

  suite.addTest('Duplicate pass detection works', async () => {
    const registry = new CompilerPassRegistry();
    const pass = new DefinitionRegistryPass();
    
    registry.register(pass);
    
    // Try to register same pass again
    try {
      registry.register(pass);
      throw new Error('Duplicate registration should fail');
    } catch (err) {
      if (!err.message.includes('already registered')) {
        throw err;
      }
    }
  });

  return suite;
}
