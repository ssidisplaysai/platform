import fs from "fs";
import path from "path";

export function writeFile(filePath, content, options = {}) {
  const force = options.force === true;

  if (fs.existsSync(filePath) && !force) {
    console.log(`Skipped existing file: ${filePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");

  console.log(`${fs.existsSync(filePath) && force ? "Overwrote" : "Created"}: ${filePath}`);
}
