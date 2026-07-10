type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function stableStringify(value: JsonLike): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const keyValuePairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, JsonLike>)[key])}`);
  return `{${keyValuePairs.join(",")}}`;
}

function parseSimpleYaml(input: string): JsonLike {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const root: Record<string, JsonLike> = {};
  const stack: Array<{ indent: number; container: Record<string, JsonLike> }> = [{ indent: -1, container: root }];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");

    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf(":");

    if (separatorIndex <= 0) {
      throw new Error(`Unsupported YAML line: ${trimmed}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].container;

    if (!rawValue) {
      const nested: Record<string, JsonLike> = {};
      current[key] = nested;
      stack.push({ indent, container: nested });
      continue;
    }

    const scalar = rawValue.replace(/^['\"]|['\"]$/g, "");

    if (scalar === "true" || scalar === "false") {
      current[key] = scalar === "true";
      continue;
    }

    if (scalar === "null") {
      current[key] = null;
      continue;
    }

    const numeric = Number(scalar);
    current[key] = Number.isFinite(numeric) && scalar !== "" && !Number.isNaN(numeric) ? numeric : scalar;
  }

  return root;
}

export class ContentNormalizer {
  normalize(sourceType: "markdown" | "json" | "yaml" | "filesystem", content: string): string {
    const normalized = content.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");

    if (sourceType === "json") {
      const parsed = JSON.parse(normalized) as JsonLike;
      return `${stableStringify(parsed)}\n`;
    }

    if (sourceType === "yaml") {
      const parsed = parseSimpleYaml(normalized);
      return `${stableStringify(parsed)}\n`;
    }

    const trimmed = normalized.trimEnd();
    return trimmed.length > 0 ? `${trimmed}\n` : "";
  }
}
