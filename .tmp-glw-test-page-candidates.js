const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function isTestCandidate(page){
  const t=String(page.title?.rendered||'').toLowerCase();
  const s=String(page.slug||'').toLowerCase();
  const pats=['qa-','test','testing','duplicate','replay','tmp'];
  const hit=pats.find((p)=>t.includes(p)||s.includes(p));
  if(!hit) return null;
  if(s==='austin'||s==='houston'||t.includes('austin')||t.includes('houston')) return null;
  return hit;
}
(async()=>{
  const base='https://leddisplaywarehouse.com';
  const auth='Basic '+Buffer.from(`${readEnv('GLW_ADMIN_EMAIL')}:${readEnv('GLW_ADMIN_PASSWORD')}`).toString('base64');
  let page=1; const per=100; const rows=[];
  while(true){
    const res=await fetch(`${base}/wp-json/wp/v2/pages?context=edit&per_page=${per}&page=${page}&orderby=date&order=desc`,{headers:{Authorization:auth,Accept:'application/json'}});
    if(!res.ok) throw new Error('wp pages fetch failed '+res.status+' page '+page+' '+await res.text());
    const arr=await res.json();
    if(!Array.isArray(arr) || arr.length===0) break;
    rows.push(...arr);
    if(arr.length<per) break;
    page++;
    if(page>20) break;
  }
  const candidates=[];
  for(const p of rows){
    const reason=isTestCandidate(p);
    if(!reason) continue;
    candidates.push({
      id:p.id,
      title:String(p.title?.rendered||''),
      slug:String(p.slug||''),
      status:String(p.status||''),
      parent:p.parent ?? 0,
      created:p.date_gmt || p.date || null,
      reason:`pattern:${reason}`,
    });
  }
  const safe=[]; const review=[];
  for(const c of candidates){
    const txt=(c.title+' '+c.slug).toLowerCase();
    const isProdCity=txt.includes('austin')||txt.includes('houston');
    const isRecentProdPattern=/direct-view-led-video-walls/.test(txt) && c.status==='publish';
    if(isProdCity || isRecentProdPattern){ review.push({...c, reason:c.reason+';possible production relevance'}); continue; }
    if(c.status==='draft' || c.slug.startsWith('qa-') || txt.includes('duplicate') || txt.includes('replay') || txt.includes('tmp')){
      safe.push(c);
    } else {
      review.push(c);
    }
  }
  const out={generatedAt:new Date().toISOString(),totalScanned:rows.length,safeToTrash:safe,reviewRequired:review};
  fs.writeFileSync('.tmp-glw-test-page-candidates.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({totalScanned:rows.length,safeToTrashCount:safe.length,reviewRequiredCount:review.length},null,2));
})();