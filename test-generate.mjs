import { generate } from "./tools/genesis/compiler/CodeGenerationEngine.mjs";

console.log("Testing code generation...");

try {
  const result = await generate({ entity: "Customer" });
  console.log("Generation complete:");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Generation failed:", error.message);
  console.error(error.stack);
}
