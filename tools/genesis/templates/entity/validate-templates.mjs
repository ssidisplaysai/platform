import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTemplatePath, renderEntityTemplate } from "./TemplateRenderer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
const templateDir = __dirname;
const sampleEntity = "Invoice";
const generatedAt = "2026-01-01T00:00:00.000Z";
const unresolvedTokenPattern = /\{\{[A-Za-z0-9_]+\}\}/g;

const templatePlan = [
  {
    artifactType: "entity-definition",
    templateFile: "definition.template.ts",
    outputPath: "src/domain/definitions/InvoiceDefinition.ts",
    validateWithTsc: true,
    classification: "placeholder-artifact",
  },
  {
    artifactType: "repository",
    templateFile: "repository.template.ts",
    outputPath: "src/repositories/InvoiceRepository.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "service",
    templateFile: "service.template.ts",
    outputPath: "src/services/InvoiceService.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "validator",
    templateFile: "validator.template.ts",
    outputPath: "src/validators/InvoiceValidator.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "events",
    templateFile: "events.template.ts",
    outputPath: "src/events/InvoiceEvents.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "permissions",
    templateFile: "permissions.template.ts",
    outputPath: "src/permissions/InvoicePermissions.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "search",
    templateFile: "search.template.ts",
    outputPath: "src/search/InvoiceSearch.ts",
    validateWithTsc: true,
    classification: "code-generation-template",
  },
  {
    artifactType: "tests",
    templateFile: "tests.template.ts",
    outputPath: "src/tests/InvoiceService.test.ts",
    validateWithTsc: true,
    classification: "scaffold-template",
  },
  {
    artifactType: "documentation",
    templateFile: "documentation.template.md",
    outputPath: "docs/Invoice.md",
    validateWithTsc: false,
    classification: "documentation-example",
  },
];

const requiredTokensByTemplate = {
  "definition.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "repository.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "service.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "validator.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "events.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "permissions.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "search.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "tests.template.ts": ["{{EntityName}}", "{{entityNameLower}}", "{{GeneratedAt}}"],
  "documentation.template.md": ["{{EntityName}}", "{{GeneratedAt}}"],
};

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readTemplateFile(templateFile) {
  const templatePath = path.join(templateDir, templateFile);
  ensure(fs.existsSync(templatePath), `Template file is missing: ${templateFile}`);
  return fs.readFileSync(templatePath, "utf8");
}

function validateRequiredTokens(templateFile) {
  const contents = readTemplateFile(templateFile);
  const requiredTokens = requiredTokensByTemplate[templateFile] ?? [];

  for (const token of requiredTokens) {
    ensure(contents.includes(token), `Required token ${token} missing from ${templateFile}`);
  }
}

function validateCatalog() {
  const discoveredTemplateFiles = fs
    .readdirSync(templateDir)
    .filter((fileName) => fileName.endsWith(".template.ts") || fileName.endsWith(".template.md"))
    .sort((left, right) => left.localeCompare(right));

  const plannedTemplateFiles = templatePlan
    .map((entry) => entry.templateFile)
    .sort((left, right) => left.localeCompare(right));

  ensure(
    discoveredTemplateFiles.length === plannedTemplateFiles.length,
    `Template plan/catalog size mismatch: discovered ${discoveredTemplateFiles.length}, planned ${plannedTemplateFiles.length}`,
  );

  for (let index = 0; index < discoveredTemplateFiles.length; index += 1) {
    ensure(
      discoveredTemplateFiles[index] === plannedTemplateFiles[index],
      `Template plan/catalog mismatch at index ${index}: discovered ${discoveredTemplateFiles[index]}, planned ${plannedTemplateFiles[index]}`,
    );
  }

  for (const templateFile of discoveredTemplateFiles) {
    validateRequiredTokens(templateFile);
  }

  return discoveredTemplateFiles;
}

