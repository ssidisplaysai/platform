import fs from "fs";
import path from "path";
import { scaffolds } from "../registry/scaffolds.mjs";
import { writeFile } from "../utils/write-file.mjs";

function collectTemplateFiles(templateDir) {
  const entries = fs.readdirSync(templateDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(templateDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTemplateFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

export async function runScaffoldCommand(target, options = {}) {
  if (!target) {
    console.error("Missing scaffold target.");
    process.exit(1);
  }

  const scaffold = scaffolds[target];

  if (!scaffold) {
    console.error(`Unknown scaffold target: ${target}`);
    process.exit(1);
  }

  const root = process.cwd();
  const templateDir = path.join(root, scaffold.templateDir);
  const targetDir = path.join(root, scaffold.targetDir);

  if (!fs.existsSync(templateDir)) {
    console.error(`Template directory not found: ${templateDir}`);
    process.exit(1);
  }

  console.log(`Genesis scaffold: ${target}`);
  console.log(`Template directory: ${templateDir}`);
  console.log(`Target directory: ${targetDir}`);
  console.log("");

  const templateFiles = collectTemplateFiles(templateDir);

  for (const templateFile of templateFiles) {
    const relativePath = path.relative(templateDir, templateFile);
    const outputPath = path.join(targetDir, relativePath);
    const content = fs.readFileSync(templateFile, "utf8");

    writeFile(outputPath, content, options);
  }

  console.log("");
  console.log(`Genesis scaffold complete: ${target}`);
}
