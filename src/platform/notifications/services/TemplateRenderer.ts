import { randomUUID } from "node:crypto";
import type { RenderedNotification, TemplateDefinition } from "../contracts";

type RenderInput = {
  template: TemplateDefinition;
  payload: Record<string, string | number | boolean | null>;
};

function stringifyValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }

  return String(value);
}

function collectVariablesFromTemplate(content: string): string[] {
  const matches = content.match(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g) ?? [];
  return matches
    .map((token) => token.replace(/\{\{|\}\}/g, "").trim())
    .filter((value, index, list) => list.indexOf(value) === index);
}

function interpolate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, variableName: string) => variables[variableName] ?? "");
}

export class TemplateRenderer {
  render(input: RenderInput): RenderedNotification {
    const requiredVariables = new Set<string>([
      ...input.template.requiredVariables,
      ...collectVariablesFromTemplate(input.template.bodyTemplate),
      ...collectVariablesFromTemplate(input.template.subjectTemplate ?? ""),
      ...collectVariablesFromTemplate(input.template.titleTemplate ?? ""),
    ]);

    const missing = Array.from(requiredVariables).filter((name) => input.payload[name] === undefined);
    if (missing.length > 0) {
      throw new Error(`missing template variables: ${missing.join(", ")}`);
    }

    const resolvedVariables: Record<string, string> = {};
    for (const variableName of requiredVariables) {
      resolvedVariables[variableName] = stringifyValue(input.payload[variableName] ?? null);
    }

    return {
      templateId: input.template.templateId,
      templateVersion: input.template.version,
      channel: input.template.channel,
      subject: input.template.subjectTemplate
        ? interpolate(input.template.subjectTemplate, resolvedVariables)
        : undefined,
      title: input.template.titleTemplate
        ? interpolate(input.template.titleTemplate, resolvedVariables)
        : undefined,
      body: interpolate(input.template.bodyTemplate, resolvedVariables),
      variables: {
        ...resolvedVariables,
        renderId: randomUUID(),
      },
    };
  }
}
