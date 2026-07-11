import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * MetaModelTests
 * 
 * Verify that the Genesis Meta Model is complete and accessible.
 */
export default async function createMetaModelTests() {
  const suite = new TestSuite('Meta Model', 'Verify meta model definitions');

  suite.addTest('Meta model directory exists', async () => {
    const metaDir = join(projectRoot, 'meta');
    if (!existsSync(metaDir)) {
      throw new Error('Meta model directory not found');
    }
  });

  suite.addTest('Entity.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Entity.meta.yaml');
    if (!existsSync(path)) throw new Error('Entity.meta.yaml not found');
  });

  suite.addTest('Field.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Field.meta.yaml');
    if (!existsSync(path)) throw new Error('Field.meta.yaml not found');
  });

  suite.addTest('Relationship.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Relationship.meta.yaml');
    if (!existsSync(path)) throw new Error('Relationship.meta.yaml not found');
  });

  suite.addTest('Capability.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Capability.meta.yaml');
    if (!existsSync(path)) throw new Error('Capability.meta.yaml not found');
  });

  suite.addTest('Lifecycle.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Lifecycle.meta.yaml');
    if (!existsSync(path)) throw new Error('Lifecycle.meta.yaml not found');
  });

  suite.addTest('Permission.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Permission.meta.yaml');
    if (!existsSync(path)) throw new Error('Permission.meta.yaml not found');
  });

  suite.addTest('Event.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Event.meta.yaml');
    if (!existsSync(path)) throw new Error('Event.meta.yaml not found');
  });

  suite.addTest('Audit.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Audit.meta.yaml');
    if (!existsSync(path)) throw new Error('Audit.meta.yaml not found');
  });

  suite.addTest('Automation.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Automation.meta.yaml');
    if (!existsSync(path)) throw new Error('Automation.meta.yaml not found');
  });

  suite.addTest('Search.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Search.meta.yaml');
    if (!existsSync(path)) throw new Error('Search.meta.yaml not found');
  });

  suite.addTest('Analytics.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/Analytics.meta.yaml');
    if (!existsSync(path)) throw new Error('Analytics.meta.yaml not found');
  });

  suite.addTest('AI.meta.yaml exists', async () => {
    const path = join(projectRoot, 'meta/AI.meta.yaml');
    if (!existsSync(path)) throw new Error('AI.meta.yaml not found');
  });

  suite.addTest('Meta model README exists', async () => {
    const path = join(projectRoot, 'meta/README.md');
    if (!existsSync(path)) throw new Error('Meta model README not found');
  });

  suite.addTest('Entity.meta.yaml has content', async () => {
    const path = join(projectRoot, 'meta/Entity.meta.yaml');
    const content = readFileSync(path, 'utf-8');
    
    if (content.length < 100) {
      throw new Error('Entity.meta.yaml too small');
    }
    
    if (!content.includes('Universal Entity Properties')) {
      throw new Error('Entity.meta.yaml missing expected content');
    }
  });

  suite.addTest('Field.meta.yaml has content', async () => {
    const path = join(projectRoot, 'meta/Field.meta.yaml');
    const content = readFileSync(path, 'utf-8');
    
    if (content.length < 100) {
      throw new Error('Field.meta.yaml too small');
    }
    
    if (!content.includes('Universal Field Properties')) {
      throw new Error('Field.meta.yaml missing expected content');
    }
  });

  suite.addTest('All meta files have content', async () => {
    const metaFiles = [
      'Relationship.meta.yaml',
      'Capability.meta.yaml',
      'Lifecycle.meta.yaml',
      'Permission.meta.yaml',
      'Event.meta.yaml',
      'Audit.meta.yaml',
      'Automation.meta.yaml',
      'Search.meta.yaml',
      'Analytics.meta.yaml',
      'AI.meta.yaml'
    ];

    for (const file of metaFiles) {
      const path = join(projectRoot, 'meta', file);
      const content = readFileSync(path, 'utf-8');
      
      if (content.length < 100) {
        throw new Error(`${file} too small`);
      }
    }
  });

  suite.addTest('ADR-0011 exists', async () => {
    const path = join(projectRoot, 'docs/architecture/0011-meta-model.md');
    if (!existsSync(path)) throw new Error('ADR-0011 not found');
  });

  return suite;
}
