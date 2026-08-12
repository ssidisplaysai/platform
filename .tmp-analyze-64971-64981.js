const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function stripTags(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function countWords(value){const t=stripTags(value); return t? t.split(/\s+/).filter(Boolean).length:0;}
function extractInternalLinks(html){const links=[]; const regex=/href=["']([^"']+)["']/gi; let m; while((m=regex.exec(String(html||'')))!==null){const href=String(m[1]||'').trim(); if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')) continue; if(href.startsWith('/')){links.push(href); continue;} try{const u=new URL(href); if(u.hostname.toLowerCase()==='leddisplaywarehouse.com') links.push(href);}catch{}} return links;}
(async()=>{
  const ids=['64971','64981'];
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const out=[];
  for(const id of ids){
    const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
    const rd=ex?.data?.resultData?.runData||{};
    const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
    const qa=first('Build Pre-Publish QA Result')||{};
    const page=first('Fetch QA Page Snapshot')?.body||{};
    const rendered=String(page?.content?.rendered||'');
    const sourceHtml=String(first('Code in JavaScript')?.article_html||'');
    const renderedLinks=extractInternalLinks(rendered);
    const sourceLinks=extractInternalLinks(sourceHtml);
    out.push({
      executionId:id,
      city:first('Code in JavaScript')?.city || null,
      jobId:first('Get row(s) in sheet')?.job_id || null,
      qaChecks:qa.qa_checks || null,
      qaFailureReasons:qa.qa_failure_reasons || null,
      bodyWordCountRendered:countWords(rendered),
      bodyWordCountSource:countWords(sourceHtml),
      renderedLinkCount:renderedLinks.length,
      sourceLinkCount:sourceLinks.length,
      renderedLinks,
      sourceLinks,
    });
  }
  fs.writeFileSync('.tmp-exec-64971-64981-analysis.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();