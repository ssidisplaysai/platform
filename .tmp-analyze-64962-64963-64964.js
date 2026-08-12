const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function stripTags(html){
  return String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ')
    .trim();
}
function countWords(text){const t=stripTags(text);return t? t.split(/\s+/).filter(Boolean).length:0;}
function hasPlaceholder(text){
  const patterns=[/lorem ipsum/i,/\bTODO\b/i,/coming soon/i,/image placeholder/i,/\btest\b/i,/\bsample\b/i,/\{\{/,/\}\}/];
  return patterns.some((p)=>p.test(String(text||'')));
}
function extractInternalLinks(html){
  const links=[];
  const regex=/href=["']([^"']+)["']/gi;
  let match;
  while((match=regex.exec(String(html||'')))!==null){
    const href=String(match[1]||'').trim();
    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if(href.startsWith('/')) { links.push(href); continue; }
    try {
      const u=new URL(href);
      if(u.hostname.toLowerCase()==='leddisplaywarehouse.com') links.push(href);
    } catch {}
  }
  return links;
}
(async()=>{
  const ids=['64962','64963','64964'];
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const results=[];
  for(const id of ids){
    const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
    const rd=ex?.data?.resultData?.runData||{};
    const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
    const qa=first('Build Pre-Publish QA Result')||{};
    const pageResp=first('Fetch QA Page Snapshot')||{};
    const code=first('Code in JavaScript')||{};
    const page=pageResp?.body||{};
    const rendered=String(page?.content?.rendered||'');
    const sourceHtml=String(code?.article_html||'');
    const renderedLinks=extractInternalLinks(rendered);
    const sourceLinks=extractInternalLinks(sourceHtml);
    const renderedWordCount=countWords(rendered);
    const sourceWordCount=countWords(sourceHtml);
    results.push({
      executionId:id,
      jobId: qa.job_id || first('Get row(s) in sheet')?.job_id || null,
      city: code.city || null,
      qaPassed: qa.qa_gate_passed,
      qaStatus: qa.qa_callback_status,
      checks: qa.qa_checks || null,
      failureReasons: qa.qa_failure_reasons || null,
      body: {
        requiredMinWords: 1200,
        renderedWordCount,
        sourceWordCount,
        renderedPlaceholderDetected: hasPlaceholder(rendered),
        sourcePlaceholderDetected: hasPlaceholder(sourceHtml),
        renderedHtmlLength: rendered.length,
        sourceHtmlLength: sourceHtml.length,
        renderedEmpty: rendered.trim().length===0,
        sourceEmpty: sourceHtml.trim().length===0,
      },
      internalLinks: {
        requiredMinInternalLinks: 3,
        renderedCount: renderedLinks.length,
        sourceCount: sourceLinks.length,
        renderedLinksDiscovered: renderedLinks,
        sourceLinksDiscovered: sourceLinks,
      },
    });
  }
  fs.writeFileSync('.tmp-exec-64962-64963-64964-analysis.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})();