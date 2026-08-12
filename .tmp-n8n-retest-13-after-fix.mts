import { createGlwN8nExecutionService } from "./src/lib/glw/n8n";

const svc = createGlwN8nExecutionService();
const ids = ['41610','41688','41741','46992','60113','60809','60815','60834','60915','60919','60948','60951','60969'];

const results = [];
for (const id of ids) {
  const r = await svc.getExecutionDiagnostics(id);
  if (r.available) {
    results.push({ id, reachable: true, state: r.diagnostics.executionState, terminal: r.diagnostics.terminal });
  } else {
    results.push({ id, reachable: false, reason: r.reason, upstreamStatus: r.upstreamStatus ?? null });
  }
}

console.log(JSON.stringify({ count: results.length, results }, null, 2));