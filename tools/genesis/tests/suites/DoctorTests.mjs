import { TestSuite } from '../TestSuite.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * DoctorTests
 * 
 * Verify that the Doctor (system health check) works correctly.
 */
export default async function createDoctorTests() {
  const suite = new TestSuite('Doctor', 'Verify system health and dependencies');

  // Import doctor command
  const { runDoctorCommand } = await import(pathToFileURL(join(projectRoot, 'tools/genesis/commands/doctor.mjs')).href);

  suite.addTest('Doctor command is callable', async () => {
    if (typeof runDoctorCommand !== 'function') {
      throw new Error('runDoctorCommand is not a function');
    }
  });

  suite.addTest('Genesis tools directory exists', async () => {
    const path = join(projectRoot, 'tools/genesis');
    if (!existsSync(path)) throw new Error('tools/genesis directory not found');
  });

  suite.addTest('Compiler directory exists', async () => {
    const path = join(projectRoot, 'tools/genesis/compiler');
    if (!existsSync(path)) throw new Error('tools/genesis/compiler directory not found');
  });

  suite.addTest('Definitions directory exists', async () => {
    const path = join(projectRoot, 'definitions/entity');
    if (!existsSync(path)) throw new Error('definitions/entity directory not found');
  });

  suite.addTest('Meta model directory exists', async () => {
    const path = join(projectRoot, 'meta');
    if (!existsSync(path)) throw new Error('meta directory not found');
  });

  return suite;
}