function renderTemplates() {
  const rendered = [];

  for (const plan of templatePlan) {
    const templatePath = getTemplatePath(plan.artifactType);
    ensure(
      path.basename(templatePath) === plan.templateFile,
      `Template path mapping mismatch for ${plan.artifactType}: expected ${plan.templateFile}, got ${path.basename(templatePath)}`,
    );

    const renderedContent = renderEntityTemplate(plan.artifactType, sampleEntity, generatedAt);
    const unresolved = renderedContent.match(unresolvedTokenPattern) ?? [];
    ensure(unresolved.length === 0, `${plan.templateFile} rendered with unresolved tokens: ${unresolved.join(", ")}`);

    rendered.push({
      ...plan,
      renderedContent,
    });
  }

  return rendered;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function createFixtureWorkspace(renderedTemplates) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "genesis-template-validation-"));

  writeFile(
    path.join(fixtureRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
          },
        },
        include: ["src/**/*.ts", "src/**/*.d.ts"],
      },
      null,
      2,
    ),
  );

  writeFile(
    path.join(fixtureRoot, "src/domain/entities/Invoice.ts"),
    "export type Invoice = { id: string; name?: string; createdAt?: string; updatedAt?: string };\n",
  );

  writeFile(
    path.join(fixtureRoot, "src/domain/schema/EntitySchema.ts"),
    "export type EntitySchema = {\n"
      + "  entityType: string;\n"
      + "  businessIdPrefix: string;\n"
      + "  description: string;\n"
      + "  display: Record<string, unknown>;\n"
      + "  fields: Array<Record<string, unknown>>;\n"
      + "  relationships: unknown[];\n"
      + "  validation: unknown[];\n"
      + "  permissions: string[];\n"
      + "  searchable: boolean;\n"
      + "  auditable: boolean;\n"
      + "};\n",
  );

  writeFile(
    path.join(fixtureRoot, "src/types/vitest.d.ts"),
    "declare module 'vitest' {\n"
      + "  export const describe: (...args: any[]) => void;\n"
      + "  export const it: (...args: any[]) => void;\n"
      + "  export const expect: (...args: any[]) => { toBe: (...inner: any[]) => void };\n"
      + "  export const beforeEach: (...args: any[]) => void;\n"
      + "}\n",
  );

  for (const plan of renderedTemplates) {
    writeFile(path.join(fixtureRoot, plan.outputPath), plan.renderedContent);
  }

  // Support service template local repository import and tests template directory expectations.
  writeFile(
    path.join(fixtureRoot, "src/services/InvoiceRepository.ts"),
    "export * from '../repositories/InvoiceRepository';\n",
  );

  writeFile(
    path.join(fixtureRoot, "src/services/InvoiceValidator.ts"),
    "export * from '../validators/InvoiceValidator';\n",
  );

  return fixtureRoot;
}

function runFixtureTypecheck(fixtureRoot) {
  const tscEntry = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

  execFileSync(process.execPath, [tscEntry, "--noEmit", "-p", path.join(fixtureRoot, "tsconfig.json")], {
    cwd: repoRoot,
    stdio: "pipe",
    env: process.env,
  });
}

export function validateEntityTemplates() {
  const discoveredTemplateFiles = validateCatalog();
  const renderedTemplates = renderTemplates();
  const fixtureRoot = createFixtureWorkspace(renderedTemplates);

  runFixtureTypecheck(fixtureRoot);

  return {
    discoveredTemplateFiles,
    renderedTemplates: renderedTemplates.map((entry) => ({
      templateFile: entry.templateFile,
      outputPath: entry.outputPath,
      validateWithTsc: entry.validateWithTsc,
      classification: entry.classification,
    })),
    fixtureRoot,
  };
}

function runCli() {
  const result = validateEntityTemplates();

  console.log("Template validation passed.");
  console.log(`Discovered templates: ${result.discoveredTemplateFiles.length}`);
  for (const item of result.renderedTemplates) {
    console.log(`- ${item.templateFile} => ${item.outputPath} [${item.classification}]`);
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Template validation failed: ${message}`);
    process.exit(1);
  }
}
