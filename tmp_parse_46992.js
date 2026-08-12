const fs = require('fs');
let text = fs.readFileSync('tmp_execution_46992.json','utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const raw = JSON.parse(text);
const runData = raw?.data?.resultData?.runData || {};
const nodeMeta = new Map((raw?.workflowData?.nodes || []).map(n => [n.name, n]));
const events = [];
for (const [name, runs] of Object.entries(runData)) {
  if (!Array.isArray(runs)) continue;
  runs.forEach((run, runIndex) => {
    const start = run?.startTime || run?.startedAt || null;
    const execMs = Number.isFinite(run?.executionTime) ? run.executionTime : 0;
    const err = run?.error || null;
    const status = err ? 'failed' : 'success';
    const outputItems = Array.isArray(run?.data?.main?.[0]) ? run.data.main[0].length : 0;
    events.push({
      nodeName: name,
      nodeId: nodeMeta.get(name)?.id || null,
      nodeType: nodeMeta.get(name)?.type || null,
      runIndex,
      status,
      startTime: start,
      executionTimeMs: execMs,
      outputItems,
      errorName: err?.name || null,
      errorMessage: err?.message || null,
      errorStack: err?.stack || null,
    });
  });
}
const sorted = events.sort((a,b)=> new Date(a.startTime||0)-new Date(b.startTime||0));
const failure = sorted.find(e=>e.status==='failed') || null;
const summary = {
  execution: {
    id: raw.id,
    status: raw.status,
    startedAt: raw.startedAt,
    stoppedAt: raw.stoppedAt,
    finished: raw.finished,
    workflowId: raw.workflowId,
  },
  counts: { nodesWithRuns: Object.keys(runData).length, totalRuns: sorted.length },
  failure,
  lastNodeExecuted: raw?.data?.resultData?.lastNodeExecuted || null,
  resultError: raw?.data?.resultData?.error || null,
  sourceIntoFailedNode: raw?.data?.executionData?.nodeExecutionStack?.[0]?.source || null,
  failedNodeMeta: raw?.data?.executionData?.nodeExecutionStack?.[0]?.node || null,
  failedNodeInputSample: raw?.data?.executionData?.nodeExecutionStack?.[0]?.data?.main?.[0]?.[0]?.json || null,
  nodeOrder: sorted.map((e, i) => ({ order: i+1, nodeName: e.nodeName, nodeId: e.nodeId, nodeType: e.nodeType, status: e.status, startTime: e.startTime, executionTimeMs: e.executionTimeMs, outputItems: e.outputItems }))
};
fs.writeFileSync('tmp_execution_46992_summary.json', JSON.stringify(summary, null, 2));
console.log('wrote=tmp_execution_46992_summary.json');
console.log('nodesWithRuns=' + summary.counts.nodesWithRuns + '; totalRuns=' + summary.counts.totalRuns);
console.log('failedNode=' + (summary.failure?.nodeName || summary.lastNodeExecuted));
