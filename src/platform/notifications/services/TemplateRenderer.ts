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

function stableStringify(input: Record<string, string>): string {
  return JSON.stringify(Object.keys(input).sort().reduce<Record<string, string>>((result, key) => {
    result[key] = input[key];
    return result;
  }, {}));
}

function buildRenderIdentity(template: TemplateDefinition, resolvedVariables: Record<string, string>, subject?: string, title?: string, body?: string): string {
  const identitySource = {
    templateId: template.templateId,
    channel: template.channel,
    version: `${template.version.major}.${template.version.minor}.${template.version.patch}`,
    subject: subject ?? "",
    title: title ?? "",
    body: body ?? "",
    variables: stableStringify(resolvedVariables),
  };

  return Buffer.from(JSON.stringify(identitySource), "utf8").toString("base64url");
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

    const subject = input.template.subjectTemplate
      ? interpolate(input.template.subjectTemplate, resolvedVariables)
      : undefined;
    const title = input.template.titleTemplate
      ? interpolate(input.template.titleTemplate, resolvedVariables)
      : undefined;
    const body = interpolate(input.template.bodyTemplate, resolvedVariables);

    return {
      templateId: input.template.templateId,
      templateVersion: input.template.version,
      channel: input.template.channel,
      renderIdentity: buildRenderIdentity(input.template, resolvedVariables, subject, title, body),
      subject,
      title,
      body,
      variables: resolvedVariables,
    };
  }
}
