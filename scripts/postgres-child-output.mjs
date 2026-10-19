export const CHILD_OUTPUT_LIMIT_CHARS = 12_000;

const SECRET_ENVIRONMENT_NAME = /PASSWORD|SECRET|TOKEN|CREDENTIAL|PRIVATE_KEY/i;

export function secretValues(environment) {
  return Object.entries(environment)
    .filter(([name, value]) => SECRET_ENVIRONMENT_NAME.test(name) && typeof value === "string" && value.length >= 4)
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length);
}

export function redactOutput(text, secrets) {
  let redacted = String(text ?? "");
  for (const secret of secrets) redacted = redacted.split(secret).join("[REDACTED]");
  return redacted
    .replace(/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/((?:password|passwd|pwd)\s*[=:]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
}

export function boundOutput(text, limit = CHILD_OUTPUT_LIMIT_CHARS) {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return `${text.slice(0, half)}\n[... ${text.length - limit} characters truncated ...]\n${text.slice(-half)}`;
}

export function formatChildFailureOutput(label, result, environment, limit = CHILD_OUTPUT_LIMIT_CHARS) {
  const secrets = secretValues(environment);
  const lines = [];
  for (const [stream, value] of [["STDOUT", result.stdout], ["STDERR", result.stderr]]) {
    lines.push(
      `${label}_${stream}_BEGIN`,
      boundOutput(redactOutput(value, secrets), limit),
      `${label}_${stream}_END`,
    );
  }
  return lines.join("\n");
}
