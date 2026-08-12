const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
const patterns=['qa-','test','testing','duplicate','replay','tmp'];
const isCandidate=(s)=>patterns.find((p)=>String(s||'').toLowerCase().includes(p))||null;
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const list=await (await fetch(`${origin}/api/v1/executions?workflowId=bIDXxyWnY22G8zJC&limit=200`,{headers})).json();
  const rows=Array.isArray(list.data)?list.data:[];
  const candidates=[];
  for(const row of rows){
    const id=String(row.id);
    const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
    const rd=ex?.data?.resultData?.runData||{};
    const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
    const prep=first('Prepare State Parent')||{};
    const qa=first('Build Pre-Publish QA Result')||{};
    const snap=first('Fetch QA Page Snapshot')?.body||{};
    const title=String(snap.title?.rendered||qa.qa_title||prep.title||'').trim();
    const slug=String(snap.slug||prep.city_slug||'').trim();
    const reason=isCandidate(title)||isCandidate(slug);
    if(!reason) continue;
    const status=String(snap.status||qa.qa_wordpress_status||'').trim()||null;
    const item={
      sourceExecutionId:id,
      pageId:Number(snap.id||qa.qa_page_id||0)||null,
      title,
      slug,
      status,
      parent:Number(snap.parent||0)||0,
      created:String(snap.date_gmt||snap.date||row.startedAt||row.createdAt||''),
      reason:`pattern:${reason}`,
      url:String(snap.link||qa.qa_wordpress_url||'').trim()||null,
    };
    const lower=(title+' '+slug).toLowerCase();
    const prodCity = /\b(austin|houston)\b/.test(lower);
    const safe = !prodCity && (status==='draft' || slug.startsWith('qa-') || lower.includes('duplicate') || lower.includes('replay') || lower.includes('tmp') || lower.includes('test'));
    (safe?candidates.push({...item,bucket:'SAFE TO TRASH'}):candidates.push({...item,bucket:'REVIEW REQUIRED'}));
  }
  const uniq=[]; const seen=new Set();
  for(const c of candidates){
    const k=`${c.pageId}|${c.slug}|${c.bucket}`;
    if(seen.has(k)) continue;
    seen.add(k); uniq.push(c);
  }
  const safe=uniq.filter((c)=>c.bucket==='SAFE TO TRASH').sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  const review=uniq.filter((c)=>c.bucket==='REVIEW REQUIRED').sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  const out={generatedAt:new Date().toISOString(),scannedExecutions:rows.length,safeToTrash:safe,reviewRequired:review};
  fs.writeFileSync('.tmp-glw-test-page-candidates.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({scannedExecutions:rows.length,safeToTrashCount:safe.length,reviewRequiredCount:review.length},null,2));
})();