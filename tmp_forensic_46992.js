const fs = require('fs');
let text = fs.readFileSync('tmp_execution_46992.json','utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const raw = JSON.parse(text);
const runData = raw?.data?.resultData?.runData || {};
const nodes = new Map((raw?.workflowData?.nodes || []).map(n => [n.name, n]));
const events = [];
for (const [name, runs] of Object.entries(runData)) {
  if (!Array.isArray(runs)) continue;
  runs.forEach((run, idx) => {
    const st = run?.startTime || run?.startedAt || null;
    const ms = Number.isFinite(run?.executionTime) ? run.executionTime : 0;
    const err = run?.error || null;
    events.push({
      node: name,
      id: nodes.get(name)?.id || null,
      type: nodes.get(name)?.type || null,
      orderTs: typeof st === 'number' ? st : (st ? Date.parse(st) : 0),
      start: st,
      durMs: ms,
      status: err ? 'FAILED' : 'SUCCESS',
      errName: err?.name || null,
      errMsg: err?.message || null,
      runIndex: idx,
    });
  });
}
events.sort((a,b)=>a.orderTs-b.orderTs || a.runIndex-b.runIndex);
const fail = events.find(e=>e.status==='FAILED') || null;
const stack = raw?.data?.executionData?.nodeExecutionStack?.[0] || null;
const input = stack?.data?.main?.[0]?.[0]?.json || {};
const callbackUrl = (runData['Get row(s) in sheet']?.[0]?.data?.main?.[0]?.[0]?.json?.callback_url) || null;
const out = {
  execution: {
    id: raw.id,
    status: raw.status,
    startedAt: raw.startedAt,
    stoppedAt: raw.stoppedAt,
    durationMs: Date.parse(raw.stoppedAt) - Date.parse(raw.startedAt),
    finished: raw.finished,
    workflowId: raw.workflowId,
  },
  failNode: fail,
  resultError: raw?.data?.resultData?.error || null,
  predecessor: stack?.source?.main?.[0] || null,
  callbackUrl,
  completionEvidence: {
    wordpressPageId: input?.id || null,
    wordpressLink: input?.link || null,
    wordpressStatus: input?.status || null,
    featuredMediaId: input?.featured_media || null,
    titleRaw: input?.title?.raw || null,
    hasContentRaw: typeof input?.content?.raw === 'string' && input.content.raw.length > 0,
    hasImageInContent: typeof input?.content?.raw === 'string' && /<img\s/i.test(input.content.raw),
    hasOgImage: Boolean(input?.yoast_head_json?.og_image?.[0]?.url),
  },
  nodeOrder: events.map((e,i)=>({order:i+1,node:e.node,id:e.id,type:e.type,status:e.status,durationMs:e.durMs,start:e.start,errName:e.errName,errMsg:e.errMsg}))
};
fs.writeFileSync('tmp_execution_46992_forensic.json', JSON.stringify(out, null, 2));
console.log('wrote=tmp_execution_46992_forensic.json');
console.log('orderCount=' + out.nodeOrder.length);
console.log('failed=' + (out.failNode?.node || 'none'));
