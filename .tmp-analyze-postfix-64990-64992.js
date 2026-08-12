const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function stripTags(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function countWords(v){const t=stripTags(v); return t? t.split(/\s+/).filter(Boolean).length:0;}
function countLinks(html){const regex=/href=["']([^"']+)["']/gi;let m;let c=0;while((m=regex.exec(String(html||'')))!==null){const h=String(m[1]||'').trim();if(!h||h.startsWith('#')||h.startsWith('mailto:')||h.startsWith('tel:'))continue;if(h.startsWith('/')||/^https?:\/\/(www\.)?leddisplaywarehouse\.com(\/|$)/i.test(h))c++;}return c;}
(async()=>{
 const ids=['64990','64991','64992'];
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
   const source=String(first('Code in JavaScript')?.article_html||'');
   const callback=first('Send GLW Completion Callback')||{};
   out.push({
     executionId:id,
     city:first('Code in JavaScript')?.city || null,
     qaPassed:qa.qa_gate_passed,
     qaCallbackStatus:qa.qa_callback_status,
     qaDisposition:qa.qa_disposition,
     qaWordpressStatus:qa.qa_wordpress_status,
     checks:qa.qa_checks,
     failureReasons:qa.qa_failure_reasons,
     callbackStatus:callback.status ?? null,
     callbackDisposition:callback.disposition ?? null,
     bodyWordsRendered:countWords(rendered),
     bodyWordsSource:countWords(source),
     internalLinksRendered:countLinks(rendered),
     internalLinksSource:countLinks(source),
   });
 }
 fs.writeFileSync('.tmp-postfix-pass-64990-64992.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();