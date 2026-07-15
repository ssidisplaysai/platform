import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TEST_ROOTS = ["tests", "src"];
const TEST_FILE_PATTERN = /\.(test|spec)\.ts$/i;
const NODE_TEST_PATTERN = /\bnode:test\b/;

function toPosix(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function collectTestFiles(rootDir, currentPath, out) {
  const entries = readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(rootDir, fullPath, out);
      continue;
    }

    if (!entry.isFile() || !TEST_FILE_PATTERN.test(entry.name)) {
      continue;
    }

    const rel = toPosix(relative(rootDir, fullPath));
    out.push(rel);
  }
}

function fileExists(pathValue) {
  try {
    return statSync(pathValue).isFile() || statSync(pathValue).isDirectory();
  } catch {
    return false;
  }
}

export function classifySuites(rootDir = process.cwd()) {
  const testFiles = [];

  for (const root of TEST_ROOTS) {
    const abs = join(rootDir, root);
    if (!fileExists(abs)) {
      continue;
    }
    collectTestFiles(rootDir, abs, testFiles);
  }

  testFiles.sort((a, b) => a.localeCompare(b));

  const nodeTestSuites = [];
  const jestSuites = [];

  for (const relFile of testFiles) {
    const content = readFileSync(join(rootDir, relFile), "utf8");
    if (NODE_TEST_PATTERN.test(content)) {
      nodeTestSuites.push(relFile);
    } else {
      jestSuites.push(relFile);
    }
  }

  return {
    allSuites: testFiles,
    nodeTestSuites,
    jestSuites,
  };
}
