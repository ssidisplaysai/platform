export function renderDocumentTemplate(
  templateBody: string,
  variables: Record<string, string | number | boolean | null>,
): string {
  return Object.entries(variables).reduce((content, [key, value]) => {
    const safe = value === null ? "" : String(value);
    return content.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), safe);
  }, templateBody);
}
